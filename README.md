# Page Info Bottom Bar

[中文文档](README.zh-CN.md)

A Manifest V3 Chrome extension that injects an always-on bottom bar into HTTP/HTTPS pages.

The bar displays:

- current URL on hover / narrow-screen layout
- page load duration
- IP address
- city
- server header
- detected runtime/framework
- detected CDN

## Load in Chrome

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project directory.

## Run tests

```bash
npm test
```

The tests use Node's built-in test runner and cover the pure detection/extraction helpers in `page-info-core.js`.

## File layout

- `manifest.json` — extension manifest, permissions, content script, background service worker.
- `content.js` — page-injected bottom bar, SPA URL tracking, layout offset handling.
- `background.js` — Chrome event wiring, response-header handling, DNS/IP/location lookups.
- `page-info-core.js` — pure helper functions shared by the service worker and tests.
- `style.css` — bottom bar styling and responsive layout.
- `tests/page-info-core.test.js` — Node tests for detection and extraction logic.
- `icons/` — extension icon assets.

## Permissions

- `webRequest`: reads response metadata and headers for page requests.
- `<all_urls>`: allows the content script and web request listener to work on visited HTTP/HTTPS pages.
- `https://cloudflare-dns.com/*`: DNS-over-HTTPS fallback for resolving a hostname to an A record.
- `https://dns.google/*`: secondary DNS-over-HTTPS fallback.
- `https://ip.22kf.com/*`: maps an IP to location text for the city display.

## SPA behavior

The content script watches `pushState`, `replaceState`, hash changes, and a lightweight URL poll. When an SPA route changes, it notifies the background script so the stored tab URL/hostname and visible bar state are updated.

A client-side route change does not produce a new main document response, so server/runtime/CDN headers remain based on the latest real document response until the browser performs another full navigation.

## Known limitations

- Chrome extensions cannot create a custom toolbar fixed to the browser frame bottom, so this extension uses a page-injected bottom bar.
- If the browser is using a local proxy/PAC, Chrome may report a local or private proxy IP such as `127.0.0.1`. The extension treats local/private reported IPv4 addresses as unusable and falls back to DNS A-record resolution for the page hostname.
- Runtime and CDN detection depend on response headers and cookies exposed to the extension.
- City lookups depend on the third-party IP lookup service being reachable.
