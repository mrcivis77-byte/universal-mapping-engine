/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_29356246",
        "help": "",
        "hidden": false,
        "id": "relation1290192804",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "town",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text3266566760",
        "max": 0,
        "min": 0,
        "name": "vessel_name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select273609543",
        "maxSelect": 1,
        "name": "vessel_type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "panga",
          "boat",
          "yacht"
        ]
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text953081790",
        "max": 0,
        "min": 0,
        "name": "registration_number",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number1092145443",
        "max": 90,
        "min": -90,
        "name": "latitude",
        "onlyInt": false,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number2246143851",
        "max": 180,
        "min": -180,
        "name": "longitude",
        "onlyInt": false,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number45367233",
        "max": 360,
        "min": 0,
        "name": "heading",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number254213878",
        "max": null,
        "min": 0,
        "name": "speed",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select2063623452",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "fishing",
          "returning",
          "docked",
          "emergency"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "number3472671349",
        "max": null,
        "min": 0,
        "name": "crew_size",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }
    ],
    "id": "pbc_1377715175",
    "indexes": [],
    "listRule": "",
    "name": "vessels",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1377715175");

  return app.delete(collection);
})
