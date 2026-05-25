/** Gemini 3.1 Flash TTS — 30 prebuilt voices */
const VOICES = {
  Zephyr: { name: 'Zephyr', trait: 'Bright', gender: 'female' },
  Puck: { name: 'Puck', trait: 'Upbeat', gender: 'male' },
  Charon: { name: 'Charon', trait: 'Informative', gender: 'male' },
  Kore: { name: 'Kore', trait: 'Firm', gender: 'female' },
  Fenrir: { name: 'Fenrir', trait: 'Excitable', gender: 'male' },
  Leda: { name: 'Leda', trait: 'Youthful', gender: 'female' },
  Orus: { name: 'Orus', trait: 'Firm', gender: 'male' },
  Aoede: { name: 'Aoede', trait: 'Breezy', gender: 'female' },
  Callirrhoe: { name: 'Callirrhoe', trait: 'Easy-going', gender: 'female' },
  Autonoe: { name: 'Autonoe', trait: 'Bright', gender: 'female' },
  Enceladus: { name: 'Enceladus', trait: 'Breathy', gender: 'male' },
  Iapetus: { name: 'Iapetus', trait: 'Clear', gender: 'male' },
  Umbriel: { name: 'Umbriel', trait: 'Easy-going', gender: 'male' },
  Algieba: { name: 'Algieba', trait: 'Smooth', gender: 'male' },
  Despina: { name: 'Despina', trait: 'Smooth', gender: 'female' },
  Erinome: { name: 'Erinome', trait: 'Clear', gender: 'female' },
  Algenib: { name: 'Algenib', trait: 'Gravelly', gender: 'male' },
  Rasalgethi: { name: 'Rasalgethi', trait: 'Informative', gender: 'male' },
  Laomedeia: { name: 'Laomedeia', trait: 'Upbeat', gender: 'female' },
  Achernar: { name: 'Achernar', trait: 'Soft', gender: 'female' },
  Alnilam: { name: 'Alnilam', trait: 'Firm', gender: 'male' },
  Schedar: { name: 'Schedar', trait: 'Even', gender: 'male' },
  Gacrux: { name: 'Gacrux', trait: 'Mature', gender: 'male' },
  Pulcherrima: { name: 'Pulcherrima', trait: 'Forward', gender: 'female' },
  Achird: { name: 'Achird', trait: 'Friendly', gender: 'male' },
  Zubenelgenubi: { name: 'Zubenelgenubi', trait: 'Casual', gender: 'male' },
  Vindemiatrix: { name: 'Vindemiatrix', trait: 'Gentle', gender: 'female' },
  Sadachbia: { name: 'Sadachbia', trait: 'Lively', gender: 'female' },
  Sadaltager: { name: 'Sadaltager', trait: 'Knowledgeable', gender: 'male' },
  Sulafat: { name: 'Sulafat', trait: 'Warm', gender: 'female' },
};

const VOICE_IDS = Object.keys(VOICES);

function isValidVoice(id) {
  return Boolean(VOICES[id]);
}

function voiceIcon(gender) {
  return gender === 'female' ? '🔸' : '🔹';
}

function formatVoiceLabel(id) {
  const v = VOICES[id];
  if (!v) return id;
  return `${voiceIcon(v.gender)} ${v.name}`;
}

function getVoicePageIds(page, perPage) {
  const start = page * perPage;
  return VOICE_IDS.slice(start, start + perPage);
}

function getVoicePageCount(perPage) {
  return Math.ceil(VOICE_IDS.length / perPage);
}

module.exports = {
  VOICES,
  VOICE_IDS,
  isValidVoice,
  voiceIcon,
  formatVoiceLabel,
  getVoicePageIds,
  getVoicePageCount,
};
