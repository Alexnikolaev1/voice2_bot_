const crypto = require('crypto');

/**
 * Multipart body with known Content-Length (required by vu.okcdn.ru / Tomcat).
 * Mirrors max-bot-api-client-go uploads.go
 */
function buildMultipartBody(fileBuffer, filename = 'voice.wav') {
  const boundary = `----MaxUpload${crypto.randomBytes(12).toString('hex')}`;
  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="data"; filename="${filename}"\r\n\r\n`,
    'utf8'
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([header, fileBuffer, footer]);

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
    contentLength: body.length,
  };
}

module.exports = { buildMultipartBody };
