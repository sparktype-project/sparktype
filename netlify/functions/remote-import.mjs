const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const target = event.queryStringParameters?.url;
  if (!target) {
    return jsonResponse(400, { error: 'Missing url query parameter' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return jsonResponse(400, { error: 'Invalid target URL' });
  }

  if (!/^https?:$/.test(targetUrl.protocol)) {
    return jsonResponse(400, { error: 'Only http and https URLs are supported' });
  }

  try {
    const upstream = await fetch(targetUrl, { method: 'GET' });
    const arrayBuffer = await upstream.arrayBuffer();
    const base64Body = Buffer.from(arrayBuffer).toString('base64');

    return {
      statusCode: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': upstream.headers.get('cache-control') || 'no-store',
      },
      body: base64Body,
      isBase64Encoded: true,
    };
  } catch (error) {
    return jsonResponse(502, {
      error: error instanceof Error ? error.message : 'Proxy request failed',
    });
  }
}
