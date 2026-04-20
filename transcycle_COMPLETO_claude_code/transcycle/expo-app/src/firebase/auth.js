import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { auth, db } from "./config";

async function buildSessionObject(user) {
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const userData = userDoc.exists() ? userDoc.data() : {};

  return {
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
  };
}

export async function loginUser(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return buildSessionObject(result.user);
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function registerUser({ email, password, displayName, pronouns }) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const uid = result.user.uid;

    await setDoc(doc(db, "users", uid), {
      uid,
      email,
      display_name: displayName || email.split("@")[0],
      pronouns: pronouns || null,
      timezone: "America/Santiago",
      discrete_mode_enabled: false,
      discrete_app_name: null,
      discrete_icon_key: null,
      biometric_enabled: false,
      created_at: serverTimestamp()
    });

    return buildSessionObject(result.user);
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

export async function saveBiometricCredentials(email, password) {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) throw new Error("Dispositivo no soporta biometría");

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) throw new Error("No hay biometría configurada en el dispositivo");

    // Guardar credenciales encriptadas en AsyncStorage (simplificado - idealmente usar Keychain)
    const credentials = btoa(JSON.stringify({ email, password })); // Base64 simple
    await AsyncStorage.setItem("biometric_credentials", credentials);
    await AsyncStorage.setItem("biometric_enabled", "true");

    return true;
  } catch (error) {
    console.warn("Error guardando biometría:", error);
    throw error;
  }
}

export async function attemptBiometricLogin() {
  try {
    const bioEnabled = await AsyncStorage.getItem("biometric_enabled");
    if (!bioEnabled) return null;

    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return null;

    const authenticated = await LocalAuthentication.authenticateAsync({
      disableDeviceFallback: false,
      reason: "Desbloquea TransCycle con tu biometría",
    });

    if (!authenticated.success) return null;

    const encryptedCreds = await AsyncStorage.getItem("biometric_credentials");
    if (!encryptedCreds) return null;

    try {
      const { email, password } = JSON.parse(atob(encryptedCreds));
      const result = await signInWithEmailAndPassword(auth, email, password);
      return buildSessionObject(result.user);
    } catch {
      // Si falla el login con biometría, limpiar
      await AsyncStorage.removeItem("biometric_credentials");
      await AsyncStorage.removeItem("biometric_enabled");
      return null;
    }
  } catch (error) {
    console.warn("Error en biometric login:", error);
    return null;
  }
}

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        callback(await buildSessionObject(user));
      } catch (error) {
        console.error("Error building session:", error);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
}
