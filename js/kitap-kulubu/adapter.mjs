import {
  initializeApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import * as fb from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const config = {
  apiKey: "AIzaSyARlqAoh-HRBC9xPwj7qRgG-IuZFSH39Uc",
  authDomain: "bcka-site.firebaseapp.com",
  projectId: "bcka-site",
  storageBucket: "bcka-site.firebasestorage.app",
  messagingSenderId: "736581475783",
  appId: "1:736581475783:web:5729a05ed4d05f1d1d0de2",
};
const app = getApps()[0] || initializeApp(config);
const auth = getAuth(app),
  db = fb.getFirestore(app);
export { auth, db, fb, onAuthStateChanged };
