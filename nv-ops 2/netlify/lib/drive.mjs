// Saves files into your own Google Drive through a small Google Apps Script web app
// (see google-drive-backup.gs). No Google Cloud project or extra service needed.
function env(name) {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(name); if (v) return String(v).trim(); } catch (e) {}
  return process.env[name] ? String(process.env[name]).trim() : '';
}
export function driveConfigured() { return !!(env('GDRIVE_WEBHOOK_URL') && env('GDRIVE_SECRET')); }

/** Errors from Google Drive carry a plain-English message that the app shows as it is. */
function driveError(msg) { const e = new Error(msg); e.driveError = true; return e; }

export async function saveToDrive(files, { folder = 'NV Ops Backups', shareWith = '' } = {}) {
  if (!driveConfigured()) throw driveError('Google Drive is not set up yet. Add GDRIVE_WEBHOOK_URL and GDRIVE_SECRET in Netlify, then redeploy.');
  const url = env('GDRIVE_WEBHOOK_URL');
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[^/]+\/exec$/.test(url)) throw driveError('GDRIVE_WEBHOOK_URL in Netlify is not a Google Apps Script web app address. It should start https://script.google.com/macros/s/ and end in /exec. Copy it again from Deploy, Manage deployments, then redeploy.');
  const body = JSON.stringify({ secret: env('GDRIVE_SECRET'), folder, shareWith,
    files: files.map(f => ({ name: f.name, mimeType: f.mimeType, base64: Buffer.from(f.content).toString('base64') })) });
  const doFetch = globalThis.__testDrive || fetch;
  // Stop waiting before Netlify's own time limit, so the app can say what happened
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = ctl ? setTimeout(() => ctl.abort(), 9000) : null;
  let r, text;
  try {
    r = await doFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, redirect: 'follow', signal: ctl ? ctl.signal : undefined });
    text = await r.text();
  } catch (e) {
    if (e && e.name === 'AbortError') throw driveError('Google Drive took too long to reply. The backup may still appear in the folder in a minute; if not, try again.');
    throw driveError('Could not reach Google Drive just now (' + (e && e.message || 'network error') + '). Please try again.');
  } finally { if (timer) clearTimeout(timer); }
  let j;
  try { j = JSON.parse(text); } catch (e) {
    const page = String(text || '');
    if (r && (r.status === 404 || /not found|Script function not found/i.test(page))) throw driveError('Google could not find that web app. The address in GDRIVE_WEBHOOK_URL may be from a deleted or old deployment. In the Apps Script, use Deploy, Manage deployments, copy the Web app URL into Netlify, then redeploy.');
    if (/accounts\.google\.com|ServiceLogin|Sign in/i.test(page) || (r && (r.status === 401 || r.status === 403))) throw driveError('Google asked for a sign-in, so the web app is not open to the app. In the Apps Script deployment set "Who has access" to Anyone (not "Anyone with a Google account"), deploy a new version, then try again.');
    throw driveError('Google Drive did not reply as expected (status ' + (r ? r.status : '?') + '). Check the Apps Script is deployed as a web app with access for Anyone.');
  }
  if (!j.ok) {
    const why = String(j.error || 'unknown reason');
    if (/Wrong secret/i.test(why)) throw driveError('Google Drive refused the backup: the secret does not match. GDRIVE_SECRET in Netlify must be exactly the same as SECRET in the Apps Script (Project Settings, Script properties), with no spaces before or after. Then redeploy.');
    if (/permission|authori[sz]/i.test(why)) throw driveError('The Apps Script does not have permission to use your Drive. Open it, run "setup" once and click Allow, then deploy a new version.');
    throw driveError('Google Drive refused the backup: ' + why);
  }
  return j;
}
