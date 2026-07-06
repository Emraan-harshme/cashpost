# Setting up your Discord bot

The bot is optional. If you want posters to use Discord instead of (or alongside)
the website, follow this once (~5 minutes) to get your **bot token** and the two
IDs the gateway needs.

## 1. Create the application + bot

1. Go to the **Discord Developer Portal**: https://discord.com/developers/applications
2. Click **New Application** → give it a name (your brand) → **Create**.
3. Left menu → **Bot** → **Add Bot** → **Yes, do it**.
4. On the **Bot** page:
   - Click **Reset Token** → **Copy**. **This is your `DISCORD_TOKEN`.**
     (You only see it once — copy it now. Treat it like a password.)
   - Scroll to **Privileged Gateway Intents** and turn **ON**:
     - **Server Members Intent** ✅ (required)
   - Save.

## 2. Get your IDs

- **`DISCORD_GUILD_ID`** (your server ID):
  In Discord app → **User Settings → Advanced → Developer Mode: ON**.
  Then right-click your **server icon → Copy Server ID**.
  *(Setting this makes the bot's slash commands appear instantly.)*

- **`DISCORD_CLIENT_ID`** (optional): Developer Portal → **General Information** →
  **Application ID → Copy**. Only needed if you ever register commands manually;
  the running bot doesn't require it.

## 3. Invite the bot to your server

1. Developer Portal → your app → **OAuth2 → URL Generator**.
2. **Scopes:** check `bot` **and** `applications.commands`.
3. **Bot Permissions:** check
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - **Manage Channels** (needed for private "ticket" task delivery)
4. Copy the generated URL at the bottom, open it, pick your server, **Authorize**.

## 4. Plug it into the gateway

On your **gateway** service (e.g. Render), set:

```
RUN_BOT=true
DISCORD_TOKEN=your-bot-token
DISCORD_GUILD_ID=your-server-id
DELIVERY_MODE=ticket              # or "dm"
OPERATOR_LOG_CHANNEL_ID=          # optional: channel where the bot logs activity
STAFF_ROLE_ID=                    # optional: role that can see all task tickets
```

Redeploy. The bot comes online and **registers its slash commands automatically**.
Then run **/setup** in the channel where posters should pick up tasks.

## Notes
- Never commit or share the token. If it leaks, **Reset Token** in the portal.
- For `OPERATOR_LOG_CHANNEL_ID` / `STAFF_ROLE_ID`: with Developer Mode on,
  right-click a channel/role → **Copy ID**.
- To get a channel/role ID you must have Developer Mode enabled (step 2).

## Optional — Leah remote control (owner-triggered invites / broadcasts)

**Who creates `LEAH_KEY`?** The **Redwire owner** generates it and gives it to you
during onboarding — you just paste it into your gateway env. (That way the owner
already has the key and can issue commands immediately; use a different key per
operator so any one can be revoked independently.)

Generate one (owner side):

```
openssl rand -hex 32
```

Set the secret `LEAH_KEY` on the gateway (with `RUN_BOT=true`). The Redwire owner can
then order this bot to act **without ever holding your bot token**:

- `POST /admin/invite` — bot creates a server invite and returns the link.
  `curl -X POST https://your-gateway/admin/invite -H "x-leah-key: <LEAH_KEY>"`
- `POST /admin/broadcast` — bot DMs your members. Body: `{ "message": "Hi {username}!", "dryRun": true }`
  `{username}` is replaced per member; start with `"dryRun": true` to preview counts.

These endpoints only exist while the bot is running. Leave `LEAH_KEY` blank to disable.
