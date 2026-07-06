// ============================================================
// Redwire Operator Bot
// Posters use Discord instead of the website: verify → get ONE
// task (privately) → submit → earn. One task at a time, with an
// operator-set cooldown between tasks. Workers never see each
// other's tasks; the operator sees everything via the log channel.
// ============================================================

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
  MessageFlags,
  REST,
  Routes,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';

import { config, assertRuntimeConfig } from './config.js';
import { commands } from './commands.js';
import * as api from './api.js';
import * as store from './store.js';
import * as ui from './ui.js';
import * as payout from './payout.js';
import { deliverTask, operatorLog } from './delivery.js';

const EPH = { flags: MessageFlags.Ephemeral };

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

// ── helpers ──────────────────────────────────────────────────

function claimIsLive(claim) {
  if (!claim) return false;
  const exp = claim.expiresAt || new Date(claim.expires_at).getTime();
  return exp > Date.now();
}

// Pick and claim exactly one task of the requested type for this worker.
// Reuses the website's claim error handling (no_slots_available → try next).
async function claimOneTask(redditUsername, type) {
  const campaigns = await api.getCampaigns();
  const open = campaigns.filter(
    (c) => (c.available_slots ?? 0) > 0 && c.subreddits?.length && api.campaignType(c) === type
  );
  for (const campaign of open) {
    const subreddit = campaign.subreddits[0];
    try {
      const res = await api.claimTask(campaign.id, redditUsername, subreddit);
      return api.enrichClaim(res, campaign, subreddit);
    } catch (err) {
      if (err?.data?.error === 'no_slots_available') continue; // slot taken, try next
      throw err;
    }
  }
  return null; // nothing claimable of this type
}

// ── verify flow ──────────────────────────────────────────────

async function doVerify(interaction, username) {
  username = username.replace(/^u\//i, '').trim();
  try {
    const res = await api.verifyAccount(username);
    if (res.status === 'verified' || res.status === 'already_registered') {
      store.upsertUser(interaction.user.id, { redditUsername: username, pendingVerify: null });
      return interaction.editReply({ content: `✅ Verified! Linked to **u/${username}**. Set your payout with **/wallet**, then use **/gettask** to pick up your first task.` });
    }
    if (res.status === 'pending' && res.token) {
      store.upsertUser(interaction.user.id, { pendingVerify: { username, token: res.token } });
      return interaction.editReply({ embeds: [ui.verifyTokenEmbed(username, res.token)], components: [ui.verifyButtons(username)] });
    }
    return interaction.editReply({ content: `⚠️ ${res.message || 'Verification is required to continue.'}` });
  } catch (err) {
    return interaction.editReply({ content: `❌ ${api.verifyErrorMessage(err)}` });
  }
}

async function recheckVerify(interaction, username) {
  try {
    const res = await api.verifyAccount(username);
    if (res.status === 'verified' || res.status === 'already_registered') {
      store.upsertUser(interaction.user.id, { redditUsername: username, pendingVerify: null });
      return interaction.editReply({ content: `✅ Verified! Linked to **u/${username}**. Set your payout with **/wallet**, then use **/gettask** to pick up your first task.`, embeds: [], components: [] });
    }
    return interaction.editReply({ content: '⏳ Token not found in your bio yet. Save your Reddit profile and try again.' });
  } catch (err) {
    const msg = err?.data?.message || err?.data?.error || '';
    return interaction.editReply({ content: `❌ ${msg === 'not_eligible' ? api.ELIGIBILITY_TEXT : msg || 'Verification failed. Ensure the token is in your bio.'}` });
  }
}

// ── get task flow ────────────────────────────────────────────

async function doGetTask(interaction, type) {
  const rec = store.getUser(interaction.user.id);
  if (!rec?.redditUsername) return interaction.editReply({ embeds: [ui.needVerifyEmbed()] });

  // Already holding a live task?
  if (claimIsLive(rec.activeClaim)) {
    const where = rec.ticketChannelId && config.deliveryMode === 'ticket' ? ` (see <#${rec.ticketChannelId}>)` : '';
    return interaction.editReply({ content: `📌 You already have an active task${where}. Finish or reject it before getting another.` });
  }
  // Stale/expired claim → clear it silently
  if (rec.activeClaim && !claimIsLive(rec.activeClaim)) store.clearActiveClaim(interaction.user.id);

  // Cooldown gate
  const cd = store.cooldownStatus(interaction.user.id, config.cooldownMs);
  if (!cd.ok) return interaction.editReply({ embeds: [ui.cooldownEmbed(cd.remainingMs)] });

  // Claim one of the requested type
  let claim;
  try {
    claim = await claimOneTask(rec.redditUsername, type);
  } catch (err) {
    return interaction.editReply({ content: `❌ ${err?.data?.error || err?.data?.message || 'Failed to get a task.'}` });
  }
  if (!claim) return interaction.editReply({ embeds: [ui.noTasksOfTypeEmbed(type)] });

  store.setActiveClaim(interaction.user.id, claim);

  const payload = { embeds: [ui.taskEmbed(claim, `<@${interaction.user.id}>`)], components: [ui.taskButtons(claim)] };
  try {
    const res = await deliverTask(interaction, payload);
    await operatorLog(client, ui.logClaim(`<@${interaction.user.id}>`, rec.redditUsername, claim));
    const dest = res.where === 'ticket' ? `your private ticket <#${res.channelId}>` : 'your DMs';
    await interaction.editReply({ content: `🎯 Task sent to ${dest}. It's yours for a limited time — good luck!` });
  } catch (err) {
    // Delivery failed (e.g. DMs closed). Roll back so they aren't stuck holding an undelivered task.
    store.clearActiveClaim(interaction.user.id);
    await interaction.editReply({ content: '❌ Could not deliver your task. If using DM mode, enable DMs from server members and try again.' });
  }
}

// ── submit / reject ──────────────────────────────────────────

async function doSubmit(interaction, url) {
  const rec = store.getUser(interaction.user.id);
  if (!rec?.redditUsername) return interaction.editReply({ embeds: [ui.needVerifyEmbed()] });
  if (!claimIsLive(rec.activeClaim)) {
    if (rec.activeClaim) store.clearActiveClaim(interaction.user.id);
    return interaction.editReply({ content: '📭 You have no active task to submit. Use **/gettask**.' });
  }
  if (!api.isValidRedditUrl(url)) {
    return interaction.editReply({ content: '❌ URL must be a direct link to your Reddit post starting with https://reddit.com/' });
  }
  try {
    await api.submitPost(rec.activeClaim.claim_id, url);
    const payout = Number(rec.activeClaim.payout).toFixed(2);
    await operatorLog(client, ui.logEvent('📮 Post submitted', 0x22c55e, `<@${interaction.user.id}>`, rec.redditUsername, { name: 'Post', value: url }));
    store.recordSubmit();
    store.clearActiveClaim(interaction.user.id);
    const cdText = `Next task available in ~${config.cooldownHours}h.`;
    return interaction.editReply({ content: `✅ Submitted! Your post is being verified. You'll earn **$${payout}** once cleared.\n⏳ ${cdText}` });
  } catch (err) {
    return interaction.editReply({ content: `❌ ${err?.data?.message || 'Failed to submit post URL'}` });
  }
}

async function doReject(interaction, reason) {
  const rec = store.getUser(interaction.user.id);
  if (!claimIsLive(rec?.activeClaim)) {
    if (rec?.activeClaim) store.clearActiveClaim(interaction.user.id);
    return interaction.editReply({ content: '📭 You have no active task to reject.' });
  }
  if (!reason || reason.trim().length < api.MIN_REJECT_REASON) {
    return interaction.editReply({ content: `❌ Please give a detailed reason (at least ${api.MIN_REJECT_REASON} characters).` });
  }
  // Reject spam protection: max N rejects per rolling 24h.
  const rl = store.rejectLimitStatus(interaction.user.id, config.rejectLimitPerDay);
  if (!rl.ok) return interaction.editReply({ embeds: [ui.rejectLimitEmbed(rl.resetAt, config.rejectLimitPerDay)] });
  try {
    await api.rejectTask(rec.activeClaim.claim_id, reason.trim());
    store.recordReject(interaction.user.id);
    await operatorLog(client, ui.logEvent('🚫 Task rejected', 0xef4444, `<@${interaction.user.id}>`, rec.redditUsername, { name: 'Reason', value: reason.slice(0, 1024) }));
    store.clearActiveClaim(interaction.user.id);
    const remaining = Math.max(0, config.rejectLimitPerDay - store.rejectCountLast24h(interaction.user.id));
    return interaction.editReply({ content: `✅ Task rejected. You have **${remaining}** rejection${remaining === 1 ? '' : 's'} left today. Next task in ~${config.cooldownHours}h.` });
  } catch (err) {
    return interaction.editReply({ content: `❌ ${err?.data?.message || 'Failed to reject task'}` });
  }
}

// ── modals ───────────────────────────────────────────────────

function submitModal() {
  return new ModalBuilder()
    .setCustomId('submit_modal')
    .setTitle('Submit your Reddit post')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('url').setLabel('Post URL (https://reddit.com/...)').setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
}

function rejectModal() {
  return new ModalBuilder()
    .setCustomId('reject_modal')
    .setTitle('Reject task')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason (min 10 chars)')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(api.MIN_REJECT_REASON)
          .setRequired(true)
      )
    );
}

function verifyModal() {
  return new ModalBuilder()
    .setCustomId('verify_modal')
    .setTitle('Verify your Reddit account')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('username').setLabel('Your Reddit username (without u/)').setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
}

function walletModal(method) {
  const m = payout.METHODS[method];
  return new ModalBuilder()
    .setCustomId(`wallet_modal:${method}`)
    .setTitle(`Set ${m.label} payout`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('address').setLabel(m.label).setPlaceholder(m.placeholder).setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
}

async function doSetWallet(interaction, method, rawAddress) {
  const v = payout.validateAddress(method, rawAddress);
  if (!v.ok) return interaction.editReply({ content: `❌ ${v.error}` });
  store.setWallet(interaction.user.id, method, v.address);
  return interaction.editReply({ embeds: [ui.walletSetEmbed(method, v.address)] });
}

// ── operator: payout report ──────────────────────────────────

async function doReport(interaction) {
  const users = store.listLinkedUsers();
  const rows = [];
  let owedTotal = 0;
  let missingWallet = 0;

  for (const u of users) {
    let owed = 0, pending = 0, lifetime = 0;
    try {
      const bal = await api.getBalance(u.redditUsername);
      owed = Number(bal.balance || 0);
      pending = Number(bal.pending_amount || 0);
      lifetime = Number(bal.lifetime_earnings || 0);
    } catch {
      // API unreachable for this user — leave zeros, still list them.
    }
    owedTotal += owed;
    if (!u.wallet?.address) missingWallet += 1;
    rows.push({
      discordId: u.discordId,
      redditUsername: u.redditUsername,
      owed,
      pending,
      lifetime,
      method: u.wallet?.method || '',
      address: u.wallet?.address || '',
    });
  }

  rows.sort((a, b) => b.owed - a.owed);
  const csv = payout.buildReportCsv(rows);
  const file = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), { name: `payout-report-${new Date().toISOString().slice(0, 10)}.csv` });
  return interaction.editReply({
    embeds: [ui.reportEmbed(rows, { owed: owedTotal, missingWallet })],
    files: [file],
  });
}

async function doPaid(interaction) {
  const target = interaction.options.getUser('user');
  const amount = interaction.options.getNumber('amount');
  const reference = interaction.options.getString('reference') || null;
  const rec = store.getUser(target.id);
  const method = rec?.wallet?.method || null;

  store.recordPayout(target.id, { amount, method, address: rec?.wallet?.address || null, reference });
  await operatorLog(
    client,
    ui.paidEmbed(`<@${target.id}>`, amount, method, reference)
  );
  return interaction.editReply({
    content: `💸 Recorded a **$${Number(amount).toFixed(2)}** payout to <@${target.id}>${method ? ` via ${payout.methodLabel(method)}` : ''}${reference ? ` (ref: ${reference})` : ''}.\nThis is your own bookkeeping — clears are tracked by the platform.`,
  });
}

// ── interaction router ───────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;

      if (name === 'setup') {
        await interaction.reply({ embeds: [ui.configStatusEmbed(interaction.guild)], ...EPH });
        return interaction.channel.send({ embeds: [ui.panelEmbed()], components: [ui.panelButtons()] });
      }
      if (name === 'stats') {
        return interaction.reply({ embeds: [ui.statsEmbed(store.getStats())], ...EPH });
      }
      if (name === 'help') {
        return interaction.reply({ embeds: [ui.panelEmbed()], ...EPH });
      }
      if (name === 'whoami') {
        const rec = store.getUser(interaction.user.id);
        return interaction.reply({ content: rec?.redditUsername ? `🔗 Linked to **u/${rec.redditUsername}**.` : 'Not linked yet. Use **/verify**.', ...EPH });
      }
      if (name === 'wallet') {
        return interaction.reply({ embeds: [ui.walletEmbed(store.getWallet(interaction.user.id))], components: [ui.walletButtons()], ...EPH });
      }
      if (name === 'signout') {
        const rec = store.getUser(interaction.user.id);
        if (claimIsLive(rec?.activeClaim)) {
          api.releaseTask(rec.activeClaim.claim_id).catch(() => {});
        }
        store.clearUser(interaction.user.id);
        return interaction.reply({ content: '👋 Unlinked. Use **/verify** to link again.', ...EPH });
      }
      if (name === 'reject') {
        const rec = store.getUser(interaction.user.id);
        if (!claimIsLive(rec?.activeClaim)) return interaction.reply({ content: '📭 You have no active task to reject.', ...EPH });
        return interaction.showModal(rejectModal());
      }

      if (name === 'gettask') {
        // Ask which type of task they want (one at a time).
        return interaction.reply({ embeds: [ui.chooseTypeEmbed()], components: [ui.chooseTypeButtons()], ...EPH });
      }

      // API-backed commands: defer ephemerally
      await interaction.deferReply(EPH);
      if (name === 'verify') return doVerify(interaction, interaction.options.getString('username'));
      if (name === 'submit') return doSubmit(interaction, interaction.options.getString('url'));
      if (name === 'report') return doReport(interaction);
      if (name === 'paid') return doPaid(interaction);
      if (name === 'mytask') {
        const rec = store.getUser(interaction.user.id);
        if (!claimIsLive(rec?.activeClaim)) return interaction.editReply({ content: '📭 No active task. Use **/gettask**.' });
        return interaction.editReply({ embeds: [ui.taskEmbed(rec.activeClaim)], components: [ui.taskButtons(rec.activeClaim)] });
      }
      if (name === 'history') {
        const rec = store.getUser(interaction.user.id);
        if (!rec?.redditUsername) return interaction.editReply({ embeds: [ui.needVerifyEmbed()] });
        try {
          const { submissions } = await api.getSubmissions();
          return interaction.editReply({ embeds: [ui.historyEmbed(submissions)] });
        } catch {
          return interaction.editReply({ content: '❌ Failed to load history.' });
        }
      }
      if (name === 'earnings') {
        const rec = store.getUser(interaction.user.id);
        if (!rec?.redditUsername) return interaction.editReply({ embeds: [ui.needVerifyEmbed()] });
        try {
          const balance = await api.getBalance();
          return interaction.editReply({ embeds: [ui.earningsEmbed(balance, rec.redditUsername)] });
        } catch {
          return interaction.editReply({ content: '❌ Failed to load earnings.' });
        }
      }
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === 'task_submit') return interaction.showModal(submitModal());
      if (id === 'task_reject') {
        const rec = store.getUser(interaction.user.id);
        if (!claimIsLive(rec?.activeClaim)) return interaction.reply({ content: '📭 You have no active task to reject.', ...EPH });
        return interaction.showModal(rejectModal());
      }
      if (id === 'panel_verify') return interaction.showModal(verifyModal());
      if (id === 'wallet_usdt_polygon') return interaction.showModal(walletModal('usdt_polygon'));
      if (id === 'wallet_upi') return interaction.showModal(walletModal('upi'));
      if (id === 'verify_cancel') return interaction.update({ content: 'Verification cancelled.', embeds: [], components: [] });
      if (id.startsWith('verify:')) {
        await interaction.deferReply(EPH);
        return recheckVerify(interaction, id.slice('verify:'.length));
      }
      if (id === 'gettask_post') {
        await interaction.deferReply(EPH);
        return doGetTask(interaction, 'post');
      }
      if (id === 'gettask_comment') {
        await interaction.deferReply(EPH);
        return doGetTask(interaction, 'comment');
      }
      if (id === 'panel_mytask') {
        await interaction.deferReply(EPH);
        const rec = store.getUser(interaction.user.id);
        if (!claimIsLive(rec?.activeClaim)) return interaction.editReply({ content: '📭 No active task. Press **Get a task**.' });
        return interaction.editReply({ embeds: [ui.taskEmbed(rec.activeClaim)], components: [ui.taskButtons(rec.activeClaim)] });
      }
      if (id === 'panel_earnings') {
        await interaction.deferReply(EPH);
        const rec = store.getUser(interaction.user.id);
        if (!rec?.redditUsername) return interaction.editReply({ embeds: [ui.needVerifyEmbed()] });
        try {
          const balance = await api.getBalance();
          return interaction.editReply({ embeds: [ui.earningsEmbed(balance, rec.redditUsername)] });
        } catch {
          return interaction.editReply({ content: '❌ Failed to load earnings.' });
        }
      }
      return;
    }

    // Modals
    if (interaction.isModalSubmit()) {
      await interaction.deferReply(EPH);
      if (interaction.customId === 'submit_modal') return doSubmit(interaction, interaction.fields.getTextInputValue('url'));
      if (interaction.customId === 'reject_modal') return doReject(interaction, interaction.fields.getTextInputValue('reason'));
      if (interaction.customId === 'verify_modal') return doVerify(interaction, interaction.fields.getTextInputValue('username'));
      if (interaction.customId.startsWith('wallet_modal:')) {
        const method = interaction.customId.slice('wallet_modal:'.length);
        return doSetWallet(interaction, method, interaction.fields.getTextInputValue('address'));
      }
      return;
    }
  } catch (err) {
    console.error('Interaction error:', err);
    const msg = '❌ Something went wrong. Please try again.';
    if (interaction.deferred || interaction.replied) interaction.editReply({ content: msg }).catch(() => {});
    else interaction.reply({ content: msg, ...EPH }).catch(() => {});
  }
});

client.once(Events.ClientReady, async (c) => {
  console.log('─'.repeat(50));
  console.log(`🤖  ${config.operatorName} bot online as ${c.user.tag}`);
  console.log(`   Delivery mode : ${config.deliveryMode}`);
  console.log(`   Cooldown      : ${config.cooldownHours}h between tasks`);
  console.log(`   Reject limit  : ${config.rejectLimitPerDay}/day`);
  console.log(`   Operator log  : ${config.operatorLogChannelId || '(none)'}`);

  // Auto-register slash commands on boot so no manual `npm run register` is
  // needed (important on hosts like Render where you can't run a shell).
  try {
    const appId = c.application?.id ?? c.user.id;
    const rest = new REST({ version: '10' }).setToken(config.token);
    if (config.guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, config.guildId), { body: commands });
      console.log(`   Commands      : registered ${commands.length} to guild ${config.guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log(`   Commands      : registered ${commands.length} globally (may take ~1h to appear)`);
    }
  } catch (e) {
    console.error('⚠️  Slash command registration failed:', e.message);
  }
  console.log('─'.repeat(50));
});

// Onboarding: when added to a server, guide the owner/admin to run /setup.
client.on(Events.GuildCreate, async (guild) => {
  try {
    const embed = ui.onboardingEmbed();
    // Prefer the system channel; fall back to the owner's DMs.
    const sys = guild.systemChannel;
    if (sys && sys.permissionsFor(guild.members.me)?.has('SendMessages')) {
      await sys.send({ embeds: [embed] });
    } else {
      const owner = await guild.fetchOwner();
      await owner.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (e) {
    console.error('onboarding failed:', e.message);
  }
});

// ── Owner remote-control helpers (invoked by the gateway's /admin routes) ──
// Let the Redwire owner order THIS bot to act using the bot's own token locally
// — the owner never needs the token, only the LEAH_KEY.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Create a fresh invite link for the operator's server.
export async function createGuildInvite({ guildId, channelId } = {}) {
  const gid = guildId || config.guildId;
  if (!gid) throw new Error('no_guild');
  const guild = await client.guilds.fetch(gid);
  let channel = null;
  if (channelId) channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    await guild.channels.fetch();
    channel = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite)
    );
  }
  if (!channel) throw new Error('no_invitable_channel');
  const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
  return { url: `https://discord.gg/${invite.code}`, code: invite.code, channel: channel.name };
}

// Broadcast a DM to the server's members. {username} is replaced per member.
export async function broadcastDMs({ message, guildId, batchSize = 10, delayMs = 1000, dryRun = false } = {}) {
  if (!message) throw new Error('message_required');
  const gid = guildId || config.guildId;
  if (!gid) throw new Error('no_guild');
  const guild = await client.guilds.fetch(gid);
  await guild.members.fetch();
  const members = [...guild.members.cache.values()].filter((m) => !m.user.bot);

  const results = { total: members.length, sent: 0, failed: 0 };
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const text = String(message).replace(/\{username\}/g, m.user.username);
    if (dryRun) {
      results.sent++;
      continue;
    }
    try {
      await m.send(text);
      results.sent++;
    } catch {
      results.failed++;
    }
    await sleep(delayMs);
    if (batchSize > 0 && (i + 1) % batchSize === 0) await sleep(delayMs * 2);
  }
  return results;
}

// Start the bot. Called by the gateway when RUN_BOT=true, or directly.
// Throws (instead of exiting) so a bot misconfig never takes the gateway down.
export async function startBot() {
  if (!config.token) throw new Error('DISCORD_TOKEN missing — cannot start bot.');
  if (!['dm', 'ticket'].includes(config.deliveryMode)) throw new Error("DELIVERY_MODE must be 'dm' or 'ticket'.");
  await client.login(config.token);
  return client;
}

// Allow running the bot standalone: `node src/bot/index.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  assertRuntimeConfig();
  startBot().catch((e) => {
    console.error('❌  Bot failed to start:', e.message);
    process.exit(1);
  });
}
