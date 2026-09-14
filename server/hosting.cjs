const crypto = require('node:crypto');

const SESSION_COOKIE = 'crb_demo_session';

function safeEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function cookieValue(header, name) {
  for (const item of String(header || '').split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return '';
}

function createDemoAccess(password, { secure = false, sessionHours = 8 } = {}) {
  const required = Boolean(password);
  const token = crypto.randomBytes(32).toString('base64url');
  const cookie = (value, maxAge) => [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : '',
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join('; ');
  return {
    required,
    authenticated(req) {
      return !required || safeEqual(cookieValue(req.headers.cookie, SESSION_COOKIE), token);
    },
    login(candidate) {
      return required && safeEqual(candidate, password) ? cookie(token, Math.max(1, sessionHours) * 3600) : '';
    },
    logoutCookie() {
      return cookie('', 0);
    },
    rateKey(req) {
      return cookieValue(req.headers.cookie, SESSION_COOKIE) || req.socket.remoteAddress || 'unknown';
    },
  };
}

function createFixedWindowLimiter({ limit = 30, windowMs = 10 * 60 * 1000 } = {}) {
  const buckets = new Map();
  return function consume(key, now = Date.now()) {
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count <= limit ? { allowed: true, remaining: limit - bucket.count }
      : { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  };
}

module.exports = { createDemoAccess, createFixedWindowLimiter, safeEqual };
