function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // List keys in the KV namespace (default limit is 1000)
    const listResult = await env.DATABASE.list();
    const history = [];

    for (const key of listResult.keys) {
      let domain = 's.careerup.kr';
      let code = key.name;
      
      const colonIndex = key.name.indexOf(':');
      if (colonIndex !== -1) {
        domain = key.name.substring(0, colonIndex);
        code = key.name.substring(colonIndex + 1);
      }

      const metadata = key.metadata || {};

      history.push({
        domain,
        shortCode: code,
        shortUrl: `https://${domain}/${code}`,
        originalUrl: metadata.originalUrl || '',
        clicks: metadata.clicks || 0,
        createdAt: metadata.createdAt || new Date().toISOString(),
        dbKey: key.name
      });
    }

    // Sort by createdAt descending
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return jsonResponse(history);

  } catch (err) {
    return jsonResponse({ error: err.message || 'Server error' }, 500);
  }
}
