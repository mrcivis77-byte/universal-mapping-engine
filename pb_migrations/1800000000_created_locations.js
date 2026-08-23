/// <reference path="../pb_data/types.d.ts" />
// Create a PUBLIC (anonymous) `locations` collection for the fishing Community map.
// Needed because this MuchoBien 0.39.10 fork has /api/admins/* auth HTTP routes
// DISABLED (404), so collections can only be created via a DB migration (run as root).
// Mirrors the working `species` collection field shapes exactly; all rules public/anonymous
// (list/view/create/update/delete = "") so the fishing app syncs spots cross-device w/o auth.
// Numbers/bools are stored as TEXT (the app coerces) to avoid guessing number/bool option schemas.
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_2817409931",
    "name": "locations",
    "type": "base",
    "system": false,
    "createRule": "",
    "deleteRule": "",
    "listRule": "",
    "viewRule": "",
    "updateRule": "",
    "indexes": [],
    "fields": [
      {"autogeneratePattern":"[a-z0-9]{15}","help":"","hidden":false,"id":"text3208210256","max":15,"min":15,"name":"id","pattern":"^[a-z0-9]+$","presentable":false,"primaryKey":true,"required":true,"system":true,"type":"text"},
      {"autogeneratePattern":"","help":"","hidden":false,"id":"text9000000001","max":0,"min":0,"name":"lat","pattern":"","presentable":false,"primaryKey":false,"required":true,"system":false,"type":"text"},
      {"autogeneratePattern":"","help":"","hidden":false,"id":"text9000000002","max":0,"min":0,"name":"lng","pattern":"","presentable":false,"primaryKey":false,"required":true,"system":false,"type":"text"},
      {"autogeneratePattern":"","help":"","hidden":false,"id":"text9000000003","max":0,"min":0,"name":"label","pattern":"","presentable":false,"primaryKey":false,"required":false,"system":false,"type":"text"},
      {"autogeneratePattern":"","help":"","hidden":false,"id":"text9000000004","max":0,"min":0,"name":"comment","pattern":"","presentable":false,"primaryKey":false,"required":false,"system":false,"type":"text"},
      {"autogeneratePattern":"","help":"","hidden":false,"id":"text9000000005","max":0,"min":0,"name":"cat","pattern":"","presentable":false,"primaryKey":false,"required":false,"system":false,"type":"text"},
      {"autogeneratePattern":"","help":"","hidden":false,"id":"text9000000006","max":0,"min":0,"name":"pub","pattern":"","presentable":false,"primaryKey":false,"required":false,"system":false,"type":"text"},
      {"autogeneratePattern":"","help":"","hidden":false,"id":"text9000000007","max":0,"min":0,"name":"photo","pattern":"","presentable":false,"primaryKey":false,"required":false,"system":false,"type":"text"},
      {"autogeneratePattern":"","help":"","hidden":false,"id":"text9000000008","max":0,"min":0,"name":"ts","pattern":"","presentable":false,"primaryKey":false,"required":false,"system":false,"type":"text"}
    ]
  });

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("locations");
    return app.delete(collection);
  } catch (e) { /* already gone */ }
  return;
});
