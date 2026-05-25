const axios = require('axios');
const { request, getToken } = require('./client');
const { MAX_UPLOAD_TIMEOUT_MS } = require('../config');
const { withNetworkRetry } = require('../http/retry');
const { buildMultipartBody } = require('./multipart');

const READY_RETRIES = 6;
const READY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatUploadBody(data) {
  if (data == null) return '';
  if (typeof data === 'object') return JSON.stringify(data).slice(0, 500);
  return String(data).slice(0, 500);
}

function makeUploadError(status, body, urlHost) {
  const err = new Error(`MAX_UPLOAD_${status}`);
  err.source = 'max-upload';
  err.status = status;
  err.body = body;
  err.uploadHost = urlHost;
  throw err;
}

function uploadHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

/**
 * POST multipart to CDN — no Authorization (per official Go/Ruby clients).
 */
async function postMultipartToCdn(url, buffer, filename) {
  const { body, contentType, contentLength } = buildMultipartBody(buffer, filename);

  return withNetworkRetry(
    () =>
      axios.post(url, body, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': contentLength,
        },
        timeout: MAX_UPLOAD_TIMEOUT_MS,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true,
        transformRequest: [(data) => data],
      }),
    { label: 'max-upload', retries: 1, delayMs: 600 }
  );
}

async function postMultipartFetch(url, buffer, filename) {
  const form = new FormData();
  form.append('data', new Blob([buffer], { type: 'application/octet-stream' }), filename);

  const res = await fetch(url, { method: 'POST', body: form });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function uploadToCdn(url, buffer) {
  const filenames = ['voice.wav', 'voice.mp3'];
  let lastStatus = 0;
  let lastBody = '';

  for (const filename of filenames) {
    const res = await postMultipartToCdn(url, buffer, filename);
    lastStatus = res.status;
    lastBody = formatUploadBody(res.data);
    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }
    if (lastStatus !== 415) break;
  }

  if (typeof FormData !== 'undefined' && typeof Blob !== 'undefined') {
    for (const filename of filenames) {
      const res = await postMultipartFetch(url, buffer, filename);
      lastStatus = res.status;
      lastBody = formatUploadBody(res.data);
      if (res.status >= 200 && res.status < 300) {
        return res.data;
      }
    }
  }

  const host = uploadHost(url);
  console.error(`[max-upload] ${lastStatus} host=${host}`, lastBody.slice(0, 200));
  makeUploadError(lastStatus || 500, lastBody, host);
}

async function uploadAudio(buffer) {
  if (!buffer?.length) {
    const err = new Error('MAX_UPLOAD_EMPTY');
    err.source = 'max-upload';
    throw err;
  }

  const { url, token: preToken } = await request('POST', '/uploads', {
    params: { type: 'audio' },
  });

  if (!preToken) {
    const err = new Error('MAX_UPLOAD_NO_TOKEN');
    err.source = 'max-upload';
    throw err;
  }

  if (!url) {
    console.warn('[max-upload] no CDN url, using preToken only');
    return preToken;
  }

  await uploadToCdn(url, buffer);
  return preToken;
}

async function sendAudio(target, buffer, caption = '') {
  const token = await uploadAudio(buffer);
  const attachment = { type: 'audio', payload: { token } };
  const { sendMessage } = require('./client');

  for (let attempt = 0; attempt <= READY_RETRIES; attempt++) {
    try {
      return await sendMessage(target, {
        text: caption,
        attachments: [attachment],
      });
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'attachment.not.ready' && attempt < READY_RETRIES) {
        await sleep(READY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

module.exports = { uploadAudio, sendAudio };
