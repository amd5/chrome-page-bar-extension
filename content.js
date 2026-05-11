const BAR_ID = 'page-info-bottom-bar';
const BODY_PADDING_ATTR = 'data-page-info-bottom-bar-padding';
const STATE_CACHE_KEY = 'page-info-bottom-bar-state';
const state = {
  url: window.location.href,
  loadTime: '0.0000s',
  ip: 'loading',
  city: '--',
  server: 'loading',
  runtime: 'loading',
  cdn: 'loading'
};

let bar;
let timer;
let locationTimer;
let observer;
let reflowFrame = 0;
let bodyOffsetState;
let originalPushState;
let originalReplaceState;
let lastNotifiedUrl = window.location.href;
let historyPatched = false;
let tornDown = false;

if (isTopFrame()) {
  init();
}

function isTopFrame() {
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

function init() {
  restoreCachedState();
  createBarWhenReady();
  requestPageInfo();
  startLocationTracking();
  locationTimer = window.setInterval(handleLocationChange, 1000);
  window.addEventListener('resize', scheduleLayoutSync);
  window.visualViewport?.addEventListener('resize', scheduleLayoutSync);
  window.visualViewport?.addEventListener('scroll', scheduleLayoutSync);
  window.addEventListener('orientationchange', scheduleLayoutSync);
  window.addEventListener('popstate', handleLocationChange);
  window.addEventListener('hashchange', handleLocationChange);
  window.addEventListener('pagehide', teardown);
  window.addEventListener('beforeunload', teardown);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
}

function handleRuntimeMessage(message) {
  if (message?.type === 'pageInfoUpdated') {
    applyPageInfo(message.info || {});
  }
}

function createBarWhenReady() {
  if (tornDown) {
    return;
  }

  if (document.documentElement) {
    mountBar();
    startLoadTimer();
    startObserver();
    scheduleLayoutSync();
    return;
  }

  requestAnimationFrame(createBarWhenReady);
}

function mountBar() {
  if (tornDown || !document.documentElement) {
    return;
  }

  const existing = document.getElementById(BAR_ID);
  if (existing) {
    bar = existing;
  } else {
    bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.addEventListener('click', handleBarClick);
    bar.innerHTML = `
      <span class="page-info-url-wrap" data-copy-field="url" title="Click to copy URL">
        <span class="page-info-url-label">url</span>
        <span class="page-info-url" data-field="url"></span>
      </span>
      <span class="page-info-metrics">
        <span class="page-info-item" data-field="loadTime" data-copy-field="loadTime" title="Click to copy load time"></span>
        <span class="page-info-separator">|</span>
        <span class="page-info-item" data-copy-field="ip" title="Click to copy IP">ip: <span data-field="ip"></span></span>
        <span class="page-info-separator">|</span>
        <span class="page-info-item" data-copy-field="city" title="Click to copy city">city: <span data-field="city"></span></span>
        <span class="page-info-separator">|</span>
        <span class="page-info-item" data-copy-field="server" title="Click to copy server">server: <span data-field="server"></span></span>
        <span class="page-info-separator">|</span>
        <span class="page-info-item" data-copy-field="runtime" title="Click to copy runtime">runtime: <span data-field="runtime"></span></span>
        <span class="page-info-separator">|</span>
        <span class="page-info-item" data-copy-field="cdn" title="Click to copy CDN">cdn: <span data-field="cdn"></span></span>
      </span>
    `;
  }

  if (!bar.isConnected || bar.parentElement !== document.documentElement) {
    document.documentElement.appendChild(bar);
  }

  renderAllFields();
}

function startObserver() {
  if (observer || !document.documentElement) {
    return;
  }

  observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function handleMutations(mutations) {
  if (mutations.every((mutation) => mutation.target === bar || bar?.contains(mutation.target))) {
    return;
  }

  scheduleLayoutSync();
}

function scheduleLayoutSync() {
  if (tornDown || reflowFrame) {
    return;
  }

  reflowFrame = requestAnimationFrame(syncLayout);
}

function syncLayout() {
  reflowFrame = 0;

  if (tornDown) {
    return;
  }

  mountBar();
  updateUrlFromLocation();

  if (!bar) {
    return;
  }

  syncViewportWidth();

  const bottomOffset = computeBottomOffset();
  bar.style.bottom = `${bottomOffset}px`;

  const barHeight = Math.ceil(bar.getBoundingClientRect().height) || 24;
  applyBodyOffset(barHeight + bottomOffset);
}

function syncViewportWidth() {
  const viewport = window.visualViewport;
  const width = Math.ceil(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
  const left = Math.floor(viewport?.offsetLeft || 0);

  if (width > 0) {
    bar.style.setProperty('--page-info-bar-width', `${width}px`);
    bar.style.setProperty('--page-info-bar-left', `${left}px`);
  }
}

function applyBodyOffset(totalOffset) {
  const body = document.body;
  if (!body) {
    return;
  }

  if (!bodyOffsetState || bodyOffsetState.body !== body) {
    restoreBodyOffset();
    restoreInjectedPadding(body);
    bodyOffsetState = {
      body,
      originalInline: body.style.paddingBottom,
      basePadding: body.style.paddingBottom || getComputedStyle(body).paddingBottom || '0px'
    };
  }

  body.style.paddingBottom = `calc(${bodyOffsetState.basePadding} + ${Math.ceil(totalOffset)}px)`;
  body.setAttribute(BODY_PADDING_ATTR, 'true');
}

function restoreInjectedPadding(body) {
  if (!body.hasAttribute(BODY_PADDING_ATTR)) {
    return;
  }

  body.style.paddingBottom = body.dataset.pageInfoOriginalPaddingBottom || '';
  body.removeAttribute(BODY_PADDING_ATTR);
  delete body.dataset.pageInfoOriginalPaddingBottom;
}

function restoreBodyOffset() {
  if (!bodyOffsetState) {
    return;
  }

  const { body, originalInline } = bodyOffsetState;
  if (body) {
    body.style.paddingBottom = originalInline;
    body.removeAttribute(BODY_PADDING_ATTR);
    delete body.dataset.pageInfoOriginalPaddingBottom;
  }

  bodyOffsetState = undefined;
}

function computeBottomOffset() {
  const body = document.body;
  if (!body) {
    return 0;
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const minWidth = Math.min(120, viewportWidth * 0.25);
  let offset = 0;

  const elements = Array.from(body.getElementsByTagName('*')).slice(-1500);
  for (const element of elements) {
    if (element === bar || bar?.contains(element)) {
      continue;
    }

    const style = getComputedStyle(element);
    if (style.position !== 'fixed' && style.position !== 'sticky') {
      continue;
    }

    if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity) === 0) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < minWidth || rect.height < 8 || rect.height > viewportHeight * 0.35) {
      continue;
    }

    const bottomGap = viewportHeight - rect.bottom;
    if (bottomGap < -2 || bottomGap > 8 || rect.top >= viewportHeight || rect.bottom <= 0) {
      continue;
    }

    offset = Math.max(offset, Math.ceil(Math.min(rect.height, viewportHeight - rect.top)));
  }

  return offset;
}

function startLoadTimer() {
  if (timer) {
    return;
  }

  updateLoadTime();
  timer = window.setInterval(updateLoadTime, 50);
  window.addEventListener('load', handleWindowLoad, { once: true });
}

function handleWindowLoad() {
  updateLoadTime();
  window.clearInterval(timer);
  timer = undefined;
  scheduleLayoutSync();
}

function updateLoadTime() {
  const navigation = performance.getEntriesByType('navigation')[0];
  let milliseconds;

  if (navigation && navigation.loadEventEnd > 0) {
    milliseconds = navigation.loadEventEnd;
  } else {
    milliseconds = performance.now();
  }

  state.loadTime = `${(milliseconds / 1000).toFixed(4)}s`;
  renderField('loadTime', state.loadTime);
}

function requestPageInfo() {
  chrome.runtime.sendMessage({ type: 'getPageInfo' }, (info) => {
    if (chrome.runtime.lastError) {
      return;
    }
    applyPageInfo(info || {});
  });
}

function applyPageInfo(info) {
  state.url = info.url || window.location.href;
  state.ip = info.ip || 'unknown';
  state.city = info.city || '--';
  state.server = info.server || 'unknown';
  state.runtime = info.runtime || 'unknown';
  state.cdn = info.cdn || 'no';

  cacheState();
  renderAllFields();
  scheduleLayoutSync();
}

function renderAllFields() {
  renderField('url', state.url);
  renderField('loadTime', state.loadTime);
  renderField('ip', state.ip);
  renderField('city', state.city);
  renderField('server', state.server);
  renderField('runtime', state.runtime);
  renderField('cdn', state.cdn);
}

function renderField(field, value) {
  if (tornDown) {
    return;
  }

  if (!bar || !bar.isConnected) {
    mountBar();
  }

  const element = bar?.querySelector(`[data-field="${field}"]`);
  if (element) {
    element.textContent = value;
  }
}

function handleBarClick(event) {
  const copyTarget = event.target.closest('[data-copy-field]');
  if (!copyTarget || !bar?.contains(copyTarget)) {
    return;
  }

  const field = copyTarget.dataset.copyField;
  const value = state[field];
  if (!value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  copyToClipboard(value);
}

function copyToClipboard(value) {
  const text = String(value);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => copyWithTextarea(text));
    return;
  }

  copyWithTextarea(text);
}

function copyWithTextarea(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.documentElement.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function startLocationTracking() {
  if (historyPatched) {
    return;
  }

  originalPushState = history.pushState;
  originalReplaceState = history.replaceState;
  history.pushState = wrapHistoryMethod(originalPushState);
  history.replaceState = wrapHistoryMethod(originalReplaceState);
  historyPatched = true;
}

function wrapHistoryMethod(method) {
  return function wrappedHistoryMethod(...args) {
    const result = method.apply(this, args);
    handleLocationChange();
    return result;
  };
}

function handleLocationChange() {
  requestAnimationFrame(() => {
    updateUrlFromLocation();
    scheduleLayoutSync();
  });
}

function updateUrlFromLocation() {
  if (state.url === window.location.href) {
    return;
  }

  state.url = window.location.href;
  cacheState();
  renderField('url', state.url);
  notifyLocationChange();
}

function notifyLocationChange() {
  if (lastNotifiedUrl === window.location.href) {
    return;
  }

  lastNotifiedUrl = window.location.href;
  chrome.runtime.sendMessage({ type: 'pageLocationChanged', url: window.location.href }, (info) => {
    if (chrome.runtime.lastError) {
      return;
    }
    applyPageInfo(info || {});
  });
}

function restoreCachedState() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(STATE_CACHE_KEY) || 'null');
    if (!cached || cached.url !== window.location.href) {
      return;
    }

    state.ip = cached.ip || state.ip;
    state.city = cached.city || state.city;
    state.server = cached.server || state.server;
    state.runtime = cached.runtime || state.runtime;
    state.cdn = cached.cdn || state.cdn;
  } catch {
  }
}

function cacheState() {
  try {
    sessionStorage.setItem(STATE_CACHE_KEY, JSON.stringify({
      url: state.url,
      ip: state.ip,
      city: state.city,
      server: state.server,
      runtime: state.runtime,
      cdn: state.cdn
    }));
  } catch {
  }
}

function teardown() {
  if (tornDown) {
    return;
  }

  tornDown = true;

  if (reflowFrame) {
    cancelAnimationFrame(reflowFrame);
    reflowFrame = 0;
  }

  if (timer) {
    window.clearInterval(timer);
    timer = undefined;
  }

  if (locationTimer) {
    window.clearInterval(locationTimer);
    locationTimer = undefined;
  }

  if (observer) {
    observer.disconnect();
    observer = undefined;
  }

  window.removeEventListener('resize', scheduleLayoutSync);
  window.visualViewport?.removeEventListener('resize', scheduleLayoutSync);
  window.visualViewport?.removeEventListener('scroll', scheduleLayoutSync);
  window.removeEventListener('orientationchange', scheduleLayoutSync);
  window.removeEventListener('popstate', handleLocationChange);
  window.removeEventListener('hashchange', handleLocationChange);
  window.removeEventListener('pagehide', teardown);
  window.removeEventListener('beforeunload', teardown);
  window.removeEventListener('load', handleWindowLoad);

  if (historyPatched) {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    historyPatched = false;
  }

  try {
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  } catch {
  }

  restoreBodyOffset();
  bar?.removeEventListener('click', handleBarClick);
  bar?.remove();
  bar = undefined;
}
