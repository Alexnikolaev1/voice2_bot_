const { sendMessage } = require('../max/client');
const { sendAudio, sendAudioAsFile } = require('../max/uploads');
const { synthesize, mapGeminiError } = require('../tts/gemini');
const { getSettings } = require('../storage/settings');
const { getStorageKey } = require('../utils/update');
const { LIMITS } = require('../config');
const { mainMenuKeyboard } = require('../texts/messages');

async function handleTTS(target, text) {
  const storageKey = getStorageKey(target);

  if (text.length < LIMITS.minTextChars) {
    await sendMessage(target, {
      text: 'Напиши текст для озвучки — хотя бы одно слово.',
      attachments: [mainMenuKeyboard()],
    });
    return;
  }

  let finalText = text;
  let truncated = false;

  if (text.length > LIMITS.ttsChars) {
    finalText = text.slice(0, LIMITS.ttsChars);
    truncated = true;
  }

  await sendMessage(target, { text: '⏳ Синтезирую…' });

  const started = Date.now();

  try {
    const settings = await getSettings(storageKey);

    let audio;
    try {
      audio = await synthesize(finalText, settings);
      console.log('[tts] gemini ok', {
        ms: Date.now() - started,
        bytes: audio.length,
        chars: finalText.length,
      });
    } catch (err) {
      err.step = 'gemini';
      err.source = err.source || 'gemini';
      throw err;
    }

    try {
      await sendAudio(target, audio);
      try {
        await sendAudioAsFile(target, audio);
      } catch (fileErr) {
        console.warn('[tts] file copy failed:', fileErr.status || fileErr.code || fileErr.message);
      }
      console.log('[tts] done', { ms: Date.now() - started });
    } catch (err) {
      err.step = 'upload';
      err.source = err.source || 'max-upload';
      throw err;
    }

    if (truncated) {
      await sendMessage(target, {
        text: `⚠️ Текст обрезан до **${LIMITS.ttsChars}** символов (лимит Gemini TTS).`,
        format: 'markdown',
      });
    }
  } catch (err) {
    const detail = err.body || err.message;
    console.error(
      '[tts]',
      err.step || err.source || 'unknown',
      err.status || err.code || err.message,
      typeof detail === 'string' ? detail.slice(0, 300) : detail,
      { ms: Date.now() - started }
    );
    await sendMessage(target, {
      text: `⚠️ ${mapGeminiError(err)}`,
      attachments: [mainMenuKeyboard()],
    });
  }
}

module.exports = { handleTTS };
