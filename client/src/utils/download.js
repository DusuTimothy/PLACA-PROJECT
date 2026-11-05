/**
 * Save a Blob to the device with a friendly file name.
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'placa-download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(name, fallback = 'placa-download') {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .trim();
  return cleaned || fallback;
}
