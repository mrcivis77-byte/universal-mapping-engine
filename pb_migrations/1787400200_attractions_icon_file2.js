/// Convert attractions.icon text -> file (remove+add, the reliable way).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("attractions");
  collection.fields.removeByName("icon");
  collection.fields.add(new FileField({
    name: "icon",
    maxSelect: 1,
    maxSize: 8388608,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"]
  }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("attractions");
  collection.fields.removeByName("icon");
  collection.fields.add(new TextField({
    name: "icon",
    autogeneratePattern: "",
    min: 0,
    max: 0,
    pattern: ""
  }));
  app.save(collection);
})
