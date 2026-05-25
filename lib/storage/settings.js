const { DEFAULTS, STYLES, PACES, SCENES, CONTEXTS, LIMITS } = require('../config');
const { isValidVoice } = require('../voices');

let kv;
const memory = new Map();

async function getStore() {
  if (kv !== undefined) return kv;
  try {
    kv = await import('@vercel/kv').then((m) => m.kv);
  } catch {
    kv = null;
  }
  return kv;
}

function normalize(raw) {
  const voice = isValidVoice(raw?.voice) ? raw.voice : DEFAULTS.voice;
  const styleKey = raw?.styleKey in STYLES ? raw.styleKey : DEFAULTS.styleKey;
  const paceKey = raw?.paceKey in PACES ? raw.paceKey : DEFAULTS.paceKey;
  const sceneKey = raw?.sceneKey in SCENES ? raw.sceneKey : DEFAULTS.sceneKey;
  const contextKey = raw?.contextKey in CONTEXTS ? raw.contextKey : DEFAULTS.contextKey;

  const customScene =
    typeof raw?.customScene === 'string' && raw.customScene.trim()
      ? raw.customScene.trim().slice(0, LIMITS.sceneChars)
      : null;
  const customContext =
    typeof raw?.customContext === 'string' && raw.customContext.trim()
      ? raw.customContext.trim().slice(0, LIMITS.contextChars)
      : null;

  return {
    voice,
    styleKey,
    paceKey,
    sceneKey,
    contextKey,
    customScene,
    customContext,
  };
}

async function getSettings(chatId) {
  const key = `user:${chatId}`;

  try {
    const store = await getStore();
    if (store) {
      const raw = await store.get(key);
      return normalize(typeof raw === 'object' ? raw : null);
    }
  } catch (err) {
    console.warn('[settings] KV read failed:', err.message);
  }

  return normalize(memory.get(key));
}

async function updateSettings(chatId, patch) {
  const current = await getSettings(chatId);
  const next = normalize({
    voice: patch.voice ?? current.voice,
    styleKey: patch.styleKey ?? current.styleKey,
    paceKey: patch.paceKey ?? current.paceKey,
    sceneKey: patch.sceneKey ?? current.sceneKey,
    contextKey: patch.contextKey ?? current.contextKey,
    customScene: patch.customScene !== undefined ? patch.customScene : current.customScene,
    customContext: patch.customContext !== undefined ? patch.customContext : current.customContext,
  });

  const stored = {
    voice: next.voice,
    styleKey: next.styleKey,
    paceKey: next.paceKey,
    sceneKey: next.sceneKey,
    contextKey: next.contextKey,
    customScene: next.customScene,
    customContext: next.customContext,
  };

  const key = `user:${chatId}`;

  try {
    const store = await getStore();
    if (store) {
      await store.set(key, stored, { ex: 60 * 60 * 24 * 365 });
      return next;
    }
  } catch (err) {
    console.warn('[settings] KV write failed:', err.message);
  }

  memory.set(key, stored);
  return next;
}

module.exports = { getSettings, updateSettings };
