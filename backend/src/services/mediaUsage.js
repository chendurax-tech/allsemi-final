import { Insight, Story, Expertise } from '../models/index.js';

/*
  Which saved records show an uploaded image.

  A record's image.publicId is supplied by the request that saves it,
  so two records can name the same image, by mistake or on purpose.
  Before an image is deleted from storage this is asked first, so
  replacing or deleting one record can never remove an image another
  record still shows.
*/
const HOLDERS = [
  { Model: Insight, field: 'image' },
  { Model: Story, field: 'photo' },
  { Model: Expertise, field: 'image' },
];

// `except` is the record being saved or deleted: { Model, id }.
export async function imageInUse(publicId, except = null) {
  if (!publicId) return false;
  const counts = await Promise.all(HOLDERS.map(({ Model, field }) => {
    const filter = { [`${field}.publicId`]: publicId };
    if (except && except.Model === Model) filter._id = { $ne: except.id };
    return Model.countDocuments(filter);
  }));
  return counts.some((count) => count > 0);
}
