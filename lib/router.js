const { getRecipient, getMessageText, parseCommand } = require('./utils/update');
const { handleCommand, sendStart } = require('./handlers/commands');
const { handleCallback } = require('./handlers/callbacks');
const { handleTTS } = require('./handlers/tts');
const { sendMessage } = require('./max/client');
const { mainMenuKeyboard } = require('./texts/messages');

async function routeUpdate(update) {
  const type = update.update_type;
  const target = getRecipient(update);

  if (type === 'bot_started') {
    if (target.chatId != null || target.userId != null) {
      await sendStart(target);
    } else {
      console.error('[router] bot_started без chat_id/user_id');
    }
    return;
  }

  if (type === 'message_callback') {
    await handleCallback(update);
    return;
  }

  if (type === 'message_created') {
    const text = getMessageText(update);
    if ((target.chatId == null && target.userId == null) || !text) return;

    const cmd = parseCommand(text);
    if (cmd) {
      const handled = await handleCommand(target, cmd);
      if (handled) return;
      await sendMessage(target, {
        text: 'Неизвестная команда. Список: /help',
        attachments: [mainMenuKeyboard()],
      });
      return;
    }

    await handleTTS(target, text);
    return;
  }

  console.log('[router] ignored update_type:', type);
}

async function routeUpdateSafe(update) {
  const target = getRecipient(update);

  try {
    await routeUpdate(update);
  } catch (err) {
    console.error('[router]', err.message, err.response?.data);
    if (target.chatId != null || target.userId != null) {
      try {
        await sendMessage(target, {
          text: '⚠️ Не получилось обработать запрос. Попробуй ещё раз.',
          attachments: [mainMenuKeyboard()],
        });
      } catch (sendErr) {
        console.error('[router] failed to notify user:', sendErr.message);
      }
    }
  }
}

module.exports = { routeUpdate, routeUpdateSafe };
