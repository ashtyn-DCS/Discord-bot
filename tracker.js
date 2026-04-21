const fs = require('fs');
const PATH = './sessions.json';

function load() {
  if (!fs.existsSync(PATH)) fs.writeFileSync(PATH, JSON.stringify({ active: {}, history: [] }));
  return JSON.parse(fs.readFileSync(PATH));
}

function save(data) {
  fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
}

function startSession(userId, username) {
  const data = load();
  data.active[userId] = { username, joinedAt: Date.now() };
  save(data);
}

function endSession(userId) {
  const data = load();
  const session = data.active[userId];
  if (!session) return null;

  const durationMs = Date.now() - session.joinedAt;
  const hours = durationMs / 1000 / 60 / 60;

  data.history.push({
    userId,
    username: session.username,
    joinedAt: session.joinedAt,
    leftAt: Date.now(),
    hours: parseFloat(hours.toFixed(4)),
  });

  delete data.active[userId];
  save(data);
  return { username: session.username, hours };
}

function getWeeklyReport() {
  const data = load();
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const weekSessions = data.history.filter(s => s.leftAt >= oneWeekAgo);

  // Aggregate hours per user
  const totals = {};
  for (const s of weekSessions) {
    if (!totals[s.username]) totals[s.username] = 0;
    totals[s.username] += s.hours;
  }

  // Clear history older than a week
  data.history = data.history.filter(s => s.leftAt >= oneWeekAgo);
  save(data);

  return totals;
}

module.exports = { startSession, endSession, getWeeklyReport };