const { routeUpdateSafe } = require('../lib/router');
const { wasProcessed, markProcessed } = require('../lib/storage/idempotency');

function verifySecret(req) {
  const expected = process.env.MAX_WEBHOOK_SECRET;
  if (!expected) return true;
  const received =
    req.headers['x-max-bot-api-secret'] ||
    req.headers['X-Max-Bot-Api-Secret'];
  return received === expected;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'max-gemini-tts-bot',
      version: '1.0.0',
      hint: 'POST сюда шлёт MAX; подписка: POST platform-api.max.ru/subscriptions',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!verifySecret(req)) {
    console.error('[webhook] 401: неверный X-Max-Bot-Api-Secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const update = req.body;
  if (!update?.update_type) {
    console.error('[webhook] 400: нет update_type');
    return res.status(400).json({ error: 'Invalid update' });
  }

  console.log('[webhook]', update.update_type);

  try {
    if (await wasProcessed(update)) {
      console.log('[webhook] duplicate skipped');
      return res.status(200).json({ ok: true, duplicate: true });
    }

    await routeUpdateSafe(update);
    await markProcessed(update);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook]', err);
    return res.status(200).json({ ok: true, error: 'handler_failed' });
  }
};
