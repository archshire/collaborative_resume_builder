const dns = require('node:dns').promises;
const ipaddr = require('ipaddr.js');

// Accept localhost by default and one explicitly configured public origin when hosted.
function checkLocalRequest(req, { publicOrigin = '' } = {}) {
  const port = req.socket.localPort;
  const allowed = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
  let configuredOrigin = '';
  if (publicOrigin) {
    try {
      const parsed = new URL(publicOrigin);
      if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) return 500;
      allowed.add(parsed.host);
      configuredOrigin = parsed.origin;
    } catch { return 500; }
  }
  const host = req.headers.host;
  if (!allowed.has(host)) return 403;
  const expectedOrigin = configuredOrigin && host === new URL(configuredOrigin).host ? configuredOrigin : `http://${host}`;
  if (req.headers.origin && req.headers.origin !== expectedOrigin) return 403;
  if (configuredOrigin && host === new URL(configuredOrigin).host && req.method === 'POST' && !req.headers.origin) return 403;
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return 403;
  if (req.method === 'POST') {
    if (req.headers['x-resume-client'] !== '1') return 403;
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return 415;
  }
  return 0;
}

function isPublicAddress(address) {
  try {
    // Reject mapped addresses as well as all special-purpose ranges.
    return ipaddr.parse(address).range() === 'unicast';
  } catch {
    return false;
  }
}

async function resolvePublicUrl(value, lookup = dns.lookup) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80'))) {
    throw new Error('Only public HTTP(S) links on standard ports are supported.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let timer;
  const records = await Promise.race([
    lookup(hostname, { all: true, verbatim: true }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS lookup timed out.')), 5000); }),
  ]).finally(() => clearTimeout(timer));
  if (!records.length || records.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Private and special-purpose network addresses are not allowed.');
  }
  // Pin the checked address for the socket: a second DNS lookup would permit rebinding.
  return { url, address: records[0].address, family: records[0].family };
}
module.exports = { checkLocalRequest, isPublicAddress, resolvePublicUrl };
