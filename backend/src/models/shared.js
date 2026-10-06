import mongoose from 'mongoose';

const { Schema } = mongoose;

// A private document: only the key and descriptive metadata are
// stored. The bytes are never kept in MongoDB.
//
// `storage` names the store that holds the bytes (b2 in production;
// local or memory in development and tests). It is written when the
// file is stored and has no default, so a record saved before the
// field existed has none (services/storage/privateFiles.js decides
// where such a file is). It is internal: describeFile() in plugins.js
// never returns it, or the key, to a client.
export const privateFileSchema = new Schema({
  key: { type: String, required: true },
  originalName: { type: String, required: true, maxlength: 160 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  // 'r2' is the provider used before B2. It is accepted only so that a
  // record written then still saves; nothing is stored under it now.
  storage: { type: String, enum: ['b2', 'local', 'memory', 'r2'] },
}, { _id: false });

// A public image in Cloudinary. `publicId` is what a later replace or
// remove call needs. An image that was entered as an external URL has
// no publicId.
export const mediaSchema = new Schema({
  url: { type: String, default: '', maxlength: 600 },
  publicId: { type: String, default: '' },
  width: { type: Number, default: null },
  height: { type: Number, default: null },
  format: { type: String, default: '' },
  alt: { type: String, default: '', maxlength: 300 },
}, { _id: false });

export const noteSchema = new Schema({
  text: { type: String, required: true, maxlength: 4000 },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  authorName: { type: String, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false });
