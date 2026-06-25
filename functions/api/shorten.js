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
    const { url, customCode, domain } = reqBody;

    if (!url) {
      return jsonResponse({ error: 'URL is required.' }, 400);
    }

    if (!isValidUrl(url)) {
      return jsonResponse({ error: 'Please enter a valid URL (must start with http:// or https://).' }, 400);
    }

    const ALLOWED_DOMAINS = ['s.careerup.kr', 's.myown.kr', 's.solcompany.kr'];
    const targetDomain = domain || 's.careerup.kr';
    if (!ALLOWED_DOMAINS.includes(targetDomain)) {
      return jsonResponse({ error: 'Invalid domain selected.' }, 400);
    }

    let code = customCode ? customCode.trim() : '';

    if (code) {
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(code)) {
        return jsonResponse({ error: 'Custom code must be 3-20 alphanumeric characters, hyphens, or underscores.' }, 400);
      }
      
      const RESERVED = new Set(['api', 'public', 'index.html', 'style.css', 'app.js', 'favicon.ico']);
      if (RESERVED.has(code.toLowerCase())) {
        return jsonResponse({ error: 'This custom code is reserved.' }, 400);
      }

      const dbKey = `${targetDomain}:${code}`;
      const existing = await env.DATABASE.get(dbKey);
      if (existing) {
        return jsonResponse({ error: 'This custom code is already in use for this domain.' }, 400);
      }
    } else {
      let attempts = 0;
      let dbKey;
      do {
        code = generateShortCode();
        dbKey = `${targetDomain}:${code}`;
        attempts++;
      } while ((await env.DATABASE.get(dbKey)) && attempts < 100);

      if (await env.DATABASE.get(dbKey)) {
        return jsonResponse({ error: 'Failed to generate a unique short code. Please try again.' }, 500);
      }
    }

    const dbKey = `${targetDomain}:${code}`;
    const createdAt = new Date().toISOString();
    const metadata = {
      originalUrl: url,
      clicks: 0,
      createdAt
    };

    // Store in KV with metadata
    await env.DATABASE.put(dbKey, url, { metadata });

    return jsonResponse({
      domain: targetDomain,
      shortCode: code,
      shortUrl: `https://${targetDomain}/${code}`,
      originalUrl: url,
      clicks: 0,
      createdAt,
      dbKey
    }, 201);

  } catch (err) {
    return jsonResponse({ error: err.message || 'Server error' }, 500);
  }
}
