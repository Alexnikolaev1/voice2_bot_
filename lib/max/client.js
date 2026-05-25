const axios = require('axios');
const { MAX_API_BASE, MAX_REQUEST_TIMEOUT_MS, MAX_REQUEST_RETRIES } = require('../config');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getToken() {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) throw new Error('MAX_BOT_TOKEN is not set');
  return token.trim();
}

function buildAuthHeader(token, useBearer = false) {
  return useBearer ? `Bearer ${token}` : token;
}

function isRetryableError(err) {
  const code = err.code;
  return (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN'
  );
}

async function request(method, path, options = {}, useBearer = false, attempt = 0) {
  const { params, data, headers, timeout = MAX_REQUEST_TIMEOUT_MS, responseType } = options;
  const url = `${MAX_API_BASE}${path}`;
  const token = getToken();

  try {
    const res = await axios({
      method,
      url,
      params,
      data,
      headers: {
        Authorization: buildAuthHeader(token, useBearer),
        ...headers,
      },
      timeout,
      responseType,
      validateStatus: () => true,
    });

    if (res.status === 401 && !useBearer) {
      return request(method, path, options, true, attempt);
    }

    if (res.status >= 400) {
      const detail = res.data ?? res.statusText;
      console.error(
        `[max] ${method} ${path} ${res.status}`,
        typeof detail === 'object' ? JSON.stringify(detail) : detail,
        params ? `params=${JSON.stringify(params)}` : ''
      );
      const err = new Error(`MAX API ${res.status}`);
      err.response = res;
      throw err;
    }

    return res.data;
  } catch (err) {
    if (err.response) throw err;

    const retryable = isRetryableError(err);
    if (retryable && attempt < MAX_REQUEST_RETRIES - 1) {
      const delay = 800 * (attempt + 1);
      console.warn(`[max] ${method} ${path} retry ${attempt + 2}/${MAX_REQUEST_RETRIES} after ${err.code}`);
      await sleep(delay);
      return request(method, path, options, useBearer, attempt + 1);
    }

    console.error(`[max] ${method} ${path} failed:`, err.code || err.message);
    throw err;
  }
}

function queryVariants(target) {
  const variants = [];
  if (target.userId != null) variants.push({ user_id: target.userId });
  if (target.chatId != null) variants.push({ chat_id: target.chatId });
  return variants;
}

async function sendMessage(target, body) {
  const variants = queryVariants(target);
  if (variants.length === 0) throw new Error('sendMessage: нет chat_id и user_id');

  const data = {
    notify: body.notify !== false,
    text: body.text,
  };
  if (body.format) data.format = body.format;
  if (body.attachments) data.attachments = body.attachments;

  let lastErr;
  for (const params of variants) {
    try {
      return await request('POST', '/messages', { params, data });
    } catch (err) {
      lastErr = err;
      if (err.response?.status !== 400) throw err;
    }
  }
  throw lastErr;
}

async function sendMessageWithFallback(target, variants) {
  let lastErr;
  for (const body of variants) {
    try {
      return await sendMessage(target, body);
    } catch (err) {
      lastErr = err;
      if (err.response?.status !== 400) throw err;
    }
  }
  throw lastErr;
}

async function answerCallback(callbackId, opts = {}) {
  const data = {};
  if (opts.message) data.message = opts.message;
  if (opts.notification != null && opts.notification !== '') {
    data.notification = opts.notification;
  }
  if (!data.message && !data.notification) {
    data.notification = 'OK';
  }

  return request('POST', '/answers', {
    params: { callback_id: callbackId },
    data,
    timeout: 12000,
  });
}

module.exports = {
  sendMessage,
  sendMessageWithFallback,
  answerCallback,
  request,
  getToken,
  isRetryableError,
};
