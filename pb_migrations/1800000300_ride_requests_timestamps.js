/// <reference path="../pb_data/types.d.ts" />
// ride_requests was created with the created/updated autodate fields
// disabled, so every record had created="" - which made the
// pending-request-expiry cron treat EVERY pending request as older than
// TRANSIT_MAX_WAIT_TIME and cancel it within seconds of creation.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3986442676")

  const created = collection.fields.getByName("created")
  if (created) created.onCreate = true

  const updated = collection.fields.getByName("updated")
  if (updated) updated.onUpdate = true

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3986442676")

  const created = collection.fields.getByName("created")
  if (created) created.onCreate = false

  const updated = collection.fields.getByName("updated")
  if (updated) updated.onUpdate = false

  return app.save(collection)
})
