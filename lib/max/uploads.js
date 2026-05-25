const axios = require('axios');
const FormData = require('form-data');
const { request, getToken } = require('./client');
const { MAX_UPLOAD_TIMEOUT_MS } = require('../config');
const { withNetworkRetry } = require('../http/retry');

const READY_RETRIES = 4;
const READY_DELAY_MS = 400;

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

function uploadHeaders(form, auth) {
  const headers = { ...form.getHeaders() };
  if (auth) headers.Authorization = auth;
  return headers;
}

async function postMultipart(url, buffer, auth) {
  const form = new FormData();
  form.append('data', buffer, { filename: 'voice.wav' });

  return withNetworkRetry(
    () =>
      axios.post(url, form, {
        headers: uploadHeaders(form, auth),
        timeout: MAX_UPLOAD_TIMEOUT_MS,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true,
      }),
    { label: 'max-upload', retries: 1, delayMs: 800 }
  );
}

async function uploadToUrl(url, buffer) {
  const token = getToken();
  const attempts = [
    () => postMultipart(url, buffer, null),
    () => postMultipart(url, buffer, token),
    () => postMultipart(url, buffer, `Bearer ${token}`),
  ];

  let lastStatus;
  let lastBody = '';

  for (const attempt of attempts) {
    const res = await attempt();
    lastStatus = res.status;
    lastBody = formatUploadBody(res.data);
    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }
    if (lastStatus === 415) break;
  }

  let host = 'unknown';
  try {
    host = new URL(url).host;
  } catch {
    /* ignore */
  }

  console.error(`[max-upload] ${lastStatus} host=${host}`, lastBody);
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

  const uploadData = await uploadToUrl(url, buffer);
  const token = uploadData?.token || preToken;
  if (!token) {
    const err = new Error('MAX_UPLOAD_NO_TOKEN');
    err.source = 'max-upload';
    throw err;
  }
  return token;
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
