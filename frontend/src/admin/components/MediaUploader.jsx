import React, { useRef, useState } from 'react';
import { uploadsApi, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/api/index.js';
import { Button, Notice, cx, inputCls, labelCls } from './ui.jsx';

/*
  MediaUploader - the image field for website content (an article
  cover, a story photo, a sector visual).

  The value is the media object the backend stores on the record:
    { url, publicId, width, height, format, alt }
  An uploaded image has a publicId. An image entered as a link has
  none. The record itself is only changed when the form is saved.

  Uploading sends the file to the backend, which checks it by content
  and stores it; the type and size checks here only save a wasted
  upload, they are not the control.

  Cleaning up: an image uploaded in this editing session and then
  removed or replaced before saving belongs to no record, so it is
  deleted from storage straight away. The image the saved record
  already uses (`saved`) is never deleted from here: the backend
  removes it when a save replaces it, and cancelling the edit must
  leave it in place.
*/

const EMPTY = { url: '', publicId: '', width: null, height: null, format: '', alt: '' };
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const megabytes = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

function problemWith(file) {
  const byName = /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!(TYPES.includes(file.type) || (!file.type && byName))) return 'Choose a JPG, PNG or WebP image. Other file types are not accepted.';
  if (file.size > IMAGE_MAX_BYTES) return `This image is ${megabytes(file.size)} MB. The limit is ${megabytes(IMAGE_MAX_BYTES)} MB.`;
  if (file.size === 0) return 'This file is empty. Choose another image.';
  return '';
}

export default function MediaUploader({ id, value, saved, onChange, disabled }) {
  const media = { ...EMPTY, ...(value || {}) };
  const input = useRef(null);
  const upload = useRef(null);
  const uploadedHere = useRef(new Set());
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [broken, setBroken] = useState(false);
  const uploading = progress !== null;

  // Deletes an image from storage when this session uploaded it and no
  // saved record uses it. A failure here leaves an unused file behind
  // and changes nothing the editor can act on, so it is not reported.
  function discard(previous) {
    const publicId = previous?.publicId;
    if (!publicId || !uploadedHere.current.has(publicId) || publicId === saved?.publicId) return;
    uploadedHere.current.delete(publicId);
    uploadsApi.removeImage(publicId).catch(() => {});
  }

  function replaceWith(next) {
    discard(media);
    setBroken(false);
    onChange(next);
  }

  async function send(file) {
    if (!file || disabled || uploading) return;
    const problem = problemWith(file);
    if (problem) { setError(problem); return; }
    setError('');
    setProgress(0);
    const controller = new AbortController();
    upload.current = controller;
    try {
      const stored = await uploadsApi.uploadImage(file, { alt: media.alt, onProgress: setProgress, signal: controller.signal });
      uploadedHere.current.add(stored.publicId);
      replaceWith({ ...EMPTY, ...stored, alt: stored.alt || media.alt });
      setLinkOpen(false);
    } catch (failure) {
      if (failure.name !== 'AbortError') setError(failure.message);
    } finally {
      upload.current = null;
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  function applyLink() {
    const url = link.trim();
    if (!/^https:\/\/[^\s<>"']+$/i.test(url)) { setError('Enter a full image link that starts with https://.'); return; }
    setError('');
    replaceWith({ ...EMPTY, url, alt: media.alt });
    setLink('');
    setLinkOpen(false);
  }

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    send(event.dataTransfer.files?.[0]);
  };
  const onDragOver = (event) => {
    event.preventDefault();
    if (!disabled) setDragging(true);
  };

  const details = [
    media.publicId ? 'Uploaded image' : 'Image link',
    media.format ? media.format.toUpperCase() : '',
    media.width && media.height ? `${media.width} x ${media.height} px` : '',
  ].filter(Boolean).join(' / ');

  return (
    <div className="border border-line-strong">
      <div
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx('flex flex-col gap-4 p-3 transition-colors sm:flex-row sm:items-start', dragging && 'bg-accent/10 outline outline-1 outline-accent')}
      >
        <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden border border-line bg-bg sm:w-48">
          {media.url && !broken && <img src={media.url} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />}
          {media.url && broken && <p className="px-3 text-center text-xs text-warn">The image at this address could not be loaded.</p>}
          {!media.url && <p className="px-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim">No image</p>}
        </div>

        <div className="min-w-0 flex-1">
          {media.url ? (
            <>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim">{details}</p>
              <p className="mt-1 break-all text-xs text-text-dim">{media.url}</p>
            </>
          ) : (
            <p className="text-sm text-text-dim leading-relaxed">
              {disabled ? 'No image has been added.' : 'Drop an image here, or browse for one. JPG, PNG or WebP, up to 5 MB.'}
            </p>
          )}

          {!disabled && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input ref={input} type="file" accept={IMAGE_ACCEPT} tabIndex={-1} aria-hidden="true" className="sr-only" onChange={(event) => send(event.target.files?.[0])} />
              <Button id={id} size="sm" disabled={uploading} onClick={() => input.current?.click()}>{media.url ? 'Replace image' : 'Browse for an image'}</Button>
              {media.url && <Button size="sm" variant="danger" disabled={uploading} onClick={() => replaceWith({ ...EMPTY })}>Remove image</Button>}
              {uploading && <Button size="sm" variant="ghost" onClick={() => upload.current?.abort()}>Cancel upload</Button>}
              {!uploading && (
                <button type="button" onClick={() => { setLinkOpen((open) => !open); setError(''); }} aria-expanded={linkOpen} className="text-xs text-text-dim underline hover:text-accent focus:outline-none focus-visible:text-accent">
                  Use an image link instead
                </button>
              )}
            </div>
          )}

          {uploading && (
            <div className="mt-3">
              <div className="h-1 w-full bg-line-strong" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim" role="status">Uploading {Math.round(progress * 100)}%</p>
            </div>
          )}

          {linkOpen && !disabled && !uploading && (
            <div className="mt-3">
              <label htmlFor={`${id}-link`} className={labelCls}>Image link</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={`${id}-link`}
                  type="url"
                  value={link}
                  placeholder="https://"
                  onChange={(event) => setLink(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyLink(); } }}
                  className={inputCls}
                />
                <Button size="sm" className="shrink-0" onClick={applyLink}>Use this link</Button>
              </div>
              <p className="mt-1.5 text-xs text-text-dim">Links must start with https://. An uploaded image is kept with the site; a link depends on the other website.</p>
            </div>
          )}

          {error && <div className="mt-3" role="alert"><Notice tone="red">{error}</Notice></div>}
        </div>
      </div>

      <div className="border-t border-line p-3">
        <label htmlFor={`${id}-alt`} className={labelCls}>Image description</label>
        <input
          id={`${id}-alt`}
          type="text"
          value={media.alt}
          maxLength={300}
          disabled={disabled || !media.url}
          onChange={(event) => onChange({ ...media, alt: event.target.value })}
          className={inputCls}
        />
        <p className="mt-1.5 text-xs text-text-dim">Read aloud by screen readers. Say what the image shows.</p>
      </div>
    </div>
  );
}
