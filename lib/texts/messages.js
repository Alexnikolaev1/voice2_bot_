const { VOICES, formatVoiceLabel, getVoicePageIds, getVoicePageCount } = require('../voices');
const { STYLES, PACES, SCENES, CONTEXTS, LIMITS, VOICES_PER_PAGE } = require('../config');
const { callbackBtn, row, inlineKeyboard } = require('../max/keyboard');

const WELCOME = `**Голосовой бот** 🎧

Отправь любой текст — озвучу голосом **Gemini 3.1 Flash TTS**.

Настрой голос, стиль, темп, сцену и контекст в меню ниже.`;

const HELP = `**Как пользоваться**

• Напиши текст — получишь аудио
• Лимит: **${LIMITS.ttsChars}** символов за раз
• Команды: /start · /settings · /voice · /help

**Голоса:** 30 вариантов Gemini TTS
**Стиль и темп:** как в AI Studio (Director's note)
**Сцена и контекст:** задают настроение озвучки

**Свои тексты сцены/контекста:**
/scene ваш текст сцены
/context ваш контекст доставки`;

function mainMenuKeyboard() {
  return inlineKeyboard([
    row(callbackBtn('🎤 Голос', 'menu:voices'), callbackBtn('⚙️ Настройки', 'menu:settings')),
    row(callbackBtn('🎭 Стиль', 'menu:style'), callbackBtn('🌍 Сцена', 'menu:scene')),
    row(callbackBtn('ℹ️ Помощь', 'menu:help')),
  ]);
}

function voiceMenuKeyboard(page = 0) {
  const ids = getVoicePageIds(page, VOICES_PER_PAGE);
  const buttons = ids.map((id) => callbackBtn(formatVoiceLabel(id), `voice:${id}`));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  const totalPages = getVoicePageCount(VOICES_PER_PAGE);
  const nav = [];
  if (page > 0) nav.push(callbackBtn('◀️', `voicepage:${page - 1}`));
  nav.push(callbackBtn(`${page + 1}/${totalPages}`, 'noop'));
  if (page < totalPages - 1) nav.push(callbackBtn('▶️', `voicepage:${page + 1}`));
  rows.push(nav);
  rows.push([callbackBtn('← Назад', 'menu:main')]);

  return inlineKeyboard(rows);
}

function settingsMenuKeyboard() {
  return inlineKeyboard([
    row(callbackBtn('🎤 Сменить голос', 'menu:voices'), callbackBtn('🎭 Стиль', 'menu:style')),
    row(callbackBtn('🌍 Сцена', 'menu:scene'), callbackBtn('💬 Контекст', 'menu:context')),
    row(callbackBtn('← Главное меню', 'menu:main')),
  ]);
}

function styleMenuKeyboard() {
  const styleKeys = Object.keys(STYLES);
  const rows = [];
  for (let i = 0; i < styleKeys.length; i += 2) {
    const pair = styleKeys.slice(i, i + 2).map((k) => callbackBtn(STYLES[k].label, `style:${k}`));
    rows.push(pair);
  }
  rows.push(
    row(
      callbackBtn('🐢 Медл.', 'pace:slow'),
      callbackBtn('⚡ Обычно', 'pace:normal'),
      callbackBtn('🚀 Быстро', 'pace:fast')
    )
  );
  rows.push([callbackBtn('← Настройки', 'menu:settings')]);
  return inlineKeyboard(rows);
}

function sceneMenuKeyboard() {
  const rows = Object.entries(SCENES).map(([k, v]) => [callbackBtn(v.label, `scene:${k}`)]);
  rows.push([callbackBtn('↩️ Сброс сцены', 'scene:reset')]);
  rows.push([callbackBtn('← Настройки', 'menu:settings')]);
  return inlineKeyboard(rows);
}

function contextMenuKeyboard() {
  const rows = Object.entries(CONTEXTS).map(([k, v]) => [callbackBtn(v.label, `context:${k}`)]);
  rows.push([callbackBtn('↩️ Сброс контекста', 'context:reset')]);
  rows.push([callbackBtn('← Настройки', 'menu:settings')]);
  return inlineKeyboard(rows);
}

function formatSettings(settings) {
  const voice = VOICES[settings.voice];
  const voiceLabel = voice ? `${voice.name} (${voice.trait})` : settings.voice;
  const styleLabel = STYLES[settings.styleKey]?.label || settings.styleKey;
  const paceLabel = PACES[settings.paceKey]?.label || settings.paceKey;
  const sceneLabel = settings.customScene
    ? `своя: ${settings.customScene.slice(0, 40)}…`
    : SCENES[settings.sceneKey]?.label || settings.sceneKey;
  const contextLabel = settings.customContext
    ? `свой: ${settings.customContext.slice(0, 40)}…`
    : CONTEXTS[settings.contextKey]?.label || settings.contextKey;

  return (
    `**Твои настройки**\n\n` +
    `🎤 Голос: **${voiceLabel}**\n` +
    `🎭 Стиль: **${styleLabel}**\n` +
    `⏱ Темп: **${paceLabel}**\n` +
    `🌍 Сцена: **${sceneLabel}**\n` +
    `💬 Контекст: **${contextLabel}**`
  );
}

function voiceChanged(name) {
  return `✅ Голос: **${name}**\n\nОтправь текст — озвучу.`;
}

function settingChanged(label) {
  return `✅ **${label}**`;
}

module.exports = {
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
};
