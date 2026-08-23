/// <reference path="../pb_data/types.d.ts" />
// The FULL toggle PATCHes drivers.status = "full" (ride.js setFull /
// publishDriverPosition), but the status select only allowed
// available/busy/offline - every toggle was rejected with 400
// validation_invalid_value, so customers never saw the red marker.
migrate((app) => {
  const drv = app.findCollectionByNameOrId("drivers")
  const st = drv.fields.getByName("status")
  if (!st.values.includes("full")) st.values.push("full")
  return app.save(drv)
}, (app) => {
  const drv = app.findCollectionByNameOrId("drivers")
  const st = drv.fields.getByName("status")
  st.values = st.values.filter((v) => v !== "full")
  return app.save(drv)
})
