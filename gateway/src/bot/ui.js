// ============================================================
// Embed + component builders. Mirrors the website's screens as
// Discord embeds: verify, task card, history, earnings.
// ============================================================

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { config } from './config.js';
import { methodLabel, maskAddress } from './payout.js';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const relTs = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

export function brandFooter(embed) {
  return embed.setFooter({ text: `${config.operatorName} · Redwire poster network` }).setColor(config.color);
}

// ── Verify: pending token ────────────────────────────────────
export function verifyTokenEmbed(username, token) {
  const e = new EmbedBuilder()
    .setTitle('🔐 Verify your Reddit account')
    .setDescription(
      `Add this token to your Reddit profile's **About** section, then press **I've added it**.\n\n` +
        `\`\`\`\n${token}\n\`\`\`\n` +
        `**How:** reddit.com/settings › Profile › About › paste token › Save`
    )
    .addFields({ name: 'Account', value: `u/${username}`, inline: true });
  return brandFooter(e);
}

export function verifyButtons(username) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`verify:${username}`).setLabel("I've added it — Verify").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('verify_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );
}

// ── The single task card (delivered privately) ───────────────
export function taskEmbed(claim, workerTag) {
  const pc = claim.post_content || {};
  const e = new EmbedBuilder()
    .setTitle(`🎯 Your task · r/${claim.subreddit}`)
    .setDescription(
      `You have **one active task**. Complete it on Reddit, then submit the post link below.\n` +
        `⏳ Claim expires ${relTs(claim.expiresAt)}.`
    )
    .addFields(
      { name: 'Payout', value: money(claim.payout), inline: true },
      { name: 'Tier', value: `${claim.tier ?? '—'}`, inline: true },
      { name: 'Type', value: `${claim.interaction_type ?? 'post'}`, inline: true }
    );

  if (pc.title) e.addFields({ name: '📝 Post title', value: pc.title.slice(0, 1024) });
  if (pc.body) e.addFields({ name: '📄 Post body', value: pc.body.slice(0, 1024) });
  if (pc.note || claim.note_to_poster) e.addFields({ name: '📌 Instructions', value: String(pc.note || claim.note_to_poster).slice(0, 1024) });

  const reqs = [];
  if (claim.verificationPeriodDays > 0) reqs.push(`• Verify time: **${claim.verificationPeriodDays} days**`);
  if (claim.flair) reqs.push(`• Flair: \`${claim.flair}\``);
  if (claim.nsfw) reqs.push('• **NSFW tag required**');
  if (claim.first_comment) reqs.push(`• First comment: ${String(claim.first_comment).slice(0, 300)}`);
  if (claim.image_url) reqs.push(`• [View required image](${claim.image_url})`);
  if (reqs.length) e.addFields({ name: '✅ Requirements', value: reqs.join('\n').slice(0, 1024) });

  if (pc.hooks?.length) e.addFields({ name: '🪝 Hooks', value: pc.hooks.map((h) => `• ${h}`).join('\n').slice(0, 1024) });

  e.addFields({ name: '⚠️ Keep it live', value: 'Keep the post live for at least 2 weeks after it clears. Removing it early may result in suspension.' });
  if (workerTag) e.addFields({ name: 'Assigned to', value: workerTag, inline: true });

  return brandFooter(e);
}

export function taskButtons(claim) {
  const subreddit = String(claim.subreddit || '').replace('r/', '');
  const redditUrl = claim.targetPostUrl || `https://www.reddit.com/r/${subreddit}/`;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('task_submit').setLabel('Submit post URL').setStyle(ButtonStyle.Success).setEmoji('📮'),
    new ButtonBuilder().setCustomId('task_reject').setLabel('Reject task').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setLabel('Open Reddit').setStyle(ButtonStyle.Link).setURL(redditUrl)
  );
}

// ── History ──────────────────────────────────────────────────
const STATUS_EMOJI = {
  cleared: '🟢',
  failed: '🔴',
  expired: '⚪',
  pending_verification: '🟡',
};

export function historyEmbed(submissions) {
  const e = new EmbedBuilder().setTitle('📜 Submission history');
  if (!submissions.length) {
    e.setDescription('No submissions yet. Complete your first task to see it here.');
    return brandFooter(e);
  }
  const lines = submissions.slice(0, 15).map((s) => {
    const emoji = STATUS_EMOJI[s.status] || '🟡';
    const label = (s.status || 'pending').replace('_', ' ');
    const date = new Date(s.submitted_at).toLocaleDateString();
    return `${emoji} **${money(s.payout)}** · ${label} · ${date}\n${s.post_url}`;
  });
  e.setDescription(lines.join('\n\n'));
  return brandFooter(e);
}

// ── Earnings ─────────────────────────────────────────────────
export function earningsEmbed(balance, username) {
  const e = new EmbedBuilder()
    .setTitle('💰 Earnings')
    .addFields(
      { name: 'Available', value: money(balance.balance), inline: true },
      { name: 'Pending', value: money(balance.pending_amount), inline: true },
      { name: 'Lifetime', value: money(balance.lifetime_earnings), inline: true }
    )
    .setDescription(`u/${username} · Payouts are processed manually by your operator — contact them to arrange withdrawal.`);
  return brandFooter(e);
}

// ── Cooldown / gates ─────────────────────────────────────────
export function cooldownEmbed(remainingMs) {
  const nextAt = Date.now() + remainingMs;
  const e = new EmbedBuilder()
    .setTitle('⏳ Cooldown active')
    .setDescription(`You've already picked up a task recently.\nYou can request your next task ${relTs(nextAt)}.`);
  return brandFooter(e);
}

export function needVerifyEmbed() {
  const e = new EmbedBuilder()
    .setTitle('🔓 Verify first')
    .setDescription('You need to verify your Reddit account before picking up tasks.\nUse **/verify** to get started.');
  return brandFooter(e);
}

export function noTasksEmbed() {
  const e = new EmbedBuilder()
    .setTitle('📭 No tasks available')
    .setDescription('There are no open tasks right now. Check back a little later.');
  return brandFooter(e);
}

// ── The "Get a task" panel operators pin in a channel ────────
export function panelEmbed() {
  const e = new EmbedBuilder()
    .setTitle(`${config.operatorName} · Task desk`)
    .setDescription(
      `**How it works**\n` +
        `1️⃣ Press **Verify** and link your Reddit account.\n` +
        `2️⃣ Choose **Post task** or **Comment task** — one is sent to you privately.\n` +
        `3️⃣ Do it on Reddit, then submit the link.\n` +
        `4️⃣ After a short cooldown you can grab another.\n\n` +
        `Only you can see your own task.`
    );
  return brandFooter(e);
}

export function panelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('panel_verify').setLabel('Verify').setStyle(ButtonStyle.Secondary).setEmoji('🔐'),
    new ButtonBuilder().setCustomId('gettask_post').setLabel('Post task').setStyle(ButtonStyle.Primary).setEmoji('📝'),
    new ButtonBuilder().setCustomId('gettask_comment').setLabel('Comment task').setStyle(ButtonStyle.Primary).setEmoji('💬'),
    new ButtonBuilder().setCustomId('panel_mytask').setLabel('My task').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('panel_earnings').setLabel('Earnings').setStyle(ButtonStyle.Secondary).setEmoji('💰')
  );
}

// ── Task-type chooser (for the /gettask command) ─────────────
export function chooseTypeEmbed() {
  const e = new EmbedBuilder()
    .setTitle('🎯 What kind of task?')
    .setDescription('Pick the type of task you want. You get **one at a time**.\n\n📝 **Post** — create a Reddit post.\n💬 **Comment** — leave a Reddit comment.');
  return brandFooter(e);
}

export function chooseTypeButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gettask_post').setLabel('Post task').setStyle(ButtonStyle.Primary).setEmoji('📝'),
    new ButtonBuilder().setCustomId('gettask_comment').setLabel('Comment task').setStyle(ButtonStyle.Primary).setEmoji('💬')
  );
}

export function noTasksOfTypeEmbed(type) {
  const e = new EmbedBuilder()
    .setTitle('📭 No tasks available')
    .setDescription(`There are no open **${type}** tasks right now. Try the other type or check back later.`);
  return brandFooter(e);
}

// ── Reject spam protection ───────────────────────────────────
export function rejectLimitEmbed(resetAt, limit) {
  const e = new EmbedBuilder()
    .setTitle('🚫 Reject limit reached')
    .setDescription(`You've hit the limit of **${limit} rejections per day**.\nYou can reject again ${relTs(resetAt)}.\n\nRepeatedly rejecting tasks can lead to suspension — please only take tasks you intend to complete.`);
  return brandFooter(e);
}

// ── Operator: stats ──────────────────────────────────────────
export function statsEmbed(s) {
  const e = new EmbedBuilder()
    .setTitle(`📊 ${config.operatorName} · Operator stats`)
    .addFields(
      { name: 'Linked workers', value: String(s.linkedWorkers), inline: true },
      { name: 'Active tasks', value: String(s.activeTasks), inline: true },
      { name: 'Rejects (24h)', value: String(s.rejects24h), inline: true },
      { name: 'Total claimed', value: String(s.totalClaimed), inline: true },
      { name: 'Total submitted', value: String(s.totalSubmitted), inline: true },
      { name: 'Total rejected', value: String(s.totalRejected), inline: true },
      { name: 'By type', value: `📝 Posts: **${s.byType.post || 0}**   💬 Comments: **${s.byType.comment || 0}**` }
    )
    .setTimestamp();
  return brandFooter(e);
}

// ── Operator onboarding + config status ──────────────────────
export function onboardingEmbed() {
  const e = new EmbedBuilder()
    .setTitle(`👋 Thanks for adding ${config.operatorName}!`)
    .setDescription(
      `Let's get your task desk live in 3 steps:\n\n` +
        `**1.** Make sure your \`.env\` has your **REDWIRE_API_KEY** and (for private tickets) a **STAFF_ROLE_ID** + **OPERATOR_LOG_CHANNEL_ID**.\n` +
        `**2.** Run **/setup** in the channel where posters should pick up tasks — it drops the Task Desk panel and shows your config status.\n` +
        `**3.** Run **/stats** any time to see activity.\n\n` +
        `Delivery mode: **${config.deliveryMode}** · Cooldown: **${config.cooldownHours}h** · Reject limit: **${config.rejectLimitPerDay}/day**`
    );
  return brandFooter(e);
}

export function configStatusEmbed(guild) {
  const me = guild?.members?.me;
  const canManageChannels = me ? me.permissions.has('ManageChannels') : false;
  const ok = (b) => (b ? '✅' : '⚠️');
  const apiSet = !!(process.env.REDWIRE_API_KEY && process.env.REDWIRE_API_KEY !== 'dummy_key');
  const lines = [
    `${ok(apiSet)} Redwire API key ${apiSet ? 'set' : 'missing'}`,
    `• Delivery mode: **${config.deliveryMode}**`,
    `• Cooldown: **${config.cooldownHours}h** between tasks`,
    `• Reject limit: **${config.rejectLimitPerDay}/day** per worker`,
    `${ok(!!config.operatorLogChannelId)} Operator log channel ${config.operatorLogChannelId ? `<#${config.operatorLogChannelId}>` : 'not set'}`,
  ];
  if (config.deliveryMode === 'ticket') {
    lines.push(`${ok(!!config.staffRoleId)} Staff role ${config.staffRoleId ? `<@&${config.staffRoleId}>` : 'not set (staff won\'t see tickets)'}`);
    lines.push(`${ok(canManageChannels)} Manage Channels permission ${canManageChannels ? 'granted' : 'MISSING (needed to create tickets)'}`);
  }
  const e = new EmbedBuilder().setTitle('⚙️ Configuration status').setDescription(lines.join('\n'));
  return brandFooter(e);
}

// ── Payout wallet (worker) ───────────────────────────────────
export function walletEmbed(wallet) {
  const e = new EmbedBuilder().setTitle('💳 Payout method');
  if (wallet?.method && wallet?.address) {
    e.setDescription(
      `Your payouts are set to **${methodLabel(wallet.method)}**.\n\`${wallet.address}\`\n\nUse the buttons below to change it.`
    );
  } else {
    e.setDescription(
      "You haven't set a payout method yet. Choose one below so your operator can pay you.\n\n" +
        '• **USDT (Polygon)** — a Polygon (0x…) wallet address\n' +
        '• **UPI** — an Indian UPI ID (name@bank)'
    );
  }
  return brandFooter(e);
}

export function walletButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('wallet_usdt_polygon').setLabel('Set USDT (Polygon)').setStyle(ButtonStyle.Primary).setEmoji('🪙'),
    new ButtonBuilder().setCustomId('wallet_upi').setLabel('Set UPI').setStyle(ButtonStyle.Secondary).setEmoji('🏦')
  );
}

export function walletSetEmbed(method, address) {
  const e = new EmbedBuilder()
    .setTitle('✅ Payout method saved')
    .setDescription(`Payouts will be sent via **${methodLabel(method)}**:\n\`${address}\``);
  return brandFooter(e);
}

// ── Operator: payout report ──────────────────────────────────
export function reportEmbed(rows, totals) {
  const e = new EmbedBuilder().setTitle(`🧾 ${config.operatorName} · Payout report`);
  if (!rows.length) {
    e.setDescription('No linked workers yet.');
    return brandFooter(e);
  }
  const owedRows = rows.filter((r) => (r.owed || 0) > 0);
  const shown = (owedRows.length ? owedRows : rows).slice(0, 15);
  const lines = shown.map((r) => {
    const wallet = r.method ? `${methodLabel(r.method)} · ${maskAddress(r.method, r.address)}` : '⚠️ no payout method';
    return `<@${r.discordId}> · u/${r.redditUsername}\n**${money(r.owed)}** owed · ${wallet}`;
  });
  e.setDescription(lines.join('\n\n'));
  e.addFields(
    { name: 'Total owed (available)', value: money(totals.owed), inline: true },
    { name: 'Workers owed', value: String(owedRows.length), inline: true },
    { name: 'Missing payout info', value: String(totals.missingWallet), inline: true }
  );
  e.setFooter({ text: `${config.operatorName} · full breakdown attached as CSV` });
  return e.setColor(config.color);
}

export function paidEmbed(workerTag, amount, method, ref) {
  const e = new EmbedBuilder()
    .setTitle('💸 Payout recorded')
    .setColor(0x22c55e)
    .addFields(
      { name: 'Worker', value: workerTag, inline: true },
      { name: 'Amount', value: money(amount), inline: true },
      { name: 'Method', value: methodLabel(method), inline: true }
    )
    .setTimestamp();
  if (ref) e.addFields({ name: 'Reference', value: ref });
  return e;
}

// ── Operator log entries ─────────────────────────────────────
export function logClaim(workerTag, redditUsername, claim) {
  const e = new EmbedBuilder()
    .setTitle('🎯 Task claimed')
    .setColor(0x3b82f6)
    .addFields(
      { name: 'Worker', value: `${workerTag} (u/${redditUsername})`, inline: false },
      { name: 'Subreddit', value: `r/${claim.subreddit}`, inline: true },
      { name: 'Payout', value: money(claim.payout), inline: true },
      { name: 'Expires', value: relTs(claim.expiresAt), inline: true }
    )
    .setTimestamp();
  return e;
}

export function logEvent(title, color, workerTag, redditUsername, extra) {
  const e = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields({ name: 'Worker', value: `${workerTag} (u/${redditUsername})`, inline: false })
    .setTimestamp();
  if (extra) e.addFields(extra);
  return e;
}

export { StringSelectMenuBuilder };
