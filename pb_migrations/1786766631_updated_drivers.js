/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1967373549")

  // add field
  collection.fields.addAt(14, new Field({
    "help": "Epoch ms of the driver's last on-duty location ping. Used by scripts/cleanup_inactive_drivers.py (90-day inactive cleanup).",
    "hidden": false,
    "id": "number1786745010",
    "max": 9999999999999,
    "min": 0,
    "name": "last_active",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1967373549")

  // remove field
  collection.fields.removeById("number1786745010")

  return app.save(collection)
})
