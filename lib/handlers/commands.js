const { sendMessage, sendMessageWithFallback } = require('../max/client');
const { getStorageKey } = require('../utils/update');
const {
  WELCOME,
  HELP,
  mainMenuKeyboard,
  voiceMenuKeyboard,
  settingsMenuKeyboard,
  formatSettings,
} = require('../texts/messages');
const { getSettings, updateSettings } = require('../storage/settings');
const { LIMITS } = require('../config');

async function sendStart(target) {
  await sendMessageWithFallback(target, [
    { text: WELCOME, format: 'markdown', attachments: [mainMenuKeyboard()] },
    { text: WELCOME, attachments: [mainMenuKeyboard()] },
    {
      text: 'Голосовой бот (Gemini TTS). Отправь текст — озвучу. Команды: /help /voice /settings',
    },
  ]);
}

async function sendHelp(target) {
  await sendMessage(target, { text: HELP, attachments: [mainMenuKeyboard()] });
}

async function sendVoiceMenu(target) {
  await sendMessage(target, {
    text: '**Выбери голос**',
    attachments: [voiceMenuKeyboard(0)],
  });
}

async function sendSettings(target) {
  const key = getStorageKey(target);
  const settings = await getSettings(key);
  await sendMessage(target, {
    text: formatSettings(settings),
    attachments: [settingsMenuKeyboard()],
  });
}

async function handleCommand(target, cmd) {
  const key = getStorageKey(target);

  switch (cmd.command) {
    case '/start':
      await sendStart(target);
      return true;
    case '/help':
      await sendHelp(target);
      return true;
    case '/voice':
      await sendVoiceMenu(target);
      return true;
    case '/settings':
    case '/currentvoice':
      await sendSettings(target);
      return true;
    case '/scene': {
      const text = cmd.args?.trim();
      if (!text) {
        await sendMessage(target, {
          text: `Укажи сцену после команды, до ${LIMITS.sceneChars} символов.\nПример: /scene Тихий вечер у камина`,
          attachments: [mainMenuKeyboard()],
        });
        return true;
      }
      const settings = await updateSettings(key, {
        customScene: text.slice(0, LIMITS.sceneChars),
      });
      await sendMessage(target, {
        text: `✅ Своя сцена сохранена.\n\n${formatSettings(settings)}`,
        attachments: [settingsMenuKeyboard()],
      });
      return true;
    }
    case '/context': {
      const text = cmd.args?.trim();
      if (!text) {
        await sendMessage(target, {
          text: `Укажи контекст после команды, до ${LIMITS.contextChars} символов.\nПример: /context Друг весело рассказывает историю`,
          attachments: [mainMenuKeyboard()],
        });
        return true;
      }
      const settings = await updateSettings(key, {
        customContext: text.slice(0, LIMITS.contextChars),
      });
      await sendMessage(target, {
        text: `✅ Свой контекст сохранён.\n\n${formatSettings(settings)}`,
        attachments: [settingsMenuKeyboard()],
      });
      return true;
    }
    default:
      return false;
  }
}

module.exports = { handleCommand, sendStart, sendHelp, sendVoiceMenu, sendSettings };
