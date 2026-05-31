// Monthly review cron — runs on the 1st at 09:00.
//   supabase functions deploy monthly-review-cron
//   select cron.schedule('monthly-review','0 9 1 * *',
//     $$ select net.http_post(
//          url := 'https://<project>.functions.supabase.co/monthly-review-cron',
//          headers := '{"Authorization":"Bearer <anon-or-service-key>"}'::jsonb) $$);
// Logic lives in the Node backend; secrets: BACKEND_URL, CRON_SECRET.

Deno.serve(async () => {
  const backendUrl = Deno.env.get('BACKEND_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!backendUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: 'Missing BACKEND_URL or CRON_SECRET' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  const res = await fetch(`${backendUrl}/progress/monthly-review-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': cronSecret },
    body: JSON.stringify({}),
  });
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
});
