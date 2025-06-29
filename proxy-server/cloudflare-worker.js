// Cloudflare Worker for Netlify API proxy
// Deploy this to Cloudflare Workers

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST requests to our proxy endpoints
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    
    try {
      if (url.pathname === '/api/netlify/deploy') {
        return await handleNetlifyDeploy(request);
      } else if (url.pathname === '/api/netlify/create-site') {
        return await handleNetlifyCreateSite(request);
      }
      
      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};

async function handleNetlifyCreateSite(request) {
  const { apiToken, siteName } = await request.json();
  
  const response = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: siteName ? sanitizeSiteName(siteName) : undefined
    })
  });

  const data = await response.json();
  
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function handleNetlifyDeploy(request) {
  const formData = await request.formData();
  const apiToken = formData.get('apiToken');
  const siteId = formData.get('siteId');
  const zipFile = formData.get('zipFile');

  if (!apiToken || !siteId || !zipFile) {
    return new Response('Missing required fields', { 
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Deploy to Netlify
  const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/zip',
    },
    body: zipFile
  });

  const data = await response.json();
  
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function sanitizeSiteName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 63);
}