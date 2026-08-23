/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1967373549")

  // update field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "select4265829493",
    "maxSelect": 1,
    "name": "vehicle_type",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "mototaxi",
      "bus",
      "drive"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1967373549")

  // update field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "select4265829493",
    "maxSelect": 1,
    "name": "vehicle_type",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "mototaxi",
      "bus"
    ]
  }))

  return app.save(collection)
})
