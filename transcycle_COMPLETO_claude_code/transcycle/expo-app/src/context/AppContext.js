import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser, registerUser, logoutUser, subscribeToAuthState, attemptBiometricLogin } from "../firebase/auth";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("cycle");
  const [loading, setLoading] = useState(true);
  const [manualTheme, setManualTheme] = useState(null);
  const systemColorScheme = useColorScheme();
  const colorScheme = manualTheme || systemColorScheme;

  useEffect(() => {
    const initApp = async () => {
      try {
        // Cargar tema guardado
        const savedTheme = await AsyncStorage.getItem("app_theme");
        if (savedTheme) setManualTheme(savedTheme);

        // Intentar biometric login primero
        const bioSession = await attemptBiometricLogin();
        if (bioSession) {
          console.log("✓ Auto-login con biometría exitoso");
          setSession(bioSession);
          setLoading(false);
          return;
        }

        // Luego intentar auto-login con credenciales guardadas
        const savedEmail = await AsyncStorage.getItem("app_remember_email");
        if (savedEmail) {
          console.log("AppContext: Intentando auto-login...");
          // El subscribeToAuthState manejará el auto-login vía Firebase
        }

        const unsubscribe = subscribeToAuthState((user) => {
          console.log("AppContext: Auth state changed:", user?.user?.email || "no session");
          setSession(user);
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error("AppContext: Error en initApp:", error);
        setLoading(false);
      }
    };

    const cleanup = initApp();
    return () => {
      cleanup?.then?.(unsub => unsub?.());
    };
  }, []);

  const toggleTheme = async () => {
    try {
      const newTheme = manualTheme === "dark" ? "light" : "dark";
      setManualTheme(newTheme);
      await AsyncStorage.setItem("app_theme", newTheme);
    } catch (error) {
      console.warn("Error toggling theme:", error);
    }
  };

  const value = {
    session,
    activeTab,
    setActiveTab,
    loading,
    colorScheme,
    manualTheme,
    toggleTheme,
    login: async (email, password, rememberMe = false) => {
      const next = await loginUser(email, password);
      if (rememberMe) {
        await AsyncStorage.setItem("app_remember_email", email);
      } else {
        await AsyncStorage.removeItem("app_remember_email");
      }
      setSession(next);
      return next;
    },
    register: async (payload) => {
      const next = await registerUser(payload);
      await AsyncStorage.removeItem("app_remember_email");
      setSession(next);
      return next;
    },
    logout: async () => {
      await logoutUser();
      await AsyncStorage.removeItem("app_remember_email");
      setSession(null);
      setActiveTab("cycle");
    },
    loginWithBiometric: async () => {
      const next = await attemptBiometricLogin();
      if (next) setSession(next);
      return next;
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useApp debe usarse dentro de AppProvider");
  }
  return value;
}
