const { test } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { checkLocalRequest, isPublicAddress, resolvePublicUrl } = require('../server/security.cjs');
const { fetchPageText } = require('../server/index.cjs');

const local = (headers = {}) => ({ method: 'POST', socket: { localPort: 4173 }, headers: {
  host: 'localhost:4173', origin: 'http://localhost:4173', 'content-type': 'application/json', 'x-resume-client': '1', ...headers,
} });

test('backend accepts the local app and rejects hostile Hosts, origins and simple browser requests', () => {
  assert.equal(checkLocalRequest(local()), 0);
  for (const headers of [{ host: 'attacker.test:4173' }, { origin: 'http://attacker.test' }, { origin: 'null' },
    { origin: 'http://localhost:5173' }, { 'sec-fetch-site': 'cross-site' }, { 'x-resume-client': undefined }]) {
    assert.equal(checkLocalRequest(local(headers)), 403);
  }
  assert.equal(checkLocalRequest(local({ 'content-type': 'text/plain' })), 415);
  assert.equal(checkLocalRequest(local({ origin: undefined })), 0); // trusted local CLI
  assert.equal(checkLocalRequest({ method: 'GET', socket: { localPort: 4173 }, headers: {
    host: 'localhost:4173', 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document',
  }}), 0);
  assert.equal(checkLocalRequest({ method: 'GET', socket: { localPort: 4173 }, headers: {
    host: 'localhost:4173', 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty',
  }}), 403);
});

test('hosted mode accepts only the exact configured HTTPS origin', () => {
  const hosted = local({ host: 'crb-demo.up.railway.app', origin: 'https://crb-demo.up.railway.app' });
  assert.equal(checkLocalRequest(hosted, { publicOrigin: 'https://crb-demo.up.railway.app' }), 0);
  assert.equal(checkLocalRequest(local({ host: 'crb-demo.up.railway.app', origin: undefined }), { publicOrigin: 'https://crb-demo.up.railway.app' }), 403);
  assert.equal(checkLocalRequest(local({ host: 'evil.example', origin: 'https://evil.example' }), { publicOrigin: 'https://crb-demo.up.railway.app' }), 403);
  assert.equal(checkLocalRequest(hosted, { publicOrigin: 'http://crb-demo.up.railway.app' }), 500);
});

test('IPv4/IPv6 private, loopback, metadata, mapped and reserved ranges are blocked', () => {
  for (const ip of ['0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1',
    '192.168.0.1', '192.0.0.170', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::', '::1',
    'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1', '2002:7f00:1::', '64:ff9b::7f00:1', '::ffff:127.0.0.1',
    '::ffff:8.8.8.8', 'invalid']) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111']) assert.equal(isPublicAddress(ip), true, ip);
});

test('URL validation rejects schemes, credentials, ports and mixed public/private DNS', async () => {
  const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
  for (const url of ['file:///etc/passwd', 'ftp://example.com', 'http://user:pass@example.com', 'https://example.com:8443']) {
    await assert.rejects(resolvePublicUrl(url, publicLookup));
  }
  await assert.rejects(resolvePublicUrl('https://example.com', async () => [
    { address: '93.184.216.34', family: 4 }, { address: '::1', family: 6 },
  ]), /not allowed/);
  await assert.rejects(resolvePublicUrl('https://example.com', async () => []));
});

function mockPages(t, pages) {
  const requests = [];
  const request = (options, callback) => {
    requests.push(options);
    const req = new EventEmitter();
    req.end = () => queueMicrotask(() => {
      const page = pages.shift();
      const res = Readable.from((page.chunks || [page.body || '<p>A public job posting</p>']).map(chunk => Buffer.from(chunk)));
      res.statusCode = page.status || 200;
      res.headers = { 'content-type': page.type || 'text/html', ...(page.location ? { location: page.location } : {}) };
      res.on('end', () => req.emit('close'));
      callback(res);
    });
    req.destroy = error => { req.emit('error', error); req.emit('close'); };
    return req;
  };
  t.mock.method(http, 'request', request);
  t.mock.method(https, 'request', request);
  return requests;
}

test('validated DNS is pinned to the socket and each redirect is checked again', async t => {
  const lookups = [];
  t.mock.method(dns, 'lookup', async host => {
    lookups.push(host);
    return [{ address: '93.184.216.34', family: 4 }];
  });
  const requests = mockPages(t, [{ status: 302, location: '/jobs/1' }, { body: '<p>Public role</p>' }]);
  assert.equal((await fetchPageText('https://example.com/jobs')).text, 'Public role');
  assert.deepEqual(lookups, ['example.com', 'example.com']);
  assert.equal(requests[1].path, '/jobs/1');
  assert.equal(requests[0].hostname, 'example.com'); // preserve Host and TLS identity
  // Even if DNS now returns loopback, the request's lookup returns only the checked address.
  t.mock.method(dns, 'lookup', async () => [{ address: '127.0.0.1', family: 4 }]);
  requests[0].lookup('example.com', {}, (error, address, family) => {
    assert.equal(error, null); assert.equal(address, '93.184.216.34'); assert.equal(family, 4);
  });
  requests[0].lookup('example.com', { all: true }, (error, records) => {
    assert.equal(error, null); assert.deepEqual(records, [{ address: '93.184.216.34', family: 4 }]);
  });
});

test('public redirects to internal services are rejected before connecting', async t => {
  t.mock.method(dns, 'lookup', async host => [{ address: host === 'example.com' ? '93.184.216.34' : '169.254.169.254', family: 4 }]);
  const requests = mockPages(t, [{ status: 302, location: 'http://169.254.169.254/latest/meta-data/' }]);
  await assert.rejects(fetchPageText('https://example.com/jobs'), /not allowed/);
  assert.equal(requests.length, 1);
});

test('alternate IPv4 encodings and IPv6 literals cannot bypass resolution checks', async t => {
  const requests = mockPages(t, []);
  t.mock.method(dns, 'lookup', async host => [{ address: host, family: host.includes(':') ? 6 : 4 }]);
  for (const url of ['http://2130706433', 'http://0x7f000001', 'http://127.1', 'http://[::1]', 'http://[::ffff:127.0.0.1]']) {
    await assert.rejects(fetchPageText(url), /not allowed/);
  }
  assert.equal(requests.length, 0);
});

test('job imports enforce response size, content type, and redirect count', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  mockPages(t, [{ type: 'application/octet-stream' }, { chunks: [Buffer.alloc(1500001)] },
    ...Array.from({ length: 6 }, () => ({ status: 302, location: '/again' }))]);
  await assert.rejects(fetchPageText('https://example.com'), /content type/);
  await assert.rejects(fetchPageText('https://example.com'), /too large/);
  await assert.rejects(fetchPageText('https://example.com'), /redirects/);
});

test('malformed redirect locations reject safely', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  mockPages(t, [{ status: 302, location: 'http://[invalid' }]);
  await assert.rejects(fetchPageText('https://example.com'), /Invalid URL/);
});
