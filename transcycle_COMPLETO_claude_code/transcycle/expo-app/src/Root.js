import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "./context/AppContext";
import { TabBar } from "./components";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { DiaryScreen } from "./screens/DiaryScreen";
import { HrtScreen } from "./screens/HrtScreen";
import { SymptomsScreen } from "./screens/SymptomsScreen";
import { theme } from "./theme";

export function Root() {
  const { activeTab, login, logout, register, session, setActiveTab } = useApp();
  const [loading, setLoading] = useState(false);

  async function run(action) {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <AuthScreen
        loading={loading}
        onLogin={(email, password) => run(() => login(email, password))}
        onRegister={(payload) => run(() => register(payload))}
      />
    );
  }

  let screen = <DashboardScreen session={session} />;
  if (activeTab === "symptoms") screen = <SymptomsScreen session={session} />;
  if (activeTab === "hrt") screen = <HrtScreen session={session} />;
  if (activeTab === "analytics") screen = <AnalyticsScreen session={session} />;
  if (activeTab === "diary") screen = <DiaryScreen session={session} />;

  return (
    <View style={styles.app}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>TransCycle</Text>
          <Text style={styles.topBarSub}>
            {session.mode === "demo" ? "Expo Go listo en modo demo" : "Sesion conectada"}
          </Text>
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.logout}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.content}>{screen}</View>
      <TabBar activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  topBarSub: {
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  logout: {
    color: theme.colors.pinkAccent,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
});
