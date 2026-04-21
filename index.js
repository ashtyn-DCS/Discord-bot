require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { startSession, endSession, getWeeklyReport } = require('./tracker');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const TARGET_CHANNEL = process.env.VOICE_CHANNEL_NAME;

function formatDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🎯 Watching for voice channel: "${TARGET_CHANNEL}"`);
  console.log(`📢 Sending messages to channel ID: ${process.env.TEXT_CHANNEL_ID}`);

  const channel = client.channels.cache.get(process.env.TEXT_CHANNEL_ID);
  if (channel) {
    console.log(`✅ Text channel found: #${channel.name}`);
  } else {
    console.log(`❌ Text channel NOT found — check your TEXT_CHANNEL_ID in .env`);
  }

  scheduleWeeklyReport();
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  console.log(`🔔 Voice state update detected for: ${newState.member.user.username}`);
  console.log(`   Old channel: ${oldState.channel?.name ?? 'none'}`);
  console.log(`   New channel: ${newState.channel?.name ?? 'none'}`);

  const textChannel = newState.guild.channels.cache.get(process.env.TEXT_CHANNEL_ID);

  if (!textChannel) {
    console.log(`❌ Could not find text channel with ID: ${process.env.TEXT_CHANNEL_ID}`);
    return;
  }

  const username = newState.member.user.username;
  const joinedTarget = newState.channel?.name === TARGET_CHANNEL;
  const leftTarget = oldState.channel?.name === TARGET_CHANNEL;

  console.log(`   joinedTarget: ${joinedTarget}, leftTarget: ${leftTarget}`);

  if (!leftTarget && joinedTarget) {
    console.log(`✅ ${username} joined the target channel, sending message...`);
    startSession(newState.member.id, username);
    await textChannel.send(`🟢 **${username}** joined the **${TARGET_CHANNEL}**`);
  } else if (leftTarget && !joinedTarget) {
    const result = endSession(newState.member.id);
    if (result) {
      console.log(`✅ ${username} left the target channel, sending message...`);
      await textChannel.send(
        `🔴 **${result.username}** left the **${TARGET_CHANNEL}** after **${formatDuration(result.hours)}**`
      );
    }
  }
});

async function sendWeeklyReport() {
  const totals = getWeeklyReport();
  const textChannel = client.channels.cache.get(process.env.TEXT_CHANNEL_ID);
  if (!textChannel) return;

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const embed = new EmbedBuilder()
    .setTitle('📊 Weekly Working Room Report')
    .setColor(0x5865F2)
    .setTimestamp()
    .setFooter({ text: 'Resets every Monday at 9am' });

  if (entries.length === 0) {
    embed.setDescription('No activity in the Working Room this week.');
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    const lines = entries.map(([name, hours], i) => {
      const medal = medals[i] || '▪️';
      return `${medal} **${name}** — ${formatDuration(hours)}`;
    });
    embed.setDescription(lines.join('\n'));
  }

  await textChannel.send({ embeds: [embed] });
}

function scheduleWeeklyReport() {
  function msUntilNextMonday9am() {
    const now = new Date();
    const next = new Date();
    next.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
    next.setHours(9, 0, 0, 0);
    return next - now;
  }

  const delay = msUntilNextMonday9am();
  console.log(`📅 Weekly report scheduled (${Math.round(delay / 1000 / 60 / 60)}h away)`);

  setTimeout(() => {
    sendWeeklyReport();
    setInterval(sendWeeklyReport, 7 * 24 * 60 * 60 * 1000);
  }, delay);
}

client.login(process.env.DISCORD_TOKEN);