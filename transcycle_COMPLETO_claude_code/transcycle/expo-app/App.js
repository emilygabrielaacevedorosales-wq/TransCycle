import React, { useEffect } from "react";
import { SafeAreaView, StyleSheet, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "./src/context/AppContext";
import { Root } from "./src/Root";
import { getTheme } from "./src/theme";
import { requestPermissions } from "./src/notifications/scheduler";

function AppContent() {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  useEffect(() => {
    requestPermissions();
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
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
  },
});
