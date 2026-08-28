#!/bin/sh
# Generate pb_public/config.json from a KEY=VALUE env file.
# Busybox/POSIX safe: no arrays, no bashisms.
# Usage: sh scripts/generate-config.sh /path/to/config.env > pb_public/config.json
set -eu

src="${1:?usage: generate-config.sh /path/to/config.env}"

# Keys published to the frontend
allowed=" APP_ID APP_NAME APP_TYPE TOWN_NAME TOWN_ID TIMEZONE INITIAL_LATITUDE INITIAL_LONGITUDE MAP_ZOOM_LEVEL MAX_BOUNDS WELCOME_MESSAGE PUBLIC_URL API_BASE_URL CENTRAL_REGISTRY_URL LANGUAGES TRANSIT_VEHICLE_TYPES TRANSIT_MAX_WAIT_TIME RIDE_PICKUP_DISTANCE FISHING_VESSEL_TYPES FISHING_ZONES TRAVEL_PROXIMITY_RADIUS TRAVEL_THEME_PARK_MODE CULTURAL_LANDMARKS MAP_TILE_PROVIDER DEFAULT_LANGUAGE ENABLE_CROSS_COUNTRY_HANDOFF ENABLE_HIDDEN_GEMS ENABLE_PROXIMITY_ALERTS ENABLE_REALTIME_SYNC GPS_UPDATE_INTERVAL MAP_SYNC_INTERVAL MAX_DRIVERS_DISPLAY MAX_GEMS_DISPLAY ALLOW_ANONYMOUS_ACCESS RATE_LIMIT_REQUESTS "

# Emitted as raw JSON (numbers)
numbers=" INITIAL_LATITUDE INITIAL_LONGITUDE MAP_ZOOM_LEVEL TRANSIT_MAX_WAIT_TIME RIDE_PICKUP_DISTANCE TRAVEL_PROXIMITY_RADIUS GPS_UPDATE_INTERVAL MAP_SYNC_INTERVAL MAX_DRIVERS_DISPLAY MAX_GEMS_DISPLAY RATE_LIMIT_REQUESTS "

# Emitted as JSON booleans
booleans=" TRAVEL_THEME_PARK_MODE ENABLE_CROSS_COUNTRY_HANDOFF ENABLE_HIDDEN_GEMS ENABLE_PROXIMITY_ALERTS ENABLE_REALTIME_SYNC ALLOW_ANONYMOUS_ACCESS "

# Emitted as raw JSON (arrays/objects)
rawjson=" CULTURAL_LANDMARKS "

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

strip_quotes() {
  case "$1" in
    "'"*) printf '%s' "$1" | sed -e "s/^'//" -e "s/'$//" ;;
    '"'*) printf '%s' "$1" | sed -e 's/^"//' -e 's/"$//' ;;
    *) printf '%s' "$1" ;;
  esac
}

emit() {
  key="$1"
  val="$2"

  case " $rawjson " in
    *" $key "*)
      printf '"%s":%s' "$key" "$(strip_quotes "$val")"
      return
      ;;
  esac

  case " $numbers " in
    *" $key "*)
      printf '"%s":%s' "$key" "$val"
      return
      ;;
  esac

  case " $booleans " in
    *" $key "*)
      if [ "$val" = "true" ]; then
        printf '"%s":true' "$key"
      else
        printf '"%s":false' "$key"
      fi
      return
      ;;
  esac

  printf '"%s":"%s"' "$key" "$(json_escape "$(strip_quotes "$val")")"
}

printf '{'
first=1
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    '' | \#*) continue ;;
  esac
  key="${line%%=*}"
  val="${line#*=}"

  case " $allowed " in
    *" $key "*) ;;
    *) continue ;;
  esac

  if [ "$first" -eq 1 ]; then
    first=0
  else
    printf ','
  fi
  emit "$key" "$val"
done < "$src"
printf '}\n'
