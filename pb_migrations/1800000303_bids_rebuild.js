/// <reference path="../pb_data/types.d.ts" />
// Rebuild of `bids`: 1800000302 created only an empty shell because Field
// instances inside the Collection constructor config were silently dropped.
// This uses the proven pattern instead: create the collection shell with
// scalar props, then fields.add(new Field(cfg)) like 1800000100 did.
migrate((app) => {
  let col = null
  try { col = app.findCollectionByNameOrId("bids") } catch (e) {}
  if (!col) {
    col = new Collection({ "name": "bids", "type": "base" })
    col.listRule = ""
    col.viewRule = ""
    col.createRule = "@request.auth.id != \"\""
    col.updateRule = "@request.auth.id != \"\""
    col.deleteRule = "@request.auth.id != \"\""
    app.save(col)
  }

  const reqs = app.findCollectionByNameOrId("pbc_3986442676")
  const drvCol = app.findCollectionByNameOrId("drivers")
  const fieldCfgs = [
    new Field({ "name": "request", "type": "relation", "collectionId": reqs.id, "required": true, "cascadeDelete": true, "maxSelect": 1 }),
    new Field({ "name": "driver", "type": "relation", "collectionId": drvCol.id, "required": true, "cascadeDelete": true, "maxSelect": 1 }),
    new Field({ "name": "price", "type": "number", "required": true }),
    new Field({ "name": "eta_min", "type": "number" }),
    new Field({ "name": "note", "type": "text" }),
    new Field({ "name": "status", "type": "select", "values": ["pending", "accepted", "declined"], "required": true }),
    new Field({ "name": "created", "type": "autodate", "onCreate": true }),
    new Field({ "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }),
  ]
  for (const f of fieldCfgs) {
    if (!col.fields.getByName(f.name)) col.fields.add(f)
  }
  // ensure rules survive even if shell existed from the broken run
  col.listRule = ""
  col.viewRule = ""
  col.createRule = "@request.auth.id != \"\""
  col.updateRule = "@request.auth.id != \"\""
  col.deleteRule = "@request.auth.id != \"\""
  app.save(col)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("bids")) } catch (e) {}
})
