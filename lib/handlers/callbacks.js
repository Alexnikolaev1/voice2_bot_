const { answerCallback, sendMessage } = require('../max/client');
const { getRecipient, getStorageKey } = require('../utils/update');
const { getSettings, updateSettings } = require('../storage/settings');
const { VOICES } = require('../voices');
const { STYLES, PACES, SCENES, CONTEXTS } = require('../config');
const {
  WELCOME,
  HELP,
  mainMenuKeyboard,
  voiceMenuKeyboard,
  settingsMenuKeyboard,
  styleMenuKeyboard,
  sceneMenuKeyboard,
  contextMenuKeyboard,
  formatSettings,
  voiceChanged,
  settingChanged,
} = require('../texts/messages');

async function handleCallback(update) {
  const target = getRecipient(update);
  const storageKey = getStorageKey(target);
  const payload = update.callback?.payload;
  const callbackId = update.callback?.callback_id;

  if (!storageKey || !payload || !callbackId) return;

  if (payload === 'noop') {
    await answerCallback(callbackId, { notification: ' ' });
    return;
  }

  if (payload === 'menu:main') {
    await answerCallback(callbackId, { notification: 'Главное меню' });
    await sendMessage(target, { text: WELCOME, attachments: [mainMenuKeyboard()] });
    return;
  }

  if (payload === 'menu:help') {
    await answerCallback(callbackId, { notification: 'Справка' });
    await sendMessage(target, { text: HELP, attachments: [mainMenuKeyboard()] });
    return;
  }

  if (payload === 'menu:voices') {
    await answerCallback(callbackId, { notification: 'Выбор голоса' });
    await sendMessage(target, {
      text: '**Выбери голос** (Gemini TTS)',
      format: 'markdown',
      attachments: [voiceMenuKeyboard(0)],
    });
    return;
  }

  if (payload.startsWith('voicepage:')) {
    const page = parseInt(payload.slice(10), 10) || 0;
    await answerCallback(callbackId, { notification: `Стр. ${page + 1}` });
    await sendMessage(target, {
      text: '**Выбери голос**',
      format: 'markdown',
      attachments: [voiceMenuKeyboard(page)],
    });
    return;
  }

  if (payload === 'menu:settings') {
    const settings = await getSettings(storageKey);
    await answerCallback(callbackId, { notification: 'Настройки' });
    await sendMessage(target, {
      text: formatSettings(settings),
      attachments: [settingsMenuKeyboard()],
    });
    return;
  }

  if (payload === 'menu:style') {
    await answerCallback(callbackId, { notification: 'Стиль и темп' });
    await sendMessage(target, {
      text: '**Стиль и темп речи**',
      format: 'markdown',
      attachments: [styleMenuKeyboard()],
    });
    return;
  }

  if (payload === 'menu:scene') {
    await answerCallback(callbackId, { notification: 'Сцена' });
    await sendMessage(target, {
      text: '**Сцена** — общая обстановка',
      format: 'markdown',
      attachments: [sceneMenuKeyboard()],
    });
    return;
  }

  if (payload === 'menu:context') {
    await answerCallback(callbackId, { notification: 'Контекст' });
    await sendMessage(target, {
      text: '**Контекст** — как подаётся речь',
      format: 'markdown',
      attachments: [contextMenuKeyboard()],
    });
    return;
  }

  if (payload.startsWith('voice:')) {
    const voiceId = payload.slice(6);
    if (!VOICES[voiceId]) {
      await answerCallback(callbackId, { notification: 'Неизвестный голос' });
      return;
    }
    await updateSettings(storageKey, { voice: voiceId });
    await answerCallback(callbackId, { notification: VOICES[voiceId].name });
    await sendMessage(target, {
      text: voiceChanged(`${VOICES[voiceId].name} — ${VOICES[voiceId].trait}`),
      attachments: [mainMenuKeyboard()],
    });
    return;
  }

  if (payload.startsWith('style:')) {
    const styleKey = payload.slice(6);
    if (!STYLES[styleKey]) return;
    const settings = await updateSettings(storageKey, { styleKey });
    await answerCallback(callbackId, { notification: STYLES[styleKey].label });
    await sendMessage(target, {
      text: `${settingChanged(`Стиль: ${STYLES[styleKey].label}`)}\n\n${formatSettings(settings)}`,
      attachments: [settingsMenuKeyboard()],
    });
    return;
  }

  if (payload.startsWith('pace:')) {
    const paceKey = payload.slice(5);
    if (!PACES[paceKey]) return;
    const settings = await updateSettings(storageKey, { paceKey });
    await answerCallback(callbackId, { notification: PACES[paceKey].label });
    await sendMessage(target, {
      text: `${settingChanged(`Темп: ${PACES[paceKey].label}`)}\n\n${formatSettings(settings)}`,
      attachments: [settingsMenuKeyboard()],
    });
    return;
  }

  if (payload.startsWith('scene:')) {
    const key = payload.slice(6);
    if (key === 'reset') {
      const settings = await updateSettings(storageKey, { customScene: null });
      await answerCallback(callbackId, { notification: 'Сцена сброшена' });
      await sendMessage(target, {
        text: `${settingChanged('Сцена: пресет')}\n\n${formatSettings(settings)}`,
        attachments: [settingsMenuKeyboard()],
      });
      return;
    }
    if (!SCENES[key]) return;
    const settings = await updateSettings(storageKey, { sceneKey: key, customScene: null });
    await answerCallback(callbackId, { notification: SCENES[key].label });
    await sendMessage(target, {
      text: `${settingChanged(`Сцена: ${SCENES[key].label}`)}\n\n${formatSettings(settings)}`,
      attachments: [settingsMenuKeyboard()],
    });
    return;
  }

  if (payload.startsWith('context:')) {
    const key = payload.slice(8);
    if (key === 'reset') {
      const settings = await updateSettings(storageKey, { customContext: null });
      await answerCallback(callbackId, { notification: 'Контекст сброшен' });
      await sendMessage(target, {
        text: `${settingChanged('Контекст: пресет')}\n\n${formatSettings(settings)}`,
        attachments: [settingsMenuKeyboard()],
      });
      return;
    }
    if (!CONTEXTS[key]) return;
    const settings = await updateSettings(storageKey, { contextKey: key, customContext: null });
    await answerCallback(callbackId, { notification: CONTEXTS[key].label });
    await sendMessage(target, {
      text: `${settingChanged(`Контекст: ${CONTEXTS[key].label}`)}\n\n${formatSettings(settings)}`,
      attachments: [settingsMenuKeyboard()],
    });
  }
}

module.exports = { handleCallback };
