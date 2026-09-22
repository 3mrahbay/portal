const FIREBASE_CONFIGS = Object.freeze({
  production: Object.freeze({
    apiKey: "AIzaSyARlqAoh-HRBC9xPwj7qRgG-IuZFSH39Uc",
    authDomain: "bcka-site.firebaseapp.com",
    projectId: "bcka-site",
    storageBucket: "bcka-site.firebasestorage.app",
    messagingSenderId: "736581475783",
    appId: "1:736581475783:web:5729a05ed4d05f1d1d0de2"
  }),
  staging: Object.freeze({
    apiKey: "AIzaSyA8RmzGJUPxhwLSQYOmtJQtCR2WrIamPIA",
    authDomain: "bcka-site-staging.firebaseapp.com",
    projectId: "bcka-site-staging",
    storageBucket: "bcka-site-staging.firebasestorage.app",
    messagingSenderId: "959561437954",
    appId: "1:959561437954:web:fed93eae5752e887dc281b"
  })
});

const STAGING_HOSTS = new Set([
  "bcka-site-staging.web.app",
  "bcka-site-staging.firebaseapp.com"
]);

export function firebaseEnvironmentForHost(hostname = "") {
  return STAGING_HOSTS.has(String(hostname).trim().toLowerCase())
    ? "staging"
    : "production";
}

export function firebaseConfigForHost(hostname = "") {
  return FIREBASE_CONFIGS[firebaseEnvironmentForHost(hostname)];
}
