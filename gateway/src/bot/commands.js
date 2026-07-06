// ============================================================
// Slash command definitions (shared by the bot + registrar).
// ============================================================

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link and verify your Reddit account')
    .addStringOption((o) => o.setName('username').setDescription('Your Reddit username (without u/)').setRequired(true)),

  new SlashCommandBuilder().setName('gettask').setDescription('Get your next task (one at a time, sent privately)'),

  new SlashCommandBuilder().setName('mytask').setDescription('Show your current active task'),

  new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit the Reddit post URL for your active task')
    .addStringOption((o) => o.setName('url').setDescription('Direct link to your Reddit post').setRequired(true)),

  new SlashCommandBuilder().setName('reject').setDescription('Reject your active task (a reason is required)'),

  new SlashCommandBuilder().setName('history').setDescription('View your submission history'),

  new SlashCommandBuilder().setName('earnings').setDescription('View your available, pending and lifetime earnings'),

  new SlashCommandBuilder().setName('wallet').setDescription('Set or view your payout method (USDT Polygon or UPI)'),

  new SlashCommandBuilder().setName('whoami').setDescription('Show which Reddit account is linked to you'),

  new SlashCommandBuilder().setName('signout').setDescription('Unlink your Reddit account from this Discord user'),

  new SlashCommandBuilder().setName('help').setDescription('How this bot works'),

  // Operator-only: drop a persistent Task Desk panel + config status.
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('(Operator) Post the Task Desk panel and show config status')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // Operator-only: activity stats.
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('(Operator) View worker + task activity stats')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // Operator-only: payout report (who is owed how much + their wallet) as CSV.
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('(Operator) Payout report — who to pay, how much, and where')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // Operator-only: record a manual payout to a worker.
  new SlashCommandBuilder()
    .setName('paid')
    .setDescription('(Operator) Record a payout you sent to a worker')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((o) => o.setName('user').setDescription('The worker you paid').setRequired(true))
    .addNumberOption((o) => o.setName('amount').setDescription('Amount paid (USD)').setRequired(true).setMinValue(0.01))
    .addStringOption((o) => o.setName('reference').setDescription('Tx hash / UPI ref (optional)')),
].map((c) => c.toJSON());
