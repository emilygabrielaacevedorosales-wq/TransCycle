import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";

export async function loginUser(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", result.user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};

    return {
      token: await result.user.getIdToken(),
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: userData.display_name || result.user.displayName || "Usuario",
        pronouns: userData.pronouns || null,
        timezone: userData.timezone || "America/Santiago",
        discreteMode: userData.discrete_mode_enabled || false
      },
      mode: "live"
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function registerUser({ email, password, displayName, pronouns }) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const uid = result.user.uid;

    // Crear documento de usuario en Firestore
    await setDoc(doc(db, "users", uid), {
      uid,
      email,
      display_name: displayName || email.split("@")[0],
      pronouns: pronouns || null,
      timezone: "America/Santiago",
      discrete_mode_enabled: false,
      discrete_app_name: null,
      discrete_icon_key: null,
      biometric_lock: false,
      created_at: serverTimestamp()
    });

    return {
      token: await result.user.getIdToken(),
      user: {
        uid,
        email,
        displayName: displayName || email.split("@")[0],
        pronouns: pronouns || null,
        timezone: "America/Santiago",
        discreteMode: false
      },
      mode: "live"
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(error.message);
  }
}

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      callback({
        token: await user.getIdToken(),
        user: {
          uid: user.uid,
          email: user.email,
          displayName: userData.display_name || user.displayName || "Usuario",
          pronouns: userData.pronouns || null,
          timezone: userData.timezone || "America/Santiago",
          discreteMode: userData.discrete_mode_enabled || false
        },
        mode: "live"
      });
    } else {
      callback(null);
    }
  });
}
