/// <reference path="../pb_data/types.d.ts" />
// Marketplace flow needs an explicit matched state between "pending" (still
// collecting bids) and "completed": when the customer picks a winning bid the
// request flips to "accepted" so losing drivers' maps drop it immediately.
migrate((app) => {
  const reqs = app.findCollectionByNameOrId("pbc_3986442676")
  const st = reqs.fields.getByName("status")
  if (!st.values.includes("accepted")) st.values.push("accepted")
  return app.save(reqs)
}, (app) => {
  const reqs = app.findCollectionByNameOrId("pbc_3986442676")
  const st = reqs.fields.getByName("status")
  st.values = st.values.filter((v) => v !== "accepted")
  return app.save(reqs)
})
