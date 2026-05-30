// Daily adaptive-training cron (runs 07:00, after the 06:00 recovery cron).
// Deploy + schedule:
//   supabase functions deploy training-adapt-cron
//   select cron.schedule(
//     'training-adapt-daily',
//     '0 7 * * *',
//     $$ select net.http_post(
//          url := 'https://<project>.functions.supabase.co/training-adapt-cron',
//          headers := '{"Authorization":"Bearer <anon-or-service-key>"}'::jsonb
//        ); $$
//   );
//
// Adaptation runs in the Node backend; this just invokes the batch endpoint.
// Required secrets: BACKEND_URL, CRON_SECRET (must match the backend).

Deno.serve(async () => {
  const backendUrl = Deno.env.get('BACKEND_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!backendUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: 'Missing BACKEND_URL or CRON_SECRET' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(`${backendUrl}/training/adapt-for-recovery-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': cronSecret },
    body: JSON.stringify({}),
  });

  const body = await res.text();
  return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
});
