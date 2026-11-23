// Lotus Dental edit screen: GitHub login helper (Cloudflare Worker).
// The edit screen (/admin) opens this in a small window; GitHub asks the person to approve;
// this helper swaps GitHub's one-time code for a login key and hands it back to the edit screen.
// Needs: GITHUB_CLIENT_ID (plain setting) and GITHUB_CLIENT_SECRET (secret), set in Cloudflare.
// Only the sites listed in ALLOWED_ORIGINS may receive the login key.

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

    if (url.pathname === '/auth') {
      if (!env.GITHUB_CLIENT_ID) return new Response('Login helper is not set up yet (missing GITHUB_CLIENT_ID).', { status: 500 });
      const state = crypto.randomUUID();
      const scope = url.searchParams.get('scope') || 'public_repo,user';
      const gh = new URL('https://github.com/login/oauth/authorize');
      gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      gh.searchParams.set('redirect_uri', url.origin + '/callback');
      gh.searchParams.set('scope', scope);
      gh.searchParams.set('state', state);
      return new Response(null, { status: 302, headers: {
        Location: gh.toString(),
        'Set-Cookie': `lotus_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
      } });
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const m = (req.headers.get('Cookie') || '').match(/lotus_state=([^;]+)/);
      if (!code || !m || m[1] !== state) return reply('error', { error: 'Login expired or was interrupted. Please close this window and try again.' }, allowed);
      const r = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'lotus-cms-auth' },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: url.origin + '/callback' })
      });
      const data = await r.json();
      if (!data.access_token) return reply('error', { error: data.error_description || 'GitHub did not approve the login.' }, allowed);
      return reply('success', { token: data.access_token, provider: 'github' }, allowed);
    }

    return new Response('Lotus Dental login helper is running.', { headers: { 'content-type': 'text/plain' } });
  }
};

// Sends the result back to the edit screen window (Decap CMS handshake), only to allowed sites.
function reply(status, content, allowed) {
  const msg = 'authorization:github:' + status + ':' + JSON.stringify(content);
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>Lotus Dental login</title></head>
<body style="font-family:system-ui;padding:30px">${status === 'success' ? 'Logged in. This window will close.' : 'Login problem: ' + String(content.error).replace(/</g, '&lt;')}
<script>
(function () {
  var allowed = ${JSON.stringify(allowed)};
  var msg = ${JSON.stringify(msg)};
  function receive(e) {
    if (allowed.indexOf(e.origin) === -1) return;
    window.opener.postMessage(msg, e.origin);
    window.removeEventListener('message', receive, false);
    setTimeout(function () { window.close(); }, 400);
  }
  window.addEventListener('message', receive, false);
  if (window.opener) window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`;
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
