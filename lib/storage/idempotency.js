let kv;
const memory = new Map();
const TTL_SEC = 300;

async function getStore() {
  if (kv !== undefined) return kv;
  try {
    kv = await import('@vercel/kv').then((m) => m.kv);
  } catch {
    kv = null;
  }
  return kv;
}

function eventKey(update) {
  const type = update.update_type || 'unknown';
  const mid = update.message?.body?.mid;
  const cb = update.callback?.callback_id;
  const ts = update.timestamp;
  return `${type}:${mid || cb || ts}`;
}

function memoryKey(update) {
  return `evt:${eventKey(update)}`;
}

async function wasProcessed(update) {
  const key = memoryKey(update);

  try {
    const store = await getStore();
    if (store) {
      return Boolean(await store.get(key));
    }
  } catch (err) {
    console.warn('[idempotency] KV read error:', err.message);
  }

  return memory.has(key);
}

async function markProcessed(update) {
  const key = memoryKey(update);

  try {
    const store = await getStore();
    if (store) {
      await store.set(key, 1, { ex: TTL_SEC });
      return;
    }
  } catch (err) {
    console.warn('[idempotency] KV write error:', err.message);
  }

  memory.set(key, Date.now());
  setTimeout(() => memory.delete(key), TTL_SEC * 1000).unref?.();
}

module.exports = { wasProcessed, markProcessed, eventKey };
