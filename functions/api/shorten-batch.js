function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function generateShortCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const reqBody = await request.json();
    const { items } = reqBody;

    if (!items || !Array.isArray(items)) {
      return jsonResponse({ error: 'Items array is required.' }, 400);
    }

    const ALLOWED_DOMAINS = ['s.careerup.kr', 's.myown.kr', 's.solcompany.kr'];
    const RESERVED = new Set(['api', 'public', 'index.html', 'style.css', 'app.js', 'favicon.ico']);
    const results = [];

    for (const item of items) {
      const { url, domain, customCode } = item;
      const targetDomain = domain || 's.careerup.kr';

      if (!url) {
        results.push({ success: false, error: 'URL is required.', originalUrl: url });
        continue;
      }

      if (!isValidUrl(url)) {
        results.push({ success: false, error: 'Invalid URL format (must start with http:// or https://).', originalUrl: url });
        continue;
      }

      if (!ALLOWED_DOMAINS.includes(targetDomain)) {
        results.push({ success: false, error: 'Invalid domain.', originalUrl: url });
        continue;
      }

      let code = customCode ? customCode.trim() : '';
      let dbKey = '';

      if (code) {
        if (!/^[a-zA-Z0-9_-]{3,20}$/.test(code)) {
          results.push({ success: false, error: 'Code must be 3-20 letters/numbers/hyphens/underscores.', originalUrl: url, customCode: code });
          continue;
        }
        if (RESERVED.has(code.toLowerCase())) {
          results.push({ success: false, error: 'Reserved custom code.', originalUrl: url, customCode: code });
          continue;
        }
        dbKey = `${targetDomain}:${code}`;
        const existing = await env.DATABASE.get(dbKey);
        if (existing) {
          results.push({ success: false, error: 'Code already in use for this domain.', originalUrl: url, customCode: code });
          continue;
        }
      } else {
        let attempts = 0;
        do {
          code = generateShortCode();
          dbKey = `${targetDomain}:${code}`;
          attempts++;
        } while ((await env.DATABASE.get(dbKey)) && attempts < 100);

        if (await env.DATABASE.get(dbKey)) {
          results.push({ success: false, error: 'Failed to generate unique code.', originalUrl: url });
          continue;
        }
      }

      const createdAt = new Date().toISOString();
      const metadata = {
        originalUrl: url,
        clicks: 0,
        createdAt
      };

      // Store in KV namespace
      await env.DATABASE.put(dbKey, url, { metadata });

      results.push({
        success: true,
        domain: targetDomain,
        shortCode: code,
        shortUrl: `https://${targetDomain}/${code}`,
        originalUrl: url,
        clicks: 0,
        createdAt,
        dbKey
      });
    }

    return jsonResponse({ results });

  } catch (err) {
    return jsonResponse({ error: err.message || 'Server error' }, 500);
  }
}
