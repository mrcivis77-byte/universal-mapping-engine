/// Convert attractions.icon from text to a file field so admins can upload
/// custom cartoon-style marker images (theme-park community map).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("attractions");
  const field = collection.fields.getByName("icon");
  field.type = "file";
  field.maxSelect = 1;
  field.maxSize = 8388608;
  field.mimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("attractions");
  const field = collection.fields.getByName("icon");
  field.type = "text";
  field.maxSelect = 0;
  field.maxSize = 0;
  app.save(collection);
})
