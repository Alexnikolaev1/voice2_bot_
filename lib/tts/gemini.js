const axios = require('axios');
const { GEMINI_API_URL } = require('../config');
const { isValidVoice } = require('../voices');
const { STYLES, PACES, SCENES, CONTEXTS, DEFAULTS } = require('../config');

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

  return `Read the following transcript based on the director's note.

# Director's note
Style: ${style}. Pace: ${pace}. Accent: Neutral.

## Scene:
${scene}

## Sample Context:
${context}

## Transcript:
${text}`;
}

function parseAudioMimeType(mimeType) {
  let bitsPerSample = 16;
  let rate = 24000;

  for (const param of mimeType.split(';')) {
    const p = param.trim();
    if (p.toLowerCase().startsWith('rate=')) {
      const n = parseInt(p.split('=')[1], 10);
      if (!Number.isNaN(n)) rate = n;
    } else if (p.startsWith('audio/L')) {
      const n = parseInt(p.split('L')[1], 10);
      if (!Number.isNaN(n)) bitsPerSample = n;
    }
  }

  return { bitsPerSample, rate };
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

    if (!mimeType.includes('wav') && !mimeType.includes('WAV')) {
      raw = pcmToWav(raw, mimeType);
    }

    return raw;
  }

  return null;
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
    err.code = 'GEMINI_API_KEY_MISSING';
    throw err;
  }

  const voiceName = isValidVoice(settings.voice) ? settings.voice : DEFAULTS.voice;
  const prompt = buildPrompt(text, settings);

  const response = await axios.post(
    GEMINI_API_URL,
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 1,
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      timeout: 28000,
      validateStatus: () => true,
    }
  );

  if (response.status !== 200) {
    const body =
      typeof response.data === 'object'
        ? JSON.stringify(response.data).slice(0, 500)
        : String(response.data).slice(0, 500);
    console.error(`[gemini-tts] ${response.status}:`, body);

    const err = new Error(`GEMINI_TTS_${response.status}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  const audio = extractAudioBuffer(response.data);
  if (!audio) {
    const err = new Error('GEMINI_NO_AUDIO');
    err.code = 'GEMINI_NO_AUDIO';
    throw err;
  }

  return audio;
}

function mapGeminiError(err) {
  if (err.code === 'GEMINI_API_KEY_MISSING') {
    return 'Не задан **GEMINI_API_KEY** в настройках Vercel.';
  }
  if (err.code === 'GEMINI_NO_AUDIO') {
    return 'Модель не вернула аудио. Попробуйте короче текст или другой голос.';
  }

  const status = err.status;
  const body = err.body || '';

  if (status === 400) {
    if (body.includes('API_KEY_INVALID') || body.includes('API key not valid')) {
      return 'Неверный **GEMINI_API_KEY**. Создайте ключ в [Google AI Studio](https://aistudio.google.com/apikey).';
    }
    return 'Текст или настройки не подходят для Gemini TTS.';
  }
  if (status === 401 || status === 403) {
    return 'Нет доступа к Gemini API. Проверьте ключ и включённый биллинг/квоту.';
  }
  if (status === 429) {
    return 'Слишком много запросов к Gemini — подождите минуту.';
  }
  if (status === 503 || status === 500) {
    return 'Сервис Gemini временно недоступен. Попробуйте позже.';
  }

  return 'Не удалось синтезировать речь. Попробуйте позже.';
}

module.exports = { synthesize, mapGeminiError, buildPrompt };
