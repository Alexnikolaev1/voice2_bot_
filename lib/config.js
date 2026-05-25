const MAX_API_BASE = process.env.MAX_API_BASE || 'https://platform-api.max.ru';

const MAX_REQUEST_TIMEOUT_MS = 12000;
const MAX_REQUEST_RETRIES = 2;

const GEMINI_MODEL = 'gemini-3.1-flash-tts-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const LIMITS = {
  ttsChars: 4000,
  minTextChars: 1,
  sceneChars: 200,
  contextChars: 300,
};

const DEFAULTS = {
  voice: 'Sulafat',
  styleKey: 'warm',
  paceKey: 'normal',
  sceneKey: 'everyday',
  contextKey: 'friendly',
};

/** Director's note — Style */
const STYLES = {
  warm: {
    label: 'Тёплый',
    director: 'Warm, understanding, soft tone with gentle inflections',
  },
  energetic: {
    label: 'Энергичный',
    director: 'Bright, upbeat, lively delivery with expressive inflections',
  },
  neutral: {
    label: 'Нейтральный',
    director: 'Clear, balanced, natural conversational tone',
  },
  soft: {
    label: 'Мягкий',
    director: 'Soft, calm, gentle tone with relaxed pacing',
  },
  expressive: {
    label: 'Экспрессивный',
    director: 'Dramatic, vivid, emotionally rich narration',
  },
  informative: {
    label: 'Информативный',
    director: 'Clear, measured, professional news-style delivery',
  },
};

/** Director's note — Pace */
const PACES = {
  slow: {
    label: 'Медленный',
    director: 'Slow, deliberate, with clear pauses between phrases',
  },
  normal: {
    label: 'Обычный',
    director: 'Natural conversational pace, balanced rhythm',
  },
  fast: {
    label: 'Быстрый',
    director: 'Fast, energetic, no dead air. Sentences overlap slightly',
  },
};

/** ## Scene */
const SCENES = {
  everyday: { label: 'Повседневность', text: 'Обычный день, спокойная обстановка.' },
  summer: { label: 'Летняя прогулка', text: 'Яркий летний день, прогулка.' },
  evening: { label: 'Вечер дома', text: 'Тихий вечер, уютная домашняя атмосфера.' },
  office: { label: 'Офис', text: 'Деловая обстановка, рабочий разговор.' },
  story: { label: 'Рассказ', text: 'Атмосфера увлекательного рассказа или подкаста.' },
};

/** ## Sample Context */
const CONTEXTS = {
  friendly: {
    label: 'Дружелюбный',
    text: 'Друг рассказывает историю. Тон дружелюбный, воодушевлённый.',
  },
  calm: {
    label: 'Спокойный',
    text: 'Спокойное повествование без лишних эмоций.',
  },
  excited: {
    label: 'Воодушевлённый',
    text: 'Говорящий делится хорошими новостями, тон радостный и живой.',
  },
  formal: {
    label: 'Деловой',
    text: 'Официальное сообщение, сдержанный и чёткий тон.',
  },
  whisper: {
    label: 'Интимный',
    text: 'Тихий, доверительный разговор один на один.',
  },
};

const VOICES_PER_PAGE = 6;

module.exports = {
  MAX_API_BASE,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_RETRIES,
  GEMINI_MODEL,
  GEMINI_API_URL,
  LIMITS,
  DEFAULTS,
  STYLES,
  PACES,
  SCENES,
  CONTEXTS,
  VOICES_PER_PAGE,
};
