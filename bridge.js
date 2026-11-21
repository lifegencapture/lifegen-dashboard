/* LifeGen Video Dashboard: Firebase bridge.
 *
 * The dashboard was first built as a claude.ai artifact, where it asks for its
 * services with claude.use("db" | "user" | "assets" | "downloads"). This file
 * provides the same four services on top of Firebase (Google sign-in, Firestore
 * and Cloud Storage), so the dashboard code itself barely changes.
 *
 * Access: only Google accounts listed in the Firestore document access/list
 * (or the owner) get in. Roles there: "admin", "editor" or "viewer".
 * The owner's email is written only in the Firestore rules (in the Firebase
 * console), never in these public files. The rules let only list members and
 * the owner read access/list, so someone who can read it but isn't on it is
 * the owner.
 */
(function () {
  const cfg = window.LIFEGEN_FIREBASE || {};
  const configured = cfg.projectId && !/PASTE/.test(cfg.projectId + cfg.apiKey);

  /* ---------- a small full-screen gate for signing in ---------- */
  function gate(html) {
    let g = document.getElementById("lg-gate");
    if (!g) {
      g = document.createElement("div");
      g.id = "lg-gate";
      g.style.cssText = "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:var(--bg,#0a0a0a);color:var(--ink,#f4f4f4);font-family:var(--font-body,system-ui,sans-serif)";
      (document.body || document.documentElement).appendChild(g);
    }
    g.innerHTML = `<div style="max-width:420px;width:100%;display:grid;gap:18px;text-align:center">
      <img src="lifegen-logo-white.png" alt="LifeGen" style="height:22px;margin:0 auto;filter:var(--logo-filter,none)">
      ${html}</div>`;
    return g;
  }
  const hideGate = () => { const g = document.getElementById("lg-gate"); if (g) g.remove(); };
  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const btn = "font:600 .8rem var(--font-body,system-ui);letter-spacing:.06em;text-transform:uppercase;padding:13px 20px;border-radius:999px;border:1px solid var(--ink,#f4f4f4);background:var(--ink,#f4f4f4);color:var(--bg,#0a0a0a);cursor:pointer";
  const btnLine = btn.replace("background:var(--ink,#f4f4f4);color:var(--bg,#0a0a0a)", "background:transparent;color:var(--ink,#f4f4f4)");

  window.blobUrl = () => "";   // replaced below once Firebase is connected

  if (!configured) {
    document.addEventListener("DOMContentLoaded", () => gate(`
      <h1 style="font:800 1.8rem var(--font-display,system-ui);margin:0">Almost ready</h1>
      <p style="margin:0;color:var(--muted,#9b9b9b);line-height:1.5">This copy of the LifeGen Video Dashboard isn't connected to Firebase yet. Paste the Firebase web config into <b>firebase-config.js</b> (see README.md).</p>`));
    return;   // leave window.claude undefined: the dashboard shows its own notice
  }

  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const fs = firebase.firestore();
  fs.settings({ ignoreUndefinedProperties: true, merge: true });
  const storage = firebase.storage();
  const bucket = cfg.storageBucket;

  let ready, resolveReady;
  ready = new Promise((r) => (resolveReady = r));
  let session = null;   // { user, email, role, owner }

  /* ---------- files (review copies, screenshots, fonts, photos) ---------- */
  // An asset id is "<name>~<download token>". The token makes the link work in
  // <img> and <video> tags without sign-in headers, and is unguessable.
  window.blobUrl = (id) => {
    const [name, token] = String(id || "").split("~");
    if (!name || !token) return "";
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent("assets/" + name)}?alt=media&token=${token}`;
  };
  const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const assets = {
    async upload(file) {
      const name = rand();
      const ref = storage.ref("assets/" + name);
      await ref.put(file, { contentType: file.type || "application/octet-stream", customMetadata: { originalName: file.name || "" } });
      const url = await ref.getDownloadURL();
      const token = new URL(url).searchParams.get("token") || "";
      return { id: `${name}~${token}`, contentType: file.type || "", sizeBytes: file.size || 0 };
    },
    async delete(id) {
      const name = String(id || "").split("~")[0];
      if (name) await storage.ref("assets/" + name).delete();
    },
  };

  const downloads = {
    async save({ filename, data }) {
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
      const a = document.createElement("a");
      a.href = url; a.download = filename || "download"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
  };

  const userApi = {
    async id() { return session.user.uid; },
    async me() { return { name: session.user.displayName || "", email: session.email }; },
    async isOwner() { return session.owner; },
    async can(perm) { return perm === "data.write" ? session.role !== "viewer" : true; },
  };

  /* ---------- who can sign in (owner and admins manage this) ---------- */
  window.lgAccess = {
    async get() { const s = await fs.doc("access/list").get(); return (s.exists && s.data().emails) || {}; },
    async save(emails) {
      // Remember who the owner is, so they stay the owner even if they add themselves to the list.
      const cur = await fs.doc("access/list").get();
      const owner = session.owner ? session.email : (cur.exists && cur.data().owner) || "";
      await fs.doc("access/list").set({ emails, owner, updatedAt: new Date().toISOString(), updatedBy: session.email });
    },
    get role() { return session ? session.role : ""; },
    get email() { return session ? session.email : ""; },
    signOut: () => auth.signOut().then(() => location.reload()),
  };

  /* ---------- the claude.use() stand-in the dashboard expects ---------- */
  window.claude = {
    use(name) {
      return ready.then(() => ({ db: fs, user: userApi, assets, downloads }[name] || null));
    },
  };

  /* ---------- sign-in flow ---------- */
  function showSignIn(msg) {
    const g = gate(`
      <h1 style="font:800 2rem var(--font-display,system-ui);margin:0">LifeGen Video Dashboard</h1>
      <p style="margin:0;color:var(--muted,#9b9b9b);line-height:1.5">${msg || "Sign in with the Google account Maxine added for you."}</p>
      <button type="button" id="lg-signin" style="${btn}">Sign in with Google</button>`);
    g.querySelector("#lg-signin").onclick = () => {
      const p = new firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      auth.signInWithPopup(p).catch((e) => {
        if (e && e.code === "auth/popup-blocked") return auth.signInWithRedirect(p);
        if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") showSignIn("Couldn't sign in. Try again.");
      });
    };
  }
  function showNoAccess(email) {
    const g = gate(`
      <h1 style="font:800 1.8rem var(--font-display,system-ui);margin:0">Not on the list yet</h1>
      <p style="margin:0;color:var(--muted,#9b9b9b);line-height:1.5">You're signed in as <b>${esc(email)}</b>, but this account hasn't been added to the dashboard. Send this email to Maxine, Li Jin or Mie Chelle and they'll add you.</p>
      <button type="button" id="lg-other" style="${btnLine}">Use a different account</button>`);
    g.querySelector("#lg-other").onclick = () => auth.signOut();
  }

  let started = false;
  auth.onAuthStateChanged(async (u) => {
    if (!u) { if (started) location.reload(); else document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => showSignIn()) : showSignIn(); return; }
    const email = String(u.email || "").toLowerCase();
    let role = "", owner = false;
    try {
      const s = await fs.doc("access/list").get();
      const r = s.exists && s.data().emails ? s.data().emails[email] : "";
      if (r) role = r; else { owner = true; role = "admin"; }   // allowed to read but not listed: the owner
      if (r && s.data().owner === email) owner = true;
    } catch { /* permission denied: not on the list */ }
    if (!role) { showNoAccess(email); return; }
    session = { user: u, email, role, owner };
    started = true;
    hideGate();
    resolveReady();
  });
})();
