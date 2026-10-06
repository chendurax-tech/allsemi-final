// Small formatting helpers shared by the admin screens.

export function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${formatDate(value)}, ${time} UTC`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return 'Size not recorded';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
