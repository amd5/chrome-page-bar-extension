importScripts('page-info-core.js');

const {
  normalizeHeaders,
  detectRuntime,
  hasPhpSessionCookie,
  detectCdn,
  extractLocation,
  getHostname,
  isIpv4,
  isPublicIpv4,
  extractDnsAnswer,
  formatIpResult
} = globalThis.PageInfoCore;

const tabInfo = new Map();

chrome.webRequest.onResponseStarted.addListener(
  async (details) => {
    if (details.tabId < 0) {
      return;
    }

    const headers = normalizeHeaders(details.responseHeaders || []);

    if (details.type !== 'main_frame') {
      applySameDomainRuntimeHints(details.tabId, details.url, headers);
      return;
    }

    const hostname = getHostname(details.url);
    const reportedIp = details.ip || '';
    const info = {
      url: details.url,
      hostname,
      ip: isPublicIpv4(reportedIp) ? reportedIp : (isIpv4(hostname) ? hostname : ''),
      city: '--',
      server: headers.server || 'unknown',
      runtime: detectRuntime(headers),
      cdn: detectCdn(headers),
      updatedAt: Date.now()
    };

    tabInfo.set(details.tabId, info);
    sendInfo(details.tabId, info);

    if (info.ip) {
      updateIpLocation(details.tabId, details.url, info.ip);
    }

    if (!info.ip && hostname) {
      const resolvedIp = await resolveIp(hostname);
      const latest = tabInfo.get(details.tabId);
      if (latest && latest.url === details.url && !latest.ip) {
        latest.ip = formatIpResult(resolvedIp);
        latest.updatedAt = Date.now();
        tabInfo.set(details.tabId, latest);
        sendInfo(details.tabId, latest);
        if (resolvedIp.ip) {
          updateIpLocation(details.tabId, details.url, resolvedIp.ip);
        }
      }
    }
  },
  { urls: ['http://*/*', 'https://*/*'] },
  ['responseHeaders']
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number') {
    sendResponse({});
    return false;
  }

  if (message?.type === 'getPageInfo') {
    sendResponse(tabInfo.get(tabId) || {});
    return false;
  }

  if (message?.type === 'pageLocationChanged') {
    handlePageLocationChanged(tabId, message.url || '');
    sendResponse(tabInfo.get(tabId) || {});
    return false;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabInfo.delete(tabId);
});

function applySameDomainRuntimeHints(tabId, url, headers) {
  const latest = tabInfo.get(tabId);
  if (!latest || getHostname(url) !== latest.hostname || !hasPhpSessionCookie(headers)) {
    return;
  }

  latest.runtime = 'PHP';
  latest.updatedAt = Date.now();
  tabInfo.set(tabId, latest);
  sendInfo(tabId, latest);
}

function handlePageLocationChanged(tabId, url) {
  if (!url) {
    return;
  }

  const latest = tabInfo.get(tabId) || {};
  const updated = {
    url,
    hostname: getHostname(url),
    ip: latest.ip || '',
    city: latest.city || '--',
    server: latest.server || 'unknown',
    runtime: latest.runtime || 'unknown',
    cdn: latest.cdn || 'no',
    updatedAt: Date.now()
  };

  tabInfo.set(tabId, updated);
  sendInfo(tabId, updated);
}

async function updateIpLocation(tabId, url, ip) {
  const location = await resolveLocation(ip);
  const latest = tabInfo.get(tabId);
  if (!latest || latest.url !== url) {
    return;
  }

  latest.city = location.city || '--';
  latest.updatedAt = Date.now();
  tabInfo.set(tabId, latest);
  sendInfo(tabId, latest);
}

async function resolveLocation(ip) {
  try {
    const response = await fetchWithTimeout(`https://ip.22kf.com/query?ip=${encodeURIComponent(ip)}`, {}, 2500);
    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    return extractLocation(data);
  } catch {
    return {};
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function sendInfo(tabId, info) {
  chrome.tabs.sendMessage(tabId, { type: 'pageInfoUpdated', info }).catch(() => {});
}

async function resolveIp(hostname) {
  const cloudflare = await resolveWithCloudflare(hostname);
  if (cloudflare.ip) {
    return cloudflare;
  }

  const google = await resolveWithGoogle(hostname);
  if (google.ip) {
    return google;
  }

  if (cloudflare.status === 'timeout' || google.status === 'timeout') {
    return { status: 'timeout' };
  }

  if (cloudflare.status === 'no-a-record' || google.status === 'no-a-record') {
    return { status: 'no-a-record' };
  }

  return { status: google.status || cloudflare.status || 'dns-failed' };
}

async function resolveWithCloudflare(hostname) {
  return resolveDnsJson(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
    headers: { accept: 'application/dns-json' }
  });
}

async function resolveWithGoogle(hostname) {
  return resolveDnsJson(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`);
}

async function resolveDnsJson(url, options = {}) {
  try {
    const response = await fetchWithTimeout(url, options, 3000);

    if (!response.ok) {
      return { status: `http-${response.status}` };
    }

    const data = await response.json();
    return extractDnsAnswer(data);
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { status: 'timeout' };
    }
    return { status: 'dns-failed' };
  }
}
