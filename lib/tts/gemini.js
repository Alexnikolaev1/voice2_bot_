const https = require('https');
const axios = require('axios');
const { GEMINI_API_URL, GEMINI_MODEL, GEMINI_TTS_TIMEOUT_MS, DEFAULTS } = require('../config');
const { isValidVoice } = require('../voices');
const { STYLES, PACES, SCENES, CONTEXTS } = require('../config');
const { withNetworkRetry, isRetryableNetworkError } = require('../http/retry');

const geminiAgent = new https.Agent({ keepAlive: true, maxSockets: 4 });

function getApiKey() {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function buildPrompt(text, settings) {
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

  return `Read the following transcript aloud based on the director's note.

# Director's note
Style: ${style}. Pace: ${pace}. Accent: Neutral.

## Scene:
${scene}

## Sample Context:
${context}

## Transcript:
${text}`;
}

function buildRequestBody(prompt, voiceName) {
  return {
    model: GEMINI_MODEL,
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

function makeGeminiError(status, body) {
  const err = new Error(`GEMINI_TTS_${status}`);
  err.source = 'gemini';
  err.status = status;
  err.body = body;
  throw err;
}

async function callGemini(apiKey, requestBody) {
  const apiUrl = `${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`;
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
    { label: 'gemini-tts', retries: 2, delayMs: 1200 }
  );

  if (response.status !== 200) {
    const body = formatResponseBody(response.data);
    console.error(`[gemini-tts] ${response.status}:`, body);
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
  const prompt = buildPrompt(text, settings);
  const requestBody = buildRequestBody(prompt, voiceName);

  try {
    return await callGemini(apiKey, requestBody);
  } catch (err) {
    const retryable =
      err.status === 500 ||
      err.code === 'GEMINI_NO_AUDIO' ||
      isRetryableNetworkError(err);
    if (!retryable) throw err;
    console.warn('[gemini-tts] second attempt after', err.status || err.code || err.message);
    await new Promise((r) => setTimeout(r, 800));
    return callGemini(apiKey, requestBody);
  }
}

function mapGeminiError(err) {
  if (err.source === 'max-upload') {
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
    return 'Ошибка формата запроса к Gemini TTS. Проверьте **GEMINI_API_KEY** и redeploy после обновления бота.';
  }
  if (status === 429) {
    return 'Слишком много запросов к Gemini — подождите минуту.';
  }
  if (status === 503 || status === 500) {
    return 'Сервис Gemini временно недоступен. Попробуйте позже.';
  }

  if (
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'NETWORK_ERROR' ||
    (err.message && err.message.includes('socket hang up'))
  ) {
    return 'Соединение с Gemini оборвалось. Отправьте **короче текст** (1–2 предложения) или повторите через минуту.';
  }

  return 'Не удалось синтезировать речь. Попробуйте позже.';
}

module.exports = { synthesize, mapGeminiError, buildPrompt };
