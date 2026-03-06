// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCzNXyHOJKGVGBB08pA5AE9f8XrS5HQfrE",
  authDomain: "project-1-a31cb.firebaseapp.com",
  projectId: "project-1-a31cb",
  storageBucket: "project-1-a31cb.firebasestorage.app",
  messagingSenderId: "376954672764",
  appId: "1:376954672764:web:48bffeb0eb602562d9dbf9",
  measurementId: "G-RSS3SEJGTV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);