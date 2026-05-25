const axios = require('axios');
const FormData = require('form-data');
const { request } = require('./client');

const READY_RETRIES = 4;
const READY_DELAY_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadAudio(buffer, filename = 'voice.wav') {
  const { url, token: preToken } = await request('POST', '/uploads', {
    params: { type: 'audio' },
  });

  const form = new FormData();
  form.append('data', buffer, { filename, contentType: 'audio/wav' });

  const uploadRes = await axios.post(url, form, {
    headers: form.getHeaders(),
    timeout: 30000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  const token = uploadRes.data?.token || preToken;
  if (!token) throw new Error('MAX upload: no token in response');
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
