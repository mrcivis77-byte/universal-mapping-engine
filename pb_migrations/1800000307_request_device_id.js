/// <reference path="../pb_data/types.d.ts" />
// Customer devices identify their ride_requests with a stable random
// device_id so refreshing the page re-adopts the same pending request
// instead of stacking duplicate markers on the map.
migrate((app) => {
  const col = app.findCollectionByNameOrId("ride_requests")
  col.fields.add(new Field({
    "name": "device_id",
    "type": "text",
    "required": false,
    "autogeneratePattern": "",
    "min": 0,
    "max": 64,
    "pattern": ""
  }))
  return app.save(col)
}, (app) => {
  const col = app.findCollectionByNameOrId("ride_requests")
  col.fields.removeByName("device_id")
  return app.save(col)
})
