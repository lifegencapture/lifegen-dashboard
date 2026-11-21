# LifeGen Video Dashboard (web version)

The same dashboard as the claude.ai version, running on **GitHub Pages** with **Google Firebase** for sign-in, data and files. People sign in with their Google account; no Claude account needed.

What's in this folder:

| File | What it is |
|---|---|
| `index.html` | The dashboard |
| `bridge.js` | Connects the dashboard to Firebase (sign-in, data, files) |
| `firebase-config.js` | Your Firebase project's settings (you paste these in) |
| `firestore.rules`, `storage.rules` | Who can see and change what (pasted into Firebase) |
| logos, `sop-images/` | Images the dashboard uses |

The data export (`lifegen-export/`) is kept **outside** this folder on purpose, so it never ends up on GitHub.

---

## Step 1: Create the Firebase project (about 15 minutes)

1. Go to **console.firebase.google.com** and sign in with the Google account that should own the dashboard (ideally a church or media-team account).
2. **Create a project** called `LifeGen Video Dashboard`. Google Analytics: you can turn it off.
3. **Add a web app:** on the project home, click the `</>` (Web) icon, name it `dashboard`, don't tick Firebase Hosting, then **Register app**. Firebase shows a block like `const firebaseConfig = { apiKey: "...", ... }`. **Copy it and send it to Claude** (it's not a password).
4. **Sign-in:** Build › **Authentication** › Get started › **Google** › Enable › pick a support email › Save.
5. **Database:** Build › **Firestore Database** › Create database › choose a location close to you (e.g. `asia-southeast1` Singapore) › start in **production mode**.
6. **File storage:** Build › **Storage** › Get started. Google asks you to upgrade to the **Blaze** plan (pay as you go, card required). Normal use for a team your size stays within the free allowance. Then, in Google Cloud billing, set a **budget alert** (e.g. RM 5) so you're emailed if it ever costs anything.

## Step 2: Paste the rules

In both files, replace `PASTE_OWNER_EMAIL` with the owner's Google email, in lowercase.

- Firestore Database › **Rules** tab: paste `firestore.rules` › **Publish**.
- Storage › **Rules** tab: paste `storage.rules` › **Publish**. If Firebase asks to let Storage read Firestore, allow it.

## Step 3: Put it on GitHub Pages

1. Create a free account at **github.com** if you don't have one.
2. New repository › name it `lifegen-dashboard` › **Public** (free GitHub Pages needs public; no passwords or private data are in these files) › Create.
3. Upload the contents of this folder (Add file › Upload files), or let Claude push it.
4. Repository **Settings › Pages** › Source: *Deploy from a branch* › Branch: `main` / root › Save. After a minute it's live at `https://YOUR-USERNAME.github.io/lifegen-dashboard/`.
5. Back in Firebase: Authentication › **Settings › Authorized domains** › Add `YOUR-USERNAME.github.io` (and later `lifegenvideo.my`).

## Step 4: First sign-in and moving the data over

1. Open the GitHub Pages link and **Sign in with Google** as the owner.
2. Pick your name and fill in your profile.
3. **Team › Manage team & Drive › Import from the claude.ai dashboard:** choose `lifegen-export/lifegen-dashboard-export.json`. This loads all videos, settings, the SOP and brand info.
4. In the same dialog, under **Who can sign in**, add each person's Google email: **Admin** for media heads, **Editor** for editors, **View only** for projection and lights. Save.

Uploaded files (W.O.W.'s review copy, 2 lyric screenshots, 1 font file, 3 brand files and profile photos) are moved separately; ask Claude.

## Step 5 (optional): Let photos be edited and drafts saved

Profile photo "Adjust" and the draft **Save** button read files back from Storage, which needs a one-time CORS setting. In Google Cloud console, open **Cloud Shell** and run:

```
echo '[{"origin":["*"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json
gcloud storage buckets update gs://YOUR-PROJECT-ID.firebasestorage.app --cors-file=cors.json
```

## What's different from the claude.ai version

- **Sign-in:** Google account instead of Claude account. Access is the **Who can sign in** list (Team › Manage team & Drive), instead of the claude.ai Share menu.
- **Security:** the rules are enforced by Firebase, so editors can't change admin-only things even outside the dashboard.
- **Telegram alerts:** the relay still reads the claude.ai version. Switching it to Firebase (and off your Mac) is a next step.
- **Your own address:** later, point `lifegenvideo.my` at GitHub Pages (Settings › Pages › Custom domain).
