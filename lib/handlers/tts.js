const { sendMessage } = require('../max/client');
const { sendAudio } = require('../max/uploads');
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

  try {
    const settings = await getSettings(storageKey);
    const audio = await synthesize(finalText, settings);
    await sendAudio(target, audio);

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
      err.source || 'unknown',
      err.status || err.code || err.message,
      typeof detail === 'string' ? detail.slice(0, 300) : detail
    );
    await sendMessage(target, {
      text: `⚠️ ${mapGeminiError(err)}`,
      attachments: [mainMenuKeyboard()],
    });
  }
}

module.exports = { handleTTS };
