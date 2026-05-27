const https = require('https');
const axios = require('axios');
const {
  GEMINI_MODEL,
  GEMINI_FALLBACK_MODEL,
  geminiTtsApiUrl,
  GEMINI_TTS_TIMEOUT_MS,
  GEMINI_TTS_MAX_RETRIES,
  DEFAULTS,
} = require('../config');
const { isValidVoice } = require('../voices');
const { STYLES, PACES, SCENES, CONTEXTS } = require('../config');
const { withNetworkRetry, isRetryableNetworkError } = require('../http/retry');

const geminiAgent = new https.Agent({ keepAlive: true, maxSockets: 4 });

function getApiKey() {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Styled prompt — director's note (Google TTS guide format). */
function buildStyledPrompt(text, settings) {
  const style = STYLES[settings.styleKey]?.director || STYLES[DEFAULTS.styleKey].director;
  const pace = PACES[settings.paceKey]?.director || PACES[DEFAULTS.paceKey].director;
  const scene =
    settings.customScene ||
    SCENES[settings.sceneKey]?.text ||
    SCENES[DEFAULTS.sceneKey].text;
  const context =
    settings.customContext ||
    CONTEXTS[settings.contextKey]?.text ||
    CONTEXTS[DEFAULTS.contextKey].text;

  return (
    'Read the following transcript aloud as natural speech. ' +
    'Use the director\'s note for delivery only — do not read section titles or labels aloud.\n\n' +
    `Director's note — Style: ${style}. Pace: ${pace}. Accent: Neutral.\n` +
    `Scene: ${scene}\n` +
    `Context: ${context}\n\n` +
    `Transcript to speak:\n${text}`
  );
}

/** Minimal prompt — most reliable for preview TTS (official examples). */
function buildSimplePrompt(text, settings) {
  const styleLabel = STYLES[settings.styleKey]?.label || STYLES[DEFAULTS.styleKey].label;
  const paceLabel = PACES[settings.paceKey]?.label || PACES[DEFAULTS.paceKey].label;
  return `Say the following aloud in a ${styleLabel.toLowerCase()}, ${paceLabel.toLowerCase()} voice:\n\n${text}`;
}

function buildRequestBody(prompt, voiceName, model) {
  return {
    model,
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  };
}

function parseAudioMimeType(mimeType) {
  let bitsPerSample = 16;
  let rate = 24000;
  const lower = mimeType.toLowerCase();

  for (const param of mimeType.split(';')) {
    const p = param.trim();
    if (p.toLowerCase().startsWith('rate=')) {
      const n = parseInt(p.split('=')[1], 10);
      if (!Number.isNaN(n)) rate = n;
    } else if (/^audio\/l\d+/i.test(p)) {
      const n = parseInt(p.split(/l/i)[1], 10);
      if (!Number.isNaN(n)) bitsPerSample = n;
    }
  }

  if (lower.includes('rate=44100')) rate = 44100;
  if (lower.includes('rate=48000')) rate = 48000;

  return { bitsPerSample, rate };
}

function isWavBuffer(buf) {
  return (
    buf.length >= 12 &&
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WAVE'
  );
}

function pcmToWav(audioData, mimeType) {
  const { bitsPerSample, rate } = parseAudioMimeType(mimeType);
  const numChannels = 1;
  const dataSize = audioData.length;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = rate * blockAlign;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, audioData]);
}

function extractAudioBuffer(responseData) {
  const parts = responseData?.candidates?.[0]?.content?.parts;
  if (!parts?.length) return null;

  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (!inline?.data) continue;

    const mimeType = inline.mimeType || inline.mime_type || 'audio/L16;rate=24000';
    let raw = Buffer.from(inline.data, 'base64');

    if (!isWavBuffer(raw)) {
      raw = pcmToWav(raw, mimeType);
    }

    return raw;
  }

  return null;
}

function formatResponseBody(data) {
  if (data == null) return '';
  if (typeof data === 'object') return JSON.stringify(data).slice(0, 800);
  return String(data).slice(0, 800);
}

function isRetryableGeminiError(err) {
  if (!err) return false;
  if (isRetryableNetworkError(err)) return true;
  if (err.code === 'GEMINI_NO_AUDIO') return true;
  const status = err.status;
  return status === 500 || status === 503 || status === 429;
}

function makeGeminiError(status, body) {
  const err = new Error(`GEMINI_TTS_${status}`);
  err.source = 'gemini';
  err.status = status;
  err.body = body;
  throw err;
}

async function callGeminiOnce(apiKey, requestBody, model) {
  const apiUrl = `${geminiTtsApiUrl(model)}?key=${encodeURIComponent(apiKey)}`;
  const payload = JSON.stringify(requestBody);

  const response = await withNetworkRetry(
    () =>
      axios.post(apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'application/json',
        },
        timeout: GEMINI_TTS_TIMEOUT_MS,
        httpsAgent: geminiAgent,
        validateStatus: () => true,
      }),
    { label: 'gemini-tts', retries: 1, delayMs: 800 }
  );

  if (response.status !== 200) {
    const body = formatResponseBody(response.data);
    console.error(`[gemini-tts] ${model} ${response.status}:`, body.slice(0, 200));
    makeGeminiError(response.status, body);
  }

  const audio = extractAudioBuffer(response.data);
  if (!audio?.length) {
    const err = new Error('GEMINI_NO_AUDIO');
    err.source = 'gemini';
    err.code = 'GEMINI_NO_AUDIO';
    throw err;
  }

  return audio;
}

async function callGeminiWithRetries(apiKey, requestBody, model) {
  let lastErr;

  for (let attempt = 0; attempt < GEMINI_TTS_MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(apiKey, requestBody, model);
    } catch (err) {
      lastErr = err;
      if (!isRetryableGeminiError(err) || attempt >= GEMINI_TTS_MAX_RETRIES - 1) {
        throw err;
      }
      const wait = 1000 * (attempt + 1) + Math.floor(Math.random() * 400);
      console.warn(
        `[gemini-tts] ${model} retry ${attempt + 2}/${GEMINI_TTS_MAX_RETRIES} after`,
        err.status || err.code,
        `wait ${wait}ms`
      );
      await sleep(wait);
    }
  }

  throw lastErr;
}

/**
 * @param {string} text
 * @param {object} settings
 * @returns {Promise<Buffer>}
 */
async function synthesize(text, settings) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY_MISSING');
    err.source = 'gemini';
    err.code = 'GEMINI_API_KEY_MISSING';
    throw err;
  }

  const voiceName = isValidVoice(settings.voice) ? settings.voice : DEFAULTS.voice;

  const plans = [
    { model: GEMINI_MODEL, buildPrompt: () => buildStyledPrompt(text, settings), tag: 'styled' },
    { model: GEMINI_MODEL, buildPrompt: () => buildSimplePrompt(text, settings), tag: 'simple' },
    { model: GEMINI_FALLBACK_MODEL, buildPrompt: () => buildSimplePrompt(text, settings), tag: 'fallback' },
  ];

  let lastErr;

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const requestBody = buildRequestBody(plan.buildPrompt(), voiceName, plan.model);

    try {
      const audio = await callGeminiWithRetries(apiKey, requestBody, plan.model);
      if (i > 0) {
        console.log(`[gemini-tts] ok via ${plan.tag} (${plan.model})`);
      }
      return audio;
    } catch (err) {
      lastErr = err;
      if (!isRetryableGeminiError(err) || i >= plans.length - 1) {
        throw err;
      }
      console.warn(`[gemini-tts] switching to ${plans[i + 1].tag} after`, err.status || err.code);
      await sleep(500);
    }
  }

  throw lastErr;
}

function mapGeminiError(err) {
  if (err.source === 'max-upload') {
    if (err.status === 415) {
      return 'Аудио готово, но MAX не принял файл. Обновите бота (redeploy) и попробуйте снова.';
    }
    return 'Аудио синтезировано, но не удалось отправить в MAX. Попробуйте ещё раз.';
  }

  if (err.code === 'GEMINI_API_KEY_MISSING') {
    return 'Не задан **GEMINI_API_KEY** в настройках Vercel.';
  }
  if (err.code === 'GEMINI_NO_AUDIO') {
    return 'Модель не вернула аудио. Попробуйте короче текст или другой голос.';
  }

  const status = err.status || err.response?.status;
  const body = err.body || formatResponseBody(err.response?.data);

  if (status === 400) {
    if (body.includes('API_KEY_INVALID') || body.includes('API key not valid')) {
      return 'Неверный **GEMINI_API_KEY**. Создайте ключ в [Google AI Studio](https://aistudio.google.com/apikey).';
    }
    return 'Текст или настройки не подходят для Gemini TTS.';
  }
  if (status === 401 || status === 403) {
    return 'Нет доступа к Gemini API. Проверьте ключ и квоту в AI Studio.';
  }
  if (status === 415) {
    return 'Ошибка формата запроса к Gemini TTS. Проверьте **GEMINI_API_KEY** и redeploy.';
  }
  if (status === 429) {
    return 'Слишком много запросов к Gemini — подождите минуту.';
  }
  if (status === 503 || status === 500) {
    return 'Gemini TTS временно недоступен (ошибка сервера). Подождите минуту и отправьте **короткий текст** (1–2 предложения).';
  }

  if (
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'NETWORK_ERROR' ||
    (err.message && err.message.includes('socket hang up'))
  ) {
    return 'Соединение с Gemini оборвалось. Отправьте **короче текст** или повторите через минуту.';
  }

  return 'Не удалось синтезировать речь. Попробуйте позже.';
}

module.exports = { synthesize, mapGeminiError, buildStyledPrompt, buildSimplePrompt };
