/// <reference path="../pb_data/types.d.ts" />
// The a-usted app registers drivers with vehicle_type "austed", but the
// drivers collection select only allowed mototaxi/bus/drive, so
// /api/rtm/register-driver failed with "vehicle_type: Invalid value austed".
migrate((app) => {
  const drv = app.findCollectionByNameOrId("drivers")
  const vt = drv.fields.getByName("vehicle_type")
  if (!vt.values.includes("austed")) vt.values.push("austed")
  return app.save(drv)
}, (app) => {
  const drv = app.findCollectionByNameOrId("drivers")
  const vt = drv.fields.getByName("vehicle_type")
  vt.values = vt.values.filter((v) => v !== "austed")
  return app.save(drv)
})
