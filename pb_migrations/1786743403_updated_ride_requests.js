/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3986442676")

  // add field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "select4265829493",
    "maxSelect": 1,
    "name": "vehicle_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "mototaxi",
      "bus"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3986442676")

  // remove field
  collection.fields.removeById("select4265829493")

  return app.save(collection)
})
