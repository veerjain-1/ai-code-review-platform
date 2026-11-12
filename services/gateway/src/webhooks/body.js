const express = require('express');
const crypto = require('crypto');

// Install before the general JSON parser so HMAC verification sees exact bytes.
const parseWebhookBody = express.json({
  limit: '10mb',
  verify(req, _res, body) {
    req.rawBody = body;
  },
});

function isValidGitHubSignature(body, signature, secret) {
  if (!Buffer.isBuffer(body) || typeof signature !== 'string' || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) {
    return false;
  }
  const supplied = Buffer.from(signature.slice(7), 'hex');
  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  return crypto.timingSafeEqual(supplied, expected);
}

module.exports = { parseWebhookBody, isValidGitHubSignature };
