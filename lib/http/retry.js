const NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

function isRetryableNetworkError(err) {
  if (!err) return false;
  if (NETWORK_CODES.has(err.code)) return true;
  const msg = err.message || '';
  return msg.includes('socket hang up') || msg.includes('network');
}

async function withNetworkRetry(fn, { label = 'http', retries = 2, delayMs = 1000 } = {}) {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (!isRetryableNetworkError(err) || attempt >= retries) {
        if (isRetryableNetworkError(err)) {
          err.source = err.source || label;
          if (!err.code) err.code = 'NETWORK_ERROR';
        }
        throw err;
      }
      console.warn(
        `[${label}] retry ${attempt + 1}/${retries}:`,
        err.code || err.message
      );
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }

  throw lastErr;
}

module.exports = { withNetworkRetry, isRetryableNetworkError };
