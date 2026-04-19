import React, { createContext, useContext, useState, useEffect } from "react";
import { loginUser, registerUser, logoutUser, subscribeToAuthState } from "../firebase/auth";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("cycle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const unsubscribe = subscribeToAuthState((user) => {
        console.log("AppContext: Auth state changed:", user?.user?.email || "no session");
        setSession(user);
        setLoading(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error("AppContext: Error en subscribeToAuthState:", error);
      setLoading(false);
    }
  }, []);

  const value = {
    session,
    activeTab,
    setActiveTab,
    loading,
    login: async (email, password) => {
      const next = await loginUser(email, password);
      setSession(next);
      return next;
    },
    register: async (payload) => {
      const next = await registerUser(payload);
      setSession(next);
      return next;
    },
    logout: async () => {
      await logoutUser();
      setSession(null);
      setActiveTab("cycle");
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
