# Privacy

Page Info Bottom Bar does not include analytics, accounts, telemetry, or a sync backend.

## Data observed locally

To render the bottom bar, the extension observes:

- the current page URL
- response headers for HTTP/HTTPS requests in the current tab
- the remote IP reported by Chrome when available
- DNS lookup results when Chrome does not provide a page IP

## External lookups

The extension may call these services from the background service worker:

- `https://cloudflare-dns.com/` — DNS-over-HTTPS A record lookup
- `https://dns.google/` — DNS-over-HTTPS A record lookup fallback
- `https://ip.22kf.com/` — IP-to-location lookup for city display

These requests are used only to populate the bottom bar fields.

## Local storage

The background service worker keeps tab information in memory while the tab exists.

The content script stores the latest displayed page-info fields in `sessionStorage` for the current page URL so a refresh can restore the bar quickly before fresh background data arrives.

## Permissions rationale

- `webRequest` is required to read response headers and Chrome-provided request IP data.
- `<all_urls>` is required because the bar is designed to run on all HTTP/HTTPS pages.
- DNS and IP lookup host permissions are required for the external lookup services listed above.

## No sale or sharing

The extension does not sell data, create user profiles, or send data to an application backend controlled by this project.
