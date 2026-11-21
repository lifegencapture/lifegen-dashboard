// Firebase settings for the LifeGen Video Dashboard.
// These values are not secret: they only say which Firebase project to talk to.
// Who can read or change anything is decided by the Firestore and Storage rules,
// which live in the Firebase console (the owner's email is set there, not here).
window.LIFEGEN_FIREBASE = {
  apiKey: "AIzaSyBT35Hmkm64ZcqPjpOUuBwNFW3OV1kI09w",
  authDomain: "lifegen-video-dashboard.firebaseapp.com",
  projectId: "lifegen-video-dashboard",
  storageBucket: "lifegen-video-dashboard.firebasestorage.app",
  messagingSenderId: "543566026940",
  appId: "1:543566026940:web:19ea8ac56eb069dcb458b9",
};

// Google Drive upload ("Upload to Drive" on approved videos).
// Google Cloud console › APIs & Services › Credentials › OAuth 2.0 Client IDs ›
// "Web client (auto created by Google Service)" › copy the Client ID. Not secret.
window.LIFEGEN_GOOGLE_CLIENT_ID = "543566026940-31lem5a3smcbl6468l88d9sv3kqqjf0f.apps.googleusercontent.com";
