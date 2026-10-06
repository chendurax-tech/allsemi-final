import { upload, api } from './client.js';

/*
  Public website images. The file goes to the backend, which validates
  it by content and stores it in Cloudinary; the browser never holds a
  Cloudinary credential. Resolves to the media metadata saved on the
  record: { url, publicId, width, height, format, alt }.
*/
export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const uploadsApi = {
  uploadImage(file, { alt = '', onProgress, signal } = {}) {
    const form = new FormData();
    form.append('alt', alt);
    form.append('file', file, file.name);
    return upload('/api/admin/media', form, { onProgress, signal }).then((r) => r.data);
  },
  removeImage: (publicId) => api.delete('/api/admin/media', { publicId }).then((r) => r.data),
};
