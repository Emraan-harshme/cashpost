// ============================================================
// Private task delivery.
//   dm     → DM the worker directly
//   ticket → a private channel only the worker + staff can see
// Plus an operator log so the operator sees who's doing what,
// while workers can never see each other's tasks.
// ============================================================

import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { getUser, upsertUser } from './store.js';

// Resolve (or create) a private ticket channel for a worker.
async function ensureTicketChannel(guild, member) {
  const rec = getUser(member.id);
  if (rec?.ticketChannelId) {
    const existing = guild.channels.cache.get(rec.ticketChannelId) || (await guild.channels.fetch(rec.ticketChannelId).catch(() => null));
    if (existing) return existing;
  }

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages],
    },
    {
      id: guild.members.me.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
    },
  ];
  if (config.staffRoleId) {
    overwrites.push({
      id: config.staffRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages],
    });
  }

  const channel = await guild.channels.create({
    name: `task-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90),
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId || undefined,
    permissionOverwrites: overwrites,
    topic: `Private task desk for ${member.user.tag} — only they and staff can see this.`,
  });

  upsertUser(member.id, { ticketChannelId: channel.id });
  return channel;
}

// Deliver a task payload ({ embeds, components }) privately.
// Returns { where } describing how it was delivered, for the ack message.
export async function deliverTask(interaction, payload) {
  if (config.deliveryMode === 'ticket' && interaction.guild) {
    const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id));
    const channel = await ensureTicketChannel(interaction.guild, member);
    await channel.send({ content: `<@${interaction.user.id}> here's your task 👇`, ...payload });
    return { where: 'ticket', channelId: channel.id };
  }

  // DM mode (or no guild context)
  const dm = await interaction.user.createDM();
  await dm.send(payload);
  return { where: 'dm' };
}

// Post an operator log embed, if configured.
export async function operatorLog(client, embed) {
  if (!config.operatorLogChannelId) return;
  try {
    const ch = client.channels.cache.get(config.operatorLogChannelId) || (await client.channels.fetch(config.operatorLogChannelId));
    if (ch?.isTextBased()) await ch.send({ embeds: [embed] });
  } catch (e) {
    console.error('⚠️  operator log failed:', e.message);
  }
}

export { ensureTicketChannel };
