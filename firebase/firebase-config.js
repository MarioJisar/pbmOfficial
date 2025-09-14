
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhILwOFVq14nGlg5MYm7eLDuOKy_IdNfA",
  authDomain: "pbmofficial-a22a1.firebaseapp.com",
  projectId: "pbmofficial-a22a1",
  storageBucket: "pbmofficial-a22a1.firebasestorage.app",
  messagingSenderId: "982178990497",
  appId: "1:982178990497:web:13f9575e1f90f84a6263e0",
  measurementId: "G-95G6CVQ0KE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
