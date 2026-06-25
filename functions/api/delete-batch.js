function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const reqBody = await request.json();
    const { keys } = reqBody;

    if (!keys || !Array.isArray(keys)) {
      return jsonResponse({ error: 'keys array is required.' }, 400);
    }

    // Delete keys in parallel
    await Promise.all(keys.map(key => env.DATABASE.delete(key)));

    return jsonResponse({ success: true });

  } catch (err) {
    return jsonResponse({ error: err.message || 'Server error' }, 500);
  }
}
