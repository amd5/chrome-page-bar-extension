const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeHeaders,
  detectRuntime,
  detectCdn,
  extractLocation,
  extractCity,
  extractDnsAnswer,
  formatIpResult,
  getHostname,
  isIpv4,
  isPublicIpv4
} = require('../page-info-core.js');

test('normalizes duplicate headers', () => {
  assert.deepEqual(normalizeHeaders([
    { name: 'Set-Cookie', value: 'a=1' },
    { name: 'set-cookie', value: 'b=2' }
  ]), {
    'set-cookie': 'a=1; b=2'
  });
});

test('ignores headers without names when normalizing', () => {
  assert.deepEqual(normalizeHeaders([
    { value: 'missing-name' },
    { name: 'Server', value: 'nginx' }
  ]), {
    server: 'nginx'
  });
});

test('detects runtimes from headers and cookies', () => {
  assert.equal(detectRuntime({ 'set-cookie': 'PHPSESSID=abc' }), 'PHP');
  assert.equal(detectRuntime({ server: 'Kestrel' }), 'ASP.NET Core');
  assert.equal(detectRuntime({ 'x-powered-by': 'Express' }), 'Express');
  assert.equal(detectRuntime({ 'x-powered-by': 'Next.js' }), 'Next.js');
  assert.equal(detectRuntime({ 'x-django-version': '4.2' }), 'Django');
  assert.equal(detectRuntime({ 'x-fastapi-version': '0.110.0' }), 'FastAPI/0.110.0');
  assert.equal(detectRuntime({ 'x-powered-by': 'Ruby on Rails' }), 'Rails');
  assert.equal(detectRuntime({ 'x-powered-by': 'Go' }), 'Go');
  assert.equal(detectRuntime({ 'set-cookie': 'laravel_session=abc' }), 'Laravel');
  assert.equal(detectRuntime({ 'set-cookie': 'wordpress_logged_in_x=abc' }), 'WordPress');
  assert.equal(detectRuntime({ server: 'plain-server' }), 'unknown');
});

test('prefers cookie-based runtime hints before generic headers', () => {
  assert.equal(detectRuntime({
    'set-cookie': 'wordpress_logged_in_x=abc',
    'x-powered-by': 'Express'
  }), 'WordPress');

  assert.equal(detectRuntime({
    'set-cookie': 'laravel_session=abc',
    server: 'Kestrel'
  }), 'Laravel');
});

test('detects runtime versions and additional frameworks', () => {
  assert.equal(detectRuntime({ 'x-powered-by': 'PHP/8.2.5' }), 'PHP/8.2.5');
  assert.equal(detectRuntime({ 'x-powered-by': 'NestJS/10.0.0' }), 'NestJS/10.0.0');
  assert.equal(detectRuntime({ 'x-generator': 'WooCommerce 9.0' }), 'WooCommerce/9.0');
  assert.equal(detectRuntime({ 'x-generator': 'Drupal 10' }), 'Drupal/10');
  assert.equal(detectRuntime({ 'x-aspnet-version': '4.0.30319' }), 'ASP.NET/4.0.30319');
  assert.equal(detectRuntime({ 'x-aspnetmvc-version': '5.2' }), 'ASP.NET MVC/5.2');
  assert.equal(detectRuntime({ 'set-cookie': 'csrftoken=abc' }), 'Django');
});

test('detects CDN providers and fallbacks', () => {
  assert.equal(detectCdn({ 'cf-ray': 'abc' }), 'Cloudflare');
  assert.equal(detectCdn({ 'x-amz-cf-id': 'abc' }), 'CloudFront');
  assert.equal(detectCdn({ 'x-akamai-request-id': 'abc' }), 'Akamai');
  assert.equal(detectCdn({ 'x-fastly-request-id': 'abc' }), 'Fastly');
  assert.equal(detectCdn({ 'x-vercel-cache': 'HIT' }), 'Vercel');
  assert.equal(detectCdn({ 'x-nf-request-id': 'abc' }), 'Netlify');
  assert.equal(detectCdn({ 'cdn-pullzone': '123' }), 'BunnyCDN');
  assert.equal(detectCdn({ link: 'https://cdn.jsdelivr.net/npm/a' }), 'jsDelivr');
  assert.equal(detectCdn({ eagleid: 'abc' }), 'Alibaba Cloud CDN');
  assert.equal(detectCdn({ 'x-cache': 'HIT' }), 'Unknown CDN');
  assert.equal(detectCdn({ server: 'origin' }), 'no');
});

test('detects additional CDN providers from combined headers', () => {
  assert.equal(detectCdn({ server: 'Google Frontend' }), 'Google CDN');
  assert.equal(detectCdn({ 'x-azure-ref': 'abc' }), 'Azure Front Door');
  assert.equal(detectCdn({ 'x-tencent-cache': 'hit' }), 'Tencent Cloud CDN');
  assert.equal(detectCdn({ 'x-bce-request-id': 'abc' }), 'Baidu Cloud Acceleration');
  assert.equal(detectCdn({ 'x-iinfo': 'cache' }), 'Imperva');
  assert.equal(detectCdn({ 'x-sucuri-id': '1' }), 'Sucuri');
  assert.equal(detectCdn({ 'x-edge-location': 'LAX' }), 'KeyCDN');
});

test('extracts location from IP location response', () => {
  assert.deepEqual(extractLocation({ country: '美国-加利福尼亚州-圣克拉拉-山景城' }), {
    city: '山景城'
  });
  assert.equal(extractCity({ city: '南京' }), '南京');
  assert.equal(extractCity({ area: '本地网络' }), '本地网络');
});

test('handles partial or empty location payloads', () => {
  assert.deepEqual(extractLocation({ country: '', city: 'Shanghai' }), { city: 'Shanghai' });
  assert.deepEqual(extractLocation({ area: '局域网' }), { city: '局域网' });
  assert.deepEqual(extractLocation({}), { city: '' });
});

test('extracts and formats DNS answers', () => {
  assert.deepEqual(extractDnsAnswer({ Answer: [{ type: 1, data: '1.2.3.4' }] }), { ip: '1.2.3.4', status: 'ok' });
  assert.deepEqual(extractDnsAnswer({ Answer: [{ type: 28, data: '::1' }] }), { status: 'no-a-record' });
  assert.deepEqual(extractDnsAnswer({ Status: 3 }), { status: 'dns-3' });
  assert.equal(formatIpResult({ ip: '1.2.3.4' }), '1.2.3.4');
  assert.equal(formatIpResult({ status: 'timeout' }), 'dns timeout');
  assert.equal(formatIpResult({ status: 'no-a-record' }), 'no A record');
  assert.equal(formatIpResult({ status: 'dns-failed' }), 'dns failed');
});

test('handles unusual DNS and IP formatting states', () => {
  assert.deepEqual(extractDnsAnswer({ Status: 0, Answer: [{ type: 1, data: '999.1.1.1' }] }), { ip: '999.1.1.1', status: 'ok' });
  assert.deepEqual(extractDnsAnswer({ Status: 0 }), { status: 'no-a-record' });
  assert.equal(formatIpResult({ status: 'http-500' }), 'http-500');
  assert.equal(formatIpResult({}), 'unknown');
});

test('parses hostnames safely', () => {
  assert.equal(getHostname('https://example.com/a'), 'example.com');
  assert.equal(getHostname('not a url'), '');
});

test('handles more hostname parsing edge cases', () => {
  assert.equal(getHostname('http://127.0.0.1:8080/path'), '127.0.0.1');
  assert.equal(getHostname('https://sub.example.com:8443/path?q=1'), 'sub.example.com');
  assert.equal(getHostname(''), '');
});

test('identifies IPv4 addresses', () => {
  assert.equal(isIpv4('192.168.1.2'), true);
  assert.equal(isIpv4('8.8.8.8'), true);
  assert.equal(isIpv4('example.com'), false);
  assert.equal(isIpv4('::1'), false);
});

test('rejects invalid IPv4 shapes', () => {
  assert.equal(isIpv4('256.1.1.1'), false);
  assert.equal(isIpv4('1.2.3'), false);
  assert.equal(isIpv4('1.2.3.4.5'), false);
  assert.equal(isIpv4('1.2.3.a'), false);
});

test('identifies public IPv4 addresses', () => {
  assert.equal(isPublicIpv4('222.184.35.132'), true);
  assert.equal(isPublicIpv4('8.8.8.8'), true);
  assert.equal(isPublicIpv4('127.0.0.1'), false);
  assert.equal(isPublicIpv4('10.0.0.1'), false);
  assert.equal(isPublicIpv4('172.16.0.1'), false);
  assert.equal(isPublicIpv4('192.168.1.1'), false);
  assert.equal(isPublicIpv4('169.254.1.1'), false);
  assert.equal(isPublicIpv4('::1'), false);
});

test('rejects additional reserved IPv4 ranges', () => {
  assert.equal(isPublicIpv4('0.1.2.3'), false);
  assert.equal(isPublicIpv4('100.64.0.1'), false);
  assert.equal(isPublicIpv4('192.0.2.1'), false);
  assert.equal(isPublicIpv4('198.18.0.1'), false);
  assert.equal(isPublicIpv4('224.0.0.1'), false);
});
