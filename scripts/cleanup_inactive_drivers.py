#!/usr/bin/env python3
# Inactive-driver cleanup for the Community Transit (moto/bus) stack.
#
# A driver is removed when they have NOT been on duty for INACTIVE_DAYS.
# On-duty activity is tracked by drivers.last_active (epoch ms), stamped in
# pb_public/js/ride.js by publishDriverPosition() on every on-duty location
# ping, and by driver.create() at registration.
#
# Removal rule (safe: on-duty drivers are NEVER deleted):
#   - currently OFF duty (drivers.status != "available" and != "busy"), AND
#   - drivers.last_active older than INACTIVE_DAYS, OR (last_active is null/0
#     AND the linked users.created is older than INACTIVE_DAYS -> registered
#     but never went on duty).
# On-duty drivers (available/busy) and records whose last_active is unset
# (<=0) with a recent account are always kept.
#
# Deletion removes BOTH the drivers profile and its linked users auth record;
# the driver must re-register to return.
#
# Default = DRY-RUN (report only). Use --delete to actually remove records.
# Daily crontab example (as user mcivis77):
#   0 4 * * * /usr/bin/python3 /home/mcivis77/universal-mapping-engine/scripts/cleanup_inactive_drivers.py --delete >> /home/mcivis77/universal-mapping-engine/logs/cleanup.log 2>&1
import os, sys, json, time, datetime, traceback, urllib.request, urllib.error, urllib.parse

ROOT = "/home/mcivis77/universal-mapping-engine"
ENV = os.path.join(ROOT, "config.env")
PB = "http://127.0.0.1:8090"
INACTIVE_DAYS = 90
DQ = chr(34)

def load_env(path):
    env = {}
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        if k.startswith("export "):
            k = k[7:].strip()
        v = v.strip()
        if len(v) >= 2 and v[0] == DQ and v[-1] == DQ:
            v = v[1:-1]
        env[k] = v
    return env

def post_json(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, json.loads(r.read().decode() or "{}")

TOKEN = None
def authed(method, path, body=None):
    req = urllib.request.Request(PB + path,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + TOKEN,
                                          "Content-Type": "application/json"},
                                 method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}

def get(path):
    return authed("GET", path)[1]

def delete_record(coll, rid):
    return authed("DELETE", "/api/collections/%s/records/%s" % (coll, urllib.parse.quote(str(rid))))[0]

def parse_dt(s):
    if not s:
        return None
    try:
        s = str(s).replace("T", " ").rstrip("Z")
        return datetime.datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=datetime.timezone.utc)
    except Exception:
        return None

def main():
    do_delete = "--delete" in sys.argv
    env = load_env(ENV)
    s, b = post_json(PB + "/api/collections/_superusers/auth-with-password",
                     {"identity": env.get("PB_SUPERUSER_EMAIL"), "password": env.get("PB_SUPERUSER_PASSWORD")})
    assert s == 200 and b.get("token"), "superuser auth failed: %s %s" % (s, b)
    global TOKEN
    TOKEN = b["token"]

    now_dt = datetime.datetime.now(datetime.timezone.utc)
    cutoff_dt = now_dt - datetime.timedelta(days=INACTIVE_DAYS)
    now_ms = int(now_dt.timestamp() * 1000)
    cutoff_ms = int(cutoff_dt.timestamp() * 1000)

    drivers = get("/api/collections/drivers/records?perPage=200").get("items", [])
    print("%s | drivers=%d | cutoff=%s | now=%s" %
          ("DELETE" if do_delete else "DRY-RUN", len(drivers),
           cutoff_dt.date(), now_dt.date()))

    candidates = []
    for d in drivers:
        did = d.get("id"); status = d.get("status"); la = d.get("last_active"); uid = d.get("user")
        if status in ("available", "busy"):
            print("  keep   %-16s ON_DUTY status=%s last_active=%s" % (did, status, la)); continue
        if isinstance(la, (int, float)) and la > 0:
            age = (now_ms - la) // 86400000
            if la < cutoff_ms:
                print("  DEL    %-16s status=%-9s INACTIVE age~%dd last_active=%s user=%s" % (did, status, age, la, uid))
                candidates.append((did, uid))
            else:
                print("  keep   %-16s status=%-9s last_active=%s age~%dd (active within %d) user=%s" % (did, status, la, age, INACTIVE_DAYS, uid))
            continue
        # last_active is null/0 -> never went on duty: fall back to users.created
        uc = {}
        if uid:
            try: uc = get("/api/collections/users/records/" + urllib.parse.quote(str(uid)))
            except Exception: uc = {}
        created = parse_dt(uc.get("created"))
        if created is not None and created < cutoff_dt:
            print("  DEL    %-16s status=%-9s NEVER_ON_DUTY registered=%s user=%s" % (did, status, uc.get("created"), uid))
            candidates.append((did, uid))
        else:
            print("  keep   %-16s status=%-9s last_active=%s (null/0, never on duty) registered=%s (within %dd) user=%s" % (did, status, la, uc.get("created"), INACTIVE_DAYS, uid))

    print("\n%d candidate(s) for removal." % len(candidates))
    if not candidates:
        print("done (%s, no changes)" % ("DELETE" if do_delete else "DRY-RUN")); return
    for did, uid in candidates:
        if do_delete:
            ds = delete_record("drivers", did)
            us = delete_record("users", uid) if uid else "n/a"
            print("  deleted driver %s -> %s ; user %s -> %s" % (did, ds, uid, us))
        else:
            print("  [dry-run] WOULD delete driver %s (user %s)" % (did, uid))
    print("done" + (" (deleted)" if do_delete else " (dry-run, no changes)"))

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(); sys.exit(1)
