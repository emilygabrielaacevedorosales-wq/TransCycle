import React, { useEffect } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "./src/context/AppContext";
import { Root } from "./src/Root";
import { theme } from "./src/theme";
import { requestPermissions } from "./src/notifications/scheduler";

function AppContent() {
  useEffect(() => {
    requestPermissions();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <Root />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
});
