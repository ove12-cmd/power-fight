// Netlify Scheduled Function — runs daily to keep the Supabase Free-tier
// project from auto-pausing after 7 days of inactivity ("activity" = any API
// request). The key below is the public "publishable" (anon) key that already
// ships in the site's client-side JS, so it is not a secret.
//
// Schedule is declared via the exported config below (@daily = 00:00 UTC).
// View runs in the Netlify dashboard → Logs → Functions → keepalive.

const SUPABASE_URL = 'https://nzfqsgdzbainfijbhwag.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OPR8hTocm9g1T79HTW3Qvg_y-0yj2Al';

export default async () => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/settings?select=key&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const ok = res.ok;
  console.log(`[keepalive] Supabase responded HTTP ${res.status} — ${ok ? 'awake' : 'PROBLEM'}`);
  return new Response(`keepalive ${res.status}`, { status: ok ? 200 : 500 });
};

export const config = { schedule: '@daily' };
