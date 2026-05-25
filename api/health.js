module.exports = function handler(_req, res) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  let hint;
  if (!apiKey) {
    hint = 'Задайте GEMINI_API_KEY в Vercel (ключ из Google AI Studio).';
  } else if (apiKey.length < 20) {
    hint = 'GEMINI_API_KEY выглядит слишком коротким.';
  }

  res.status(200).json({
    ok: true,
    service: 'max-gemini-tts-bot',
    version: '1.0.0',
    model: 'gemini-3.1-flash-tts-preview',
    checks: {
      maxToken: Boolean(process.env.MAX_BOT_TOKEN),
      geminiKeyPresent: Boolean(apiKey),
      geminiKeyLooksValid: apiKey.length >= 20,
      geminiReady: Boolean(apiKey) && apiKey.length >= 20,
    },
    hint,
  });
};
