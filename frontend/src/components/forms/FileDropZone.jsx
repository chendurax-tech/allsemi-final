import React, { useRef, useState } from 'react';
import { DOCUMENT_ACCEPT } from '../../lib/api/public.js';
import { DOCUMENT_HINT, fileExtension, formatBytes } from './validation.js';
import { FieldError } from './fields.jsx';

/*
  FileDropZone - attach one document (a resume or a job description).

  A file can be dropped on the box or picked with the Browse button,
  which is a real button, so it works with a keyboard and on touch
  screens where nothing can be dragged. Once a file is attached the
  box shows its name, type and size, and the same button replaces it;
  Remove clears it.

  The name and size are checked on selection (useForm.chooseFile). The
  server decides the real type from the file's bytes, and its answer is
  shown here as the error too. While the form is sending, `progress`
  (0 to 1, from the upload's onProgress callback) drives the bar.

  field: useForm().fileField -> { id, file, error, onSelect, progress }
*/
export function FileDropZone({ field, label, required = false, optional = false, className = '' }) {
  const { id, file, error, progress } = field;
  const inputRef = useRef(null);
  const browseRef = useRef(null);
  // dragenter and dragleave also fire for the box's children; counting
  // them keeps the highlight steady while the pointer moves inside.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const sending = progress !== null;

  function take(files) {
    if (files && files[0] && !sending) field.onSelect(files[0]);
  }

  function onDrag(event, change) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current + change);
    setDragging(dragDepth.current > 0);
  }

  function onDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    take(event.dataTransfer.files);
  }

  function remove() {
    field.onSelect(null);
    browseRef.current?.focus();
  }

  const border = dragging
    ? 'border-dashed border-accent bg-accent/[0.06]'
    : error ? 'border-dashed border-red-500/70' : file ? 'border-solid border-line-strong' : 'border-dashed border-line-strong';
  const action = 'inline-flex min-h-[40px] items-center justify-center border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50';

  return (
    <div className={`min-w-0 ${className}`}>
      <span id={`${id}-label`} className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-3">
        {label}
        {required && <span className="text-accent" aria-hidden="true"> *</span>}
        {optional && <span className="text-text-dim/70"> (optional)</span>}
      </span>

      <div
        onDragEnter={(event) => onDrag(event, 1)}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => onDrag(event, -1)}
        onDrop={onDrop}
        className={`border px-4 py-4 sm:px-5 transition-colors motion-reduce:transition-none ${border}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <svg viewBox="0 0 28 34" width="28" height="34" fill="none" stroke="currentColor" strokeWidth="1.2" className={`shrink-0 ${file ? 'text-accent' : 'text-text-faint'}`} aria-hidden="true">
              <path d="M2.5 1.5h15l8 8v23h-23z" />
              <path d="M17.5 1.5v8h8" />
              <path d="M7.5 17.5h13M7.5 22.5h13M7.5 27.5h8" strokeOpacity="0.6" />
            </svg>
            <div className="min-w-0">
              <p className="truncate text-sm text-text" title={file ? file.name : undefined}>
                {file ? file.name : 'Drop a file here, or browse.'}
              </p>
              <p id={`${id}-hint`} className="mt-1 font-mono text-[0.68rem] uppercase tracking-wider text-text-dim">
                {file ? `${fileExtension(file).toUpperCase()} / ${formatBytes(file.size)}` : DOCUMENT_HINT}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              ref={browseRef}
              id={`${id}-browse`}
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={sending}
              aria-labelledby={`${id}-browse ${id}-label`}
              aria-describedby={[`${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')}
              aria-required={required || undefined}
              aria-invalid={error ? true : undefined}
              data-invalid={error ? 'true' : undefined}
              className={`${action} border-line-strong text-text hover:border-accent hover:text-accent`}
            >
              {file ? 'Replace' : 'Browse'}
            </button>
            {file && (
              <button type="button" onClick={remove} disabled={sending} aria-label={`Remove ${file.name}`} className={`${action} border-line text-text-dim hover:border-line-strong hover:text-text`}>
                Remove
              </button>
            )}
          </div>
        </div>

        {sending && <UploadProgress value={progress} className="mt-4" />}

        {/* The native picker. The Browse button above opens it. */}
        <input
          ref={inputRef}
          type="file"
          accept={DOCUMENT_ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) => { take(event.target.files); event.target.value = ''; }}
        />
      </div>

      <p className="sr-only" aria-live="polite">{file ? `Attached: ${file.name}` : ''}</p>
      {error && <div role="alert"><FieldError id={id}>{error}</FieldError></div>}
    </div>
  );
}

// The upload bar. value runs from 0 to 1.
export function UploadProgress({ value, className = '' }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.2em] text-text-dim">
        <span>{percent < 100 ? 'Uploading' : 'Uploaded'}</span>
        <span className="text-accent">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-0.5 w-full overflow-hidden bg-line-strong"
      >
        <div className="h-full bg-accent transition-[width] duration-200 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
