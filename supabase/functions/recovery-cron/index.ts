// Daily recovery-score cron (runs 06:00). Deploy and schedule with:
//   supabase functions deploy recovery-cron
//   then add a schedule (Dashboard → Edge Functions → Schedules) or via SQL:
//     select cron.schedule(
//       'recovery-daily',
//       '0 6 * * *',
//       $$ select net.http_post(
//            url := 'https://<project>.functions.supabase.co/recovery-cron',
//            headers := '{"Authorization":"Bearer <anon-or-service-key>"}'::jsonb
//          ); $$
//     );
//
// The recovery math lives in the Node backend, so this function just invokes
// the batch endpoint, authenticated with a shared secret.
//
// Required function secrets (supabase secrets set ...):
//   BACKEND_URL   — e.g. https://api.yourdomain.com
//   CRON_SECRET   — must match the backend's CRON_SECRET

Deno.serve(async () => {
  const backendUrl = Deno.env.get('BACKEND_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!backendUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: 'Missing BACKEND_URL or CRON_SECRET' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(`${backendUrl}/recovery/calculate-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': cronSecret },
    body: JSON.stringify({}),
  });

  const body = await res.text();
  return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
});
