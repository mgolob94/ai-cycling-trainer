const axios = require('axios');
const { supabaseAdmin } = require('../db/supabase');

// Expo Push API. Accepts up to 100 messages per request.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

/** All Expo push tokens registered for a user. */
async function getUserTokens(userId) {
  const { data, error } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((row) => row.token).filter(Boolean);
}

/** Drop a token that Expo reports as no longer valid. */
async function removeToken(token) {
  await supabaseAdmin.from('push_tokens').delete().eq('token', token);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Send a batch of Expo push messages. Messages: { to, title, body, data, sound }.
 * Sends in chunks of 100, inspects each ticket, and prunes tokens Expo reports
 * as DeviceNotRegistered. Never throws — push is best-effort.
 */
async function send(messages) {
  const tickets = [];

  for (const batch of chunk(messages, BATCH_SIZE)) {
    try {
      const { data } = await axios.post(EXPO_PUSH_URL, batch, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      const batchTickets = data?.data || [];

      batchTickets.forEach((ticket, i) => {
        tickets.push(ticket);
        if (ticket.status === 'error') {
          console.warn('[push] ticket error:', ticket.message, ticket.details?.error);
          if (ticket.details?.error === 'DeviceNotRegistered' && batch[i]?.to) {
            removeToken(batch[i].to).catch(() => {});
          }
        }
      });
    } catch (err) {
      console.warn('[push] batch send failed:', err.response?.data || err.message);
    }
  }

  return tickets;
}

/** Build and send a notification to every device a user has registered. */
async function sendToUser(userId, { title, body, data = {} }) {
  const tokens = await getUserTokens(userId);
  if (!tokens.length) return { sent: 0, tickets: [] };

  const messages = tokens.map((to) => ({ to, sound: 'default', title, body, data }));
  const tickets = await send(messages);
  return { sent: messages.length, tickets };
}

module.exports = { getUserTokens, removeToken, send, sendToUser };
