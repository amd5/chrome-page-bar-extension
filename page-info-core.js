(function initPageInfoCore(root) {
  function normalizeHeaders(responseHeaders) {
    return responseHeaders.reduce((headers, header) => {
      if (header.name) {
        const name = header.name.toLowerCase();
        const value = header.value || '';
        headers[name] = headers[name] ? `${headers[name]}; ${value}` : value;
      }
      return headers;
    }, {});
  }

  function detectRuntime(headers) {
    if (hasPhpSessionCookie(headers)) {
      return 'PHP';
    }

    if (hasCookieName(headers, 'laravel_session') || headers['x-laravel-cache']) {
      return 'Laravel';
    }

    if (hasCookieName(headers, 'wordpress_') || hasCookieName(headers, 'wp-settings-')) {
      return 'WordPress';
    }

    if (hasCookieName(headers, 'drupal')) {
      return 'Drupal';
    }

    const candidates = collectRuntimeCandidates(headers);

    for (const value of candidates) {
      const php = value.match(/PHP\/?\s*([\w.+-]+)?/i);
      if (php) {
        return php[1] ? `PHP/${php[1]}` : 'PHP';
      }

      const aspnetCore = value.match(/(?:ASP\.NET\s*Core|\.NET\s*Core|Kestrel)\/?\s*([\w.+-]+)?/i);
      if (aspnetCore) {
        return aspnetCore[1] ? `ASP.NET Core/${aspnetCore[1]}` : 'ASP.NET Core';
      }

      const aspnetMvc = value.match(/ASP\.NET\s*MVC\/?\s*([\w.+-]+)?/i);
      if (aspnetMvc) {
        return aspnetMvc[1] ? `ASP.NET MVC/${aspnetMvc[1]}` : 'ASP.NET MVC';
      }

      const aspnet = value.match(/(?:ASP\.NET|\.NET)\/?\s*([\w.+-]+)?/i);
      if (aspnet) {
        return aspnet[1] ? `ASP.NET/${aspnet[1]}` : 'ASP.NET';
      }

      const next = value.match(/Next\.js\/?\s*([\w.+-]+)?/i);
      if (next) {
        return next[1] ? `Next.js/${next[1]}` : 'Next.js';
      }

      const nest = value.match(/NestJS\/?\s*([\w.+-]+)?/i);
      if (nest) {
        return nest[1] ? `NestJS/${nest[1]}` : 'NestJS';
      }

      const express = value.match(/Express\/?\s*([\w.+-]+)?/i);
      if (express) {
        return express[1] ? `Express/${express[1]}` : 'Express';
      }

      const node = value.match(/Node(?:\.js)?\/?\s*([\w.+-]+)?/i);
      if (node) {
        return node[1] ? `Node.js/${node[1]}` : 'Node.js';
      }

      const django = value.match(/Django\/?\s*([\w.+-]+)?/i);
      if (django) {
        return django[1] ? `Django/${django[1]}` : 'Django';
      }

      const fastapi = value.match(/FastAPI\/?\s*([\w.+-]+)?/i);
      if (fastapi) {
        return fastapi[1] ? `FastAPI/${fastapi[1]}` : 'FastAPI';
      }

      const flask = value.match(/Flask\/?\s*([\w.+-]+)?/i);
      if (flask) {
        return flask[1] ? `Flask/${flask[1]}` : 'Flask';
      }

      const python = value.match(/(?:Python|ASGI|WSGI|Uvicorn|Gunicorn|uWSGI)\/?\s*([\w.+-]+)?/i);
      if (python) {
        return python[1] ? `Python/${python[1]}` : 'Python';
      }

      const rails = value.match(/(?:Ruby on Rails|Rails)\/?\s*([\w.+-]+)?/i);
      if (rails) {
        return rails[1] ? `Rails/${rails[1]}` : 'Rails';
      }

      const ruby = value.match(/(?:Ruby|Passenger|Puma)\/?\s*([\w.+-]+)?/i);
      if (ruby) {
        return ruby[1] ? `Ruby/${ruby[1]}` : 'Ruby';
      }

      const java = value.match(/(?:Java|JSP|Servlet|Tomcat|Jetty|Spring)(?:\/?\s*([\w.+-]+))?/i);
      if (java) {
        return java[1] ? `Java/${java[1]}` : 'Java';
      }

      const go = value.match(/\b(?:Go|Golang)\b\/?\s*([\w.+-]+)?/i);
      if (go) {
        return go[1] ? `Go/${go[1]}` : 'Go';
      }

      const laravel = value.match(/Laravel\/?\s*([\w.+-]+)?/i);
      if (laravel) {
        return laravel[1] ? `Laravel/${laravel[1]}` : 'Laravel';
      }

      const symfony = value.match(/Symfony\/?\s*([\w.+-]+)?/i);
      if (symfony) {
        return symfony[1] ? `Symfony/${symfony[1]}` : 'Symfony';
      }

      const wordpress = value.match(/WordPress\/?\s*([\w.+-]+)?/i);
      if (wordpress) {
        return wordpress[1] ? `WordPress/${wordpress[1]}` : 'WordPress';
      }

      const woocommerce = value.match(/WooCommerce\/?\s*([\w.+-]+)?/i);
      if (woocommerce) {
        return woocommerce[1] ? `WooCommerce/${woocommerce[1]}` : 'WooCommerce';
      }

      const drupal = value.match(/Drupal\/?\s*([\w.+-]+)?/i);
      if (drupal) {
        return drupal[1] ? `Drupal/${drupal[1]}` : 'Drupal';
      }

      const coldfusion = value.match(/ColdFusion\/?\s*([\w.+-]+)?/i);
      if (coldfusion) {
        return coldfusion[1] ? `ColdFusion/${coldfusion[1]}` : 'ColdFusion';
      }
    }

    if (headers['x-aspnet-version']) {
      return `ASP.NET/${headers['x-aspnet-version']}`;
    }

    if (headers['x-aspnetmvc-version']) {
      return `ASP.NET MVC/${headers['x-aspnetmvc-version']}`;
    }

    if (hasHeaderPrefix(headers, 'x-nextjs') || headers['next-router-state-tree']) {
      return 'Next.js';
    }

    if (headers['x-django-version'] || hasCookieName(headers, 'csrftoken')) {
      return 'Django';
    }

    if (headers['x-fastapi-version']) {
      return `FastAPI/${headers['x-fastapi-version']}`;
    }

    if (headers['x-generator']) {
      const generator = headers['x-generator'];
      if (/WooCommerce/i.test(generator)) {
        return 'WooCommerce';
      }
      if (/WordPress/i.test(generator)) {
        return 'WordPress';
      }
      if (/Drupal/i.test(generator)) {
        return 'Drupal';
      }
      if (/Laravel/i.test(generator)) {
        return 'Laravel';
      }
    }

    return 'unknown';
  }

  function collectRuntimeCandidates(headers) {
    const names = [
      'x-powered-by',
      'x-generator',
      'x-aspnet-version',
      'x-aspnetmvc-version',
      'x-servlet-version',
      'x-runtime',
      'x-framework',
      'x-backend-server',
      'x-django-version',
      'x-fastapi-version',
      'x-laravel-cache',
      'server',
      'set-cookie'
    ];

    return names.map((name) => headers[name] || '').filter(Boolean);
  }

  function hasPhpSessionCookie(headers) {
    return /(?:^|[,;\s])PHPSESSID=/i.test(headers['set-cookie'] || '');
  }

  function hasCookieName(headers, name) {
    return new RegExp(`(?:^|[,;\\s])${escapeRegExp(name)}`, 'i').test(headers['set-cookie'] || '');
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function detectCdn(headers) {
    const server = headers.server || '';
    const via = headers.via || '';
    const xCache = headers['x-cache'] || '';
    const poweredBy = headers['x-powered-by'] || '';
    const cdnHeader = headers['x-cdn'] || headers.cdn || '';
    const combined = [server, via, xCache, poweredBy, cdnHeader, headers['x-served-by'] || ''].join(' ');

    if (headers['cf-ray'] || headers['cf-cache-status'] || /cloudflare/i.test(combined)) {
      return 'Cloudflare';
    }

    if (headers['x-amz-cf-id'] || headers['x-amz-cf-pop'] || /cloudfront/i.test(combined)) {
      return 'CloudFront';
    }

    if (hasHeaderPrefix(headers, 'x-akamai') || /akamai|edgesuite|edgekey/i.test(combined)) {
      return 'Akamai';
    }

    if (hasHeaderPrefix(headers, 'x-fastly') || headers['fastly-debug-digest'] || /fastly/i.test(combined)) {
      return 'Fastly';
    }

    if (headers['x-vercel-cache'] || headers['x-vercel-id'] || /vercel/i.test(combined)) {
      return 'Vercel';
    }

    if (headers['x-nf-request-id'] || /netlify/i.test(combined)) {
      return 'Netlify';
    }

    if (headers['cdn-pullzone'] || headers['cdn-uid'] || /bunnycdn|bunny\.net/i.test(combined)) {
      return 'BunnyCDN';
    }

    if (/jsdelivr/i.test(combined) || /cdn\.jsdelivr\.net/i.test(headers.link || '')) {
      return 'jsDelivr';
    }

    if (headers['x-goog-generation'] || headers['x-goog-metageneration'] || /google frontend|google edge|gws/i.test(combined)) {
      return 'Google CDN';
    }

    if (headers['x-azure-ref'] || headers['x-fd-int-roxy-purgeid'] || /azure front door|azurefd/i.test(combined)) {
      return 'Azure Front Door';
    }

    if (headers['x-tencent-cache'] || headers['x-cos-request-id'] || /tencent|qcloud|dnsv1/i.test(combined)) {
      return 'Tencent Cloud CDN';
    }

    if (headers['x-oss-request-id'] || headers.eagleid || /aliyun|alibaba|alicdn/i.test(combined)) {
      return 'Alibaba Cloud CDN';
    }

    if (headers['x-bce-request-id'] || headers['x-bce-debug-id'] || /baidu|yunjiasu|bcebos/i.test(combined)) {
      return 'Baidu Cloud Acceleration';
    }

    if (/imperva|incapsula/i.test(combined) || headers['x-iinfo']) {
      return 'Imperva';
    }

    if (/sucuri/i.test(combined) || headers['x-sucuri-id'] || headers['x-sucuri-cache']) {
      return 'Sucuri';
    }

    if (/keycdn/i.test(combined) || headers['x-edge-location']) {
      return 'KeyCDN';
    }

    if (headers['x-cache-status'] || xCache || cdnHeader || headers['x-served-by'] || via) {
      return 'Unknown CDN';
    }

    return 'no';
  }

  function hasHeaderPrefix(headers, prefix) {
    return Object.keys(headers).some((name) => name.startsWith(prefix));
  }

  function extractLocation(data) {
    const location = typeof data?.country === 'string' ? data.country : '';
    const parts = location.split('-').map((part) => part.trim()).filter(Boolean);

    return {
      city: parts.at(-1) || data?.city || data?.area || ''
    };
  }

  function extractCity(data) {
    return extractLocation(data).city;
  }

  function getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  function isIpv4(ip) {
    return Boolean(parseIpv4(ip));
  }

  function isPublicIpv4(ip) {
    const parts = parseIpv4(ip);
    if (!parts) {
      return false;
    }

    const [a, b] = parts;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }

  function parseIpv4(ip) {
    const parts = String(ip || '').split('.');
    if (parts.length !== 4) {
      return undefined;
    }

    const numbers = parts.map((part) => Number(part));
    return numbers.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? numbers : undefined;
  }

  function extractDnsAnswer(data) {
    if (data?.Status && data.Status !== 0) {
      return { status: `dns-${data.Status}` };
    }

    const answer = data?.Answer?.find((item) => item.type === 1 && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(item.data));
    return answer ? { ip: answer.data, status: 'ok' } : { status: 'no-a-record' };
  }

  function formatIpResult(result) {
    if (result.ip) {
      return result.ip;
    }

    switch (result.status) {
      case 'timeout':
        return 'dns timeout';
      case 'no-a-record':
        return 'no A record';
      case 'dns-failed':
        return 'dns failed';
      default:
        return result.status || 'unknown';
    }
  }

  const core = {
    normalizeHeaders,
    detectRuntime,
    collectRuntimeCandidates,
    hasPhpSessionCookie,
    hasCookieName,
    escapeRegExp,
    detectCdn,
    hasHeaderPrefix,
    extractLocation,
    extractCity,
    getHostname,
    isIpv4,
    isPublicIpv4,
    extractDnsAnswer,
    formatIpResult
  };

  root.PageInfoCore = core;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = core;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
