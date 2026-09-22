// Saves the site banner (banner.json) to GitHub on behalf of the Admin tab.
// Runs server-side on Netlify, so the GitHub token never reaches a visitor's
// browser and never has to be committed to the repo.
//
// Requires two environment variables, set in the Netlify dashboard under
// Site configuration -> Environment variables:
//   GITHUB_TOKEN   - a fine-grained GitHub PAT scoped to just this repo,
//                    with Contents: Read and write
//   ADMIN_PASSWORD - must match the ADMIN_PASSWORD constant in index.html

const GITHUB_OWNER  = 'kdrombosky';
const GITHUB_REPO   = 'yinzermanor';
const GITHUB_BRANCH = 'main';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!GITHUB_TOKEN || !ADMIN_PASSWORD) {
    return new Response(JSON.stringify({
      error: 'Server not configured: set GITHUB_TOKEN and ADMIN_PASSWORD in Netlify environment variables, then redeploy.'
    }), { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  if (body.password !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Incorrect password' }), { status: 401 });
  }

  const enabled = !!body.enabled;
  const message = String(body.message || '').slice(0, 200).trim();

  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/banner.json`;
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'yinzermanor-banner-admin',
    };

    const current = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, { headers });
    const currentJson = current.ok ? await current.json() : null;

    const content = JSON.stringify({ enabled, message }, null, 2);
    const payload = {
      message: 'Update site banner via admin',
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch: GITHUB_BRANCH,
      ...(currentJson && currentJson.sha ? { sha: currentJson.sha } : {}),
    };

    const resp = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(payload) });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`GitHub API ${resp.status}: ${errText}`);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
