import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeLEdQvF_gSGGtudMo_Kt92V-DsEW1BHI",
  authDomain: "dreha-947dc.firebaseapp.com",
  projectId: "dreha-974dc",
  storageBucket: "dreha-974dc.firebasestorage.app",
  messagingSenderId: "360516392301",
  appId: "1:360516392301:web:e41828484d93da4c7a3664",
  measurementId: "G-7NJCTQESBS"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
