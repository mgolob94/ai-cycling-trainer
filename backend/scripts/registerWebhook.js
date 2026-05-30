// Registers (or inspects/deletes) the Strava push subscription so Strava sends
// activity events to our webhook. Run once after deployment.
//
//   node backend/scripts/registerWebhook.js              # create subscription
//   node backend/scripts/registerWebhook.js list         # show current subscription
//   node backend/scripts/registerWebhook.js delete <id>  # remove a subscription
//
// Needs in .env: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN,
// and STRAVA_WEBHOOK_CALLBACK_URL (or pass the callback URL as the first arg).

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const axios = require('axios');

const BASE = 'https://www.strava.com/api/v3/push_subscriptions';
const {
  STRAVA_CLIENT_ID: clientId,
  STRAVA_CLIENT_SECRET: clientSecret,
  STRAVA_WEBHOOK_VERIFY_TOKEN: verifyToken,
  STRAVA_WEBHOOK_CALLBACK_URL: envCallback,
} = process.env;

async function list() {
  const { data } = await axios.get(BASE, {
    params: { client_id: clientId, client_secret: clientSecret },
  });
  console.log('Current subscriptions:', JSON.stringify(data, null, 2));
}

async function remove(id) {
  await axios.delete(`${BASE}/${id}`, {
    params: { client_id: clientId, client_secret: clientSecret },
  });
  console.log(`Deleted subscription ${id}`);
}

async function create(callbackUrl) {
  const { data } = await axios.post(BASE, {
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken,
  });
  console.log('Subscription created:', JSON.stringify(data, null, 2));
}

(async () => {
  if (!clientId || !clientSecret || !verifyToken) {
    console.error('Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_WEBHOOK_VERIFY_TOKEN.');
    process.exit(1);
  }

  const [cmd, arg] = process.argv.slice(2);
  try {
    if (cmd === 'list') {
      await list();
    } else if (cmd === 'delete') {
      if (!arg) throw new Error('Usage: registerWebhook.js delete <subscription_id>');
      await remove(arg);
    } else {
      const callbackUrl = cmd || envCallback;
      if (!callbackUrl) throw new Error('Provide STRAVA_WEBHOOK_CALLBACK_URL or pass the callback URL as an argument.');
      await create(callbackUrl);
    }
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    process.exit(1);
  }
})();
