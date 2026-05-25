function getRecipient(update) {
  const type = update.update_type;

  if (type === 'message_created') {
    const sender = update.message?.sender;
    const recipient = update.message?.recipient;
    return {
      chatId: recipient?.chat_id ?? null,
      userId: sender && !sender.is_bot ? sender.user_id ?? null : null,
    };
  }

  if (type === 'message_callback') {
    return {
      chatId: update.message?.recipient?.chat_id ?? null,
      userId: update.callback?.user?.user_id ?? null,
    };
  }

  if (type === 'bot_started') {
    return {
      chatId: update.chat_id ?? null,
      userId: update.user?.user_id ?? update.user_id ?? null,
    };
  }

  return {
    chatId: update.chat_id ?? update.message?.recipient?.chat_id ?? null,
    userId:
      update.user?.user_id ??
      update.user_id ??
      update.message?.sender?.user_id ??
      update.callback?.user?.user_id ??
      null,
  };
}

function getChatId(update) {
  const { chatId, userId } = getRecipient(update);
  return chatId ?? userId;
}

function getMessageText(update) {
  const text = update.message?.body?.text;
  return typeof text === 'string' ? text.trim() : null;
}

function parseCommand(text) {
  if (!text?.startsWith('/')) return null;
  const [head, ...rest] = text.split(/\s+/);
  const command = head.split('@')[0].toLowerCase();
  return { command, args: rest.join(' ').trim() };
}

function getStorageKey(target) {
  const id = target.userId ?? target.chatId;
  return id != null ? String(id) : null;
}

module.exports = { getRecipient, getChatId, getMessageText, parseCommand, getStorageKey };
