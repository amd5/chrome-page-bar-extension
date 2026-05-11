# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- No unreleased changes yet.

## [0.1.1]

### Added

- Always-on page-injected bottom bar for HTTP/HTTPS pages.
- Display of URL, load time, IP, city, server header, runtime, and CDN status.
- Click-to-copy behavior for each displayed field.
- SPA route tracking based on History API, hash changes, and URL polling.
- DNS-over-HTTPS fallback through Cloudflare and Google when Chrome does not expose a usable public IPv4.
- IP-to-city lookup integration for city display.
- Node-based unit tests for shared detection and extraction helpers.
- English and Chinese project documentation.
- Privacy statement describing permissions, local state, and external lookups.

### Changed

- The extension keeps per-tab state in the background service worker and restores the latest displayed state from `sessionStorage` for faster page refresh recovery.

### Known limitations

- The bar is injected into the page instead of the browser frame.
- Runtime and CDN detection depend on exposed response headers and cookies.
- City lookup depends on third-party service availability.
- SPA route changes reuse the latest real document response headers until the next full navigation.
- IPv6 is not fully supported.
