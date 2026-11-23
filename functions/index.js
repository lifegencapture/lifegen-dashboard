/* LifeGen Video Dashboard: Telegram alerts.
 *
 * Whenever the dashboard writes a notification (new brief, draft for review,
 * changes needed, approval, final files…), this function posts it to the team's
 * Telegram group within seconds and tags the right people. It runs in Google's
 * cloud, so nobody's computer has to stay on.
 *
 * The bot token and group id are Firebase secrets (never in this public code):
 *   firebase functions:secrets:set TELEGRAM_TOKEN
 *   firebase functions:secrets:set TELEGRAM_CHAT_ID
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret, defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const TOKEN = defineSecret("TELEGRAM_TOKEN");
const CHAT = defineSecret("TELEGRAM_CHAT_ID");
const LINK = defineString("DASHBOARD_URL", { default: "https://lifegen-video-dashboard.web.app" });

const esc = (s) => String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const key = (s) => String(s || "").trim().toLowerCase();
// "📅 Due: Sun, 30 Nov", or a gentle nudge once the date has passed (Malaysia time).
function dueLine(iso, count) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const day = (x) => x.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" });
  const today = day(new Date()), when = day(d);
  if (when === today) return `📅 Due: <b>today (${when})</b>`;
  if (d < new Date()) return `⏰ ${count === 1 ? "This was" : "These were"} due on <b>${when}</b>. Please hand ${count === 1 ? "it" : "them"} in as soon as you can 🙏`;
  return `📅 Due: <b>${when}</b>`;
}
const validTg = (s) => /^[A-Za-z0-9_]{5,32}$/.test(String(s || "").replace(/^@/, ""));

exports.telegramAlert = onDocumentCreated(
  { document: "notify/{id}", region: "asia-southeast1", secrets: [TOKEN, CHAT], retry: false },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const n = snap.data() || {};
    if (n.sent) return;
    const db = admin.firestore();

    // Telegram usernames: Team › Manage team first, then each person's own profile.
    const tg = {};
    const settings = await db.doc("settings/main").get();
    for (const t of (settings.exists && settings.data().team) || []) if (validTg(t.tg)) tg[key(t.name)] = String(t.tg).replace(/^@/, "");
    const members = await db.collection("members").get();
    members.forEach((m) => { const d = m.data(); if (d && !tg[key(d.name)] && validTg(d.tg)) tg[key(d.name)] = String(d.tg).replace(/^@/, ""); });

    // Paused unless an admin has switched Telegram on (Manage team & Drive). Held
    // alerts stay in the dashboard bell but are never sent later, so turning it back
    // on doesn't flood the group.
    const sw = await db.doc("settings/telegram").get();
    if (!(sw.exists && sw.data().on === true)) { await snap.ref.update({ held: true }); return; }

    const people = (n.to || []).map((name) => {
      const first = esc(String(name).trim());
      return tg[key(name)] ? `<b>${first}</b> (@${tg[key(name)]})` : `<b>${first}</b>`;
    });
    const greet = people.length ? `Hey ${people.length > 1 ? people.slice(0, -1).join(", ") + " and " + people[people.length - 1] : people[0]} 👋` : "Hey team 👋";
    const count = Number(n.count) || 0, vids = `${count} finished video${count === 1 ? "" : "s"}`;
    const due = n.due ? dueLine(n.due, count) : null;
    const link = `👉 <a href="${LINK.value()}">Open the LifeGen Video Dashboard</a>`;
    let lines;
    if (n.type === "files" && count) lines = [
      greet, "",
      `You have <b>${vids}</b> to hand in 🎬`,
      `Please add the <b>final video link</b> (or the <b>server backup</b> for lyric videos), the <b>colours</b>, and for worship songs the <b>font</b> and <b>ProPresenter screenshots</b>.`,
      due, "", `Your list is on your <b>Home</b> page.`, link,
    ];
    else if (n.type === "files-reminder" && count) lines = [
      greet, "",
      `Just a friendly reminder: <b>${vids}</b> still ${count === 1 ? "needs" : "need"} files from you 🎬`,
      due, "", `Your list is on your <b>Home</b> page.`, link,
    ];
    else lines = [greet, "", `🎬 <b>${esc(n.title || "LifeGen video")}</b>`, esc(n.text), due, "", link];
    const text = lines.filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();

    const r = await fetch(`https://api.telegram.org/bot${TOKEN.value()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT.value(), text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const ok = r.ok && (await r.json()).ok;
    await snap.ref.update(ok ? { sent: true, sentAt: new Date().toISOString() } : { sendError: `Telegram ${r.status}` });
  }
);
