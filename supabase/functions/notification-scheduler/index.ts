// Notification scheduler — runs every 15 minutes.
//   supabase functions deploy notification-scheduler
//   select cron.schedule(
//     'notification-scheduler',
//     '*/15 * * * *',
//     $$ select net.http_post(
//          url := 'https://<project>.functions.supabase.co/notification-scheduler',
//          headers := '{"Authorization":"Bearer <anon-or-service-key>"}'::jsonb
//        ); $$
//   );
//
// Sending logic + anti-spam live in the Node backend; this just invokes the
// guarded batch endpoint. Secrets: BACKEND_URL, CRON_SECRET.

Deno.serve(async () => {
  const backendUrl = Deno.env.get('BACKEND_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!backendUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: 'Missing BACKEND_URL or CRON_SECRET' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const res = await fetch(`${backendUrl}/notifications/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': cronSecret },
    body: JSON.stringify({}),
  });
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
});
