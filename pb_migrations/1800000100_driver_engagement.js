/// <reference path="../pb_data/types.d.ts" />
// Driver engagement tracking:
//   duty_count     - days worked (one hit per calendar day, Merida time)
//   last_hit_at    - ms timestamp of the last counted on-duty flip
//   referral_code  - per-driver share code (?ref=CODE)
//   referred_by    - driver id of the referrer
//   referral_count - drivers registered with this code
//   share_count    - times the share button was used
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1967373549")

  const addNum = (name) => {
    if (!collection.fields.getByName(name)) {
      collection.fields.add(new Field({ "name": name, "type": "number", "onlyInt": true }))
    }
  }
  addNum("duty_count")
  addNum("last_hit_at")
  addNum("referral_count")
  addNum("share_count")
  if (!collection.fields.getByName("referral_code")) {
    collection.fields.add(new Field({ "name": "referral_code", "type": "text" }))
  }
  if (!collection.fields.getByName("referred_by")) {
    collection.fields.add(new Field({ "name": "referred_by", "type": "text" }))
  }

  app.save(collection)

  // Backfill share codes for existing drivers (first 6 chars of id, uppercased).
  const drivers = app.findRecordsByFilter("drivers", "id != ''", "", 500, 0)
  for (const d of drivers) {
    if (!d.get("referral_code")) {
      d.set("referral_code", String(d.id).slice(0, 6).toUpperCase())
      app.save(d)
    }
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1967373549")
  for (const name of ["duty_count", "last_hit_at", "referral_count", "share_count", "referral_code", "referred_by"]) {
    const f = collection.fields.getByName(name)
    if (f) collection.fields.removeByName(name)
  }
  return app.save(collection)
})
