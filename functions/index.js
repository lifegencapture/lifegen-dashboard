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

    const mentions = (n.to || []).map((name) => (tg[key(name)] ? "@" + tg[key(name)] : esc(name)));
    const text = [
      `🎬 <b>${esc(n.title || "LifeGen video")}</b>`,
      esc(n.text),
      mentions.join(" "),
      `<a href="${LINK.value()}">Open the LifeGen Video Dashboard</a>`,
    ].filter(Boolean).join("\n");

    const r = await fetch(`https://api.telegram.org/bot${TOKEN.value()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT.value(), text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const ok = r.ok && (await r.json()).ok;
    await snap.ref.update(ok ? { sent: true, sentAt: new Date().toISOString() } : { sendError: `Telegram ${r.status}` });
  }
);
