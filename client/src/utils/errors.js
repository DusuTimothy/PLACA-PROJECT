/**
 * Turns an Axios error into a message a first-time user can act on.
 * Server codes are translated; unknown server messages are shown as a fallback.
 */

export function getErrorCode(error) {
  return error?.response?.data?.error || (error?.request ? 'NETWORK' : 'GENERIC');
}

export function getFieldErrors(error) {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return details.reduce((result, item) => {
    if (!item?.path) return result;
    const field = item.path.replace(/^body\./, '');
    if (!result[field]) result[field] = item.message;
    return result;
  }, {});
}

export function errorMessage(error, t) {
  const code = getErrorCode(error);
  const serverMessage = error?.response?.data?.message;
  return t(`errors.${code}`, {
    defaultValue: serverMessage || t('errors.GENERIC'),
  });
}
