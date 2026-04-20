import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCzDIUxcGrwEK7m2Bzft4Cl9Glata7AR4s",
  authDomain: "transcycle-58b76.firebaseapp.com",
  projectId: "transcycle-58b76",
  storageBucket: "transcycle-58b76.firebasestorage.app",
  messagingSenderId: "260941871117",
  appId: "1:260941871117:web:fef54621316be0d281fd44",
  measurementId: "G-BPWGTS13MT"
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
