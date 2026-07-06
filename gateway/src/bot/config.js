// ============================================================
// Central config, loaded from .env
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    console.error(`❌  ${name} is missing in your .env file.`);
    process.exit(1);
  }
  return v.trim();
}

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID || null,

  operatorName: process.env.OPERATOR_NAME || 'Tasks',

  // One task per worker; cooldown before the next one.
  cooldownHours: parseFloat(process.env.TASK_COOLDOWN_HOURS ?? '6'),
  get cooldownMs() {
    return this.cooldownHours * 60 * 60 * 1000;
  },

  // Reject spam protection: max rejects per user in a rolling 24h window.
  rejectLimitPerDay: parseInt(process.env.REJECT_LIMIT_PER_DAY ?? '3', 10),

  // 'dm' or 'ticket'
  deliveryMode: (process.env.DELIVERY_MODE || 'ticket').toLowerCase(),

  operatorLogChannelId: process.env.OPERATOR_LOG_CHANNEL_ID || null,
  staffRoleId: process.env.STAFF_ROLE_ID || null,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || null,

  // Brand accent for embeds
  color: 0x6366f1,
};

// Validate the essentials only when actually starting the bot.
export function assertRuntimeConfig() {
  required('DISCORD_TOKEN');
  required('REDWIRE_API_KEY');
  if (!['dm', 'ticket'].includes(config.deliveryMode)) {
    console.error("❌  DELIVERY_MODE must be 'dm' or 'ticket'.");
    process.exit(1);
  }
}
