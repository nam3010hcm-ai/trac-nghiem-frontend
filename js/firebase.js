import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, getDoc,
  addDoc, setDoc, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC0qFK22HSRMD76ss8UUqBnzIbNGfal56c",
  authDomain: "trac-nghiem-online-99801.firebaseapp.com",
  projectId: "trac-nghiem-online-99801",
  storageBucket: "trac-nghiem-online-99801.firebasestorage.app",
  messagingSenderId: "952355515696",
  appId: "1:952355515696:web:a1cfe0a32455883c0bacf5",
  measurementId: "G-B0Y2PXTQEC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
  db, auth,
  collection, getDocs, getDoc, addDoc, setDoc, doc, deleteDoc,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
};
