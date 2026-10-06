/*
  Schema plugin shared by every model.

  - Shapes the JSON the API returns: `id` instead of `_id`, no `__v`,
    and never a field listed in the schema's `hidden` option. Fields
    such as a password hash or a private storage key are therefore
    removed where the JSON is produced, not left to each controller to
    remember.
*/
export function baseSchemaPlugin(schema, options = {}) {
  const hidden = options.hidden || [];
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform(doc, ret) {
      if (ret._id !== undefined) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      for (const path of hidden) delete ret[path];
      return ret;
    },
  });
}

// What the API says about a stored private file. The storage key never
// leaves the server: a file is fetched through a permission-checked
// endpoint that issues a short-lived signed URL.
export function describeFile(file) {
  if (!file || !file.key) return null;
  return {
    fileName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    uploadedAt: file.uploadedAt,
  };
}
