export async function onRequest(context) {
  const { request, params, env, next } = context;
  const code = params.code;

  // Reserved paths that should fall through to static asset hosting
  const RESERVED = new Set(['api', 'public', 'index.html', 'style.css', 'app.js', 'favicon.ico']);
  if (RESERVED.has(code.toLowerCase())) {
    return await next();
  }

  // Determine host domain
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  
  // Database Key (domain:code)
  const dbKey = `${host}:${code}`;
  
  let originalUrl = await env.DATABASE.get(dbKey);
  let matchedKey = dbKey;

  // Local development or default pages.dev fallback
  if (!originalUrl && (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.pages.dev'))) {
    const ALLOWED_DOMAINS = ['s.careerup.kr', 's.myown.kr', 's.solcompany.kr'];
    for (const d of ALLOWED_DOMAINS) {
      const fallbackKey = `${d}:${code}`;
      const fallbackUrl = await env.DATABASE.get(fallbackKey);
      if (fallbackUrl) {
        originalUrl = fallbackUrl;
        matchedKey = fallbackKey;
        break;
      }
    }
  }

  // Legacy fallback (look up by code without domain prefix)
  if (!originalUrl) {
    const legacyUrl = await env.DATABASE.get(code);
    if (legacyUrl) {
      originalUrl = legacyUrl;
      matchedKey = code;
    }
  }

  if (originalUrl) {
    // Asynchronously update click count metadata in the background
    context.waitUntil((async () => {
      try {
        const keyInfo = await env.DATABASE.getWithMetadata(matchedKey);
        const metadata = keyInfo.metadata || {};
        metadata.clicks = (metadata.clicks || 0) + 1;
        metadata.originalUrl = originalUrl;
        metadata.createdAt = metadata.createdAt || new Date().toISOString();
        
        await env.DATABASE.put(matchedKey, originalUrl, { metadata });
      } catch (err) {
        console.error("Failed to update clicks in KV:", err);
      }
    })());

    // Perform redirect
    return Response.redirect(originalUrl, 302);
  }

  // Not found fallback redirect
  return Response.redirect(`${url.origin}/?error=notfound`, 302);
}
