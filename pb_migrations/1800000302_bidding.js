/// <reference path="../pb_data/types.d.ts" />
// Marketplace bidding for drive + a-usted (delivery):
// - customers post a request, drivers reply with BIDS (price + how soon),
//   customer sees rating/photo/car pics and picks ONE winner;
// - losing bids auto-decline (privacy: winner + customer only see each other);
// - drivers get selfie + car interior/exterior photo fields;
// - new 'austed' vehicle_type for the delivery app.
migrate((app) => {
  const reqs = app.findCollectionByNameOrId("pbc_3986442676")
  const vt = reqs.fields.getByName("vehicle_type")
  if (!vt.values.includes("austed")) vt.values.push("austed")
  const drvCol = app.findCollectionByNameOrId("drivers")

  if (!reqs.fields.getByName("accepted_driver")) {
    reqs.fields.add(new Field({
      "name": "accepted_driver",
      "type": "relation",
      "collectionId": drvCol.id,
      "maxSelect": 1,
      "required": false,
    }))
  }
  if (!reqs.fields.getByName("agreed_price")) {
    reqs.fields.add(new Field({ "name": "agreed_price", "type": "number" }))
  }
  app.save(reqs)

  const drivers = app.findCollectionByNameOrId("drivers")
  const fileField = (name) => new Field({
    "name": name,
    "type": "file",
    "maxSelect": 1,
    "maxSize": 5242880,
    "mimeTypes": ["image/jpeg", "image/png", "image/webp"],
  })
  for (const fname of ["photo", "car_inside", "car_outside"]) {
    if (!drivers.fields.getByName(fname)) drivers.fields.add(fileField(fname))
  }
  app.save(drivers)

  let bidsExists = false
  try { app.findCollectionByNameOrId("bids"); bidsExists = true } catch (e) {}
  if (!bidsExists) {
    const bids = new Collection({
      "type": "base",
      "name": "bids",
      "listRule": "",
      "viewRule": "",
      // real ownership + transition checks enforced server-side in rtm_api.pb.js
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.id != \"\"",
      "fields": [
        new Field({ "name": "request", "type": "relation", "collectionId": reqs.id, "required": true, "cascadeDelete": true, "maxSelect": 1 }),
        new Field({ "name": "driver", "type": "relation", "collectionId": drvCol.id, "required": true, "cascadeDelete": true, "maxSelect": 1 }),
        new Field({ "name": "price", "type": "number", "required": true }),
        new Field({ "name": "eta_min", "type": "number", "required": false }),
        new Field({ "name": "note", "type": "text" }),
        new Field({ "name": "status", "type": "select", "values": ["pending", "accepted", "declined"], "required": true }),
        new Field({ "name": "created", "type": "autodate", "onCreate": true }),
        new Field({ "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }),
      ],
    })
    app.save(bids)
  }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("bids")) } catch (e) {}
  const reqs = app.findCollectionByNameOrId("pbc_3986442676")
  for (const f of ["accepted_driver", "agreed_price"]) {
    const fld = reqs.fields.getByName(f)
    if (fld) reqs.fields.removeByName(f)
  }
  const vt = reqs.fields.getByName("vehicle_type")
  vt.values = vt.values.filter((v) => v !== "austed")
  app.save(reqs)
})
