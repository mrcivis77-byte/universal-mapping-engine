/// <reference path="../pb_data/types.d.ts" />
// ride_requests never had an `updated` autodate field (only `created`),
// so the pending-request-expiry cron cannot detect customer heartbeats.
// Add it with onCreate+onUpdate so every customer PATCH (lat/lng tick)
// refreshes it. Requests whose phone goes silent for
// TRANSIT_MAX_WAIT_TIME minutes are then safely expired, while actively
// waiting requests live until they get a ride.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3986442676")
  if (!collection.fields.getByName("updated")) {
    collection.fields.add(new Field({
      "name": "updated",
      "type": "autodate",
      "onCreate": true,
      "onUpdate": true,
    }))
  }
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3986442676")
  const updated = collection.fields.getByName("updated")
  if (updated) collection.fields.removeByName("updated")
  return app.save(collection)
})
