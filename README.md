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

Clicking any field copies its value.

## Current scope

This extension intentionally uses a page-injected bottom bar instead of a popup, options page, or browser-frame toolbar. The goal is to keep the page diagnostics always visible during browsing.

## Load in Chrome

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project directory.

For local development, load the repository root directly so Chrome can access `manifest.json`, scripts, styles, and icons in place.

## Local debugging

### Background service worker

1. Open `chrome://extensions/`.
2. Find **Page Info Bottom Bar**.
3. Click the **service worker** link in the extension card.
4. Inspect logs, network requests, and exceptions from `background.js` there.

The service worker is responsible for:

- listening to `chrome.webRequest.onResponseStarted`
- caching per-tab page info in memory
- resolving fallback DNS A records
- calling the IP-to-location API
- sending updated info back to the content script

### Content script

Open DevTools on the target page and inspect the page console for behavior from `content.js`.

The content script is responsible for:

- injecting the bottom bar into the page
- tracking SPA URL changes
- adjusting page bottom padding to avoid overlap
- restoring cached field values from `sessionStorage`
- copying field values on click

### Useful validation scenarios

- Open a normal multi-page site and confirm server/runtime/CDN fields update after a full navigation.
- Open an SPA and navigate with `pushState`/`replaceState` routes to confirm the URL field changes without duplicating the bar.
- Test a narrow viewport to confirm the responsive layout still shows the URL.
- Test pages with sticky or fixed bottom UI to confirm layout offsetting still keeps content visible.

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
- `PRIVACY.md` — privacy and data-handling statement.
- `CHANGELOG.md` — release history.

## Permissions

Declared in `manifest.json`:

- `webRequest`: reads response metadata and headers for page requests.
- `<all_urls>`: allows the content script and web request listener to work on visited HTTP/HTTPS pages.
- `https://cloudflare-dns.com/*`: DNS-over-HTTPS lookup for hostname A records.
- `https://dns.google/*`: secondary DNS-over-HTTPS fallback.
- `https://ip.22kf.com/*`: maps an IP to location text for the city display.

## Data sources

The extension uses these runtime inputs:

- current page URL from the tab context
- response headers from the main document request
- Chrome-reported remote IP when available
- DNS-over-HTTPS lookups when Chrome does not provide a usable public IPv4
- `https://ip.22kf.com/` for city lookup

See `PRIVACY.md` for the privacy statement that matches this behavior.

## Message flow

- `background.js` collects network-derived page info and stores it by tab.
- `content.js` requests the latest state with `getPageInfo` when the page starts.
- On SPA URL changes, `content.js` sends `pageLocationChanged` so the background worker can refresh the current tab state.
- `background.js` pushes updates back with `pageInfoUpdated`.

## SPA behavior

The content script watches `pushState`, `replaceState`, hash changes, and a lightweight URL poll. When an SPA route changes, it notifies the background script so the stored tab URL/hostname and visible bar state are updated.

A client-side route change does not produce a new main document response, so server/runtime/CDN headers remain based on the latest real document response until the browser performs another full navigation.

## Packaging

For Chrome Web Store upload, create a clean zip that contains only the runtime extension files:

- `manifest.json`
- `background.js`
- `content.js`
- `page-info-core.js`
- `style.css`
- `icons/`

Do not include repository-only files such as:

- `.git/`
- `.idea/`
- `tests/`
- `README.md`
- `README.zh-CN.md`
- `CHANGELOG.md`
- `package.json`

A practical release flow is:

1. Create a temporary clean directory.
2. Copy only the runtime extension files into it.
3. Zip the contents of that directory.
4. Upload that zip to the Chrome Web Store.

## Release checklist

Before publishing a new version:

1. Update `manifest.json` version.
2. If you keep `package.json` version aligned for local tooling, update it to match.
3. Update `CHANGELOG.md`.
4. Run `npm test`.
5. Reload the unpacked extension in Chrome and verify the golden path manually.
6. Prepare screenshots and store description text.
7. Confirm `PRIVACY.md` still matches the extension's actual behavior.
8. Create the clean upload zip.

## Store assets

Already present:

- `icons/icon16.png`
- `icons/icon32.png`
- `icons/icon48.png`
- `icons/icon128.png`

Still recommended before store submission:

- desktop screenshot showing the bottom bar on a standard page
- narrow-screen screenshot showing the responsive URL layout
- screenshot on an SPA route-change scenario
- short store description
- long store description
- privacy policy link based on `PRIVACY.md`

## Known limitations

- Chrome extensions cannot create a custom toolbar fixed to the browser frame bottom, so this extension uses a page-injected bottom bar.
- If the browser is using a local proxy/PAC, Chrome may report a local or private proxy IP such as `127.0.0.1`. The extension treats local/private reported IPv4 addresses as unusable and falls back to DNS A-record resolution for the page hostname.
- Runtime and CDN detection depend on response headers and cookies exposed to the extension.
- City lookups depend on the third-party IP lookup service being reachable.
- The extension currently resolves IPv4 only and does not attempt full IPv6 support.
- The extension shows the latest known document-derived headers on SPA route changes until a real navigation happens.
