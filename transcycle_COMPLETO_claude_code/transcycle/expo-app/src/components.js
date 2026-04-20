import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colorForPhase } from "./theme";
import { useTheme } from "./hooks/useTheme";

function createScreenStyles(theme) {
  return StyleSheet.create({
    screen: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.md,
    },
  });
}

export function Screen({ children }) {
  const theme = useTheme();
  const styles = createScreenStyles(theme);
  return <ScrollView contentContainerStyle={styles.screen}>{children}</ScrollView>;
}

function createCardStyles(theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.bg2,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });
}

export function Card({ children, style }) {
  const theme = useTheme();
  const styles = createCardStyles(theme);
  return <View style={[styles.card, style]}>{children}</View>;
}

function createSectionLabelStyles(theme) {
  return StyleSheet.create({
    sectionLabel: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
  });
}

export function SectionLabel({ children }) {
  const theme = useTheme();
  const styles = createSectionLabelStyles(theme);
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function createPrimaryButtonStyles(theme) {
  return StyleSheet.create({
    button: {
      backgroundColor: theme.colors.pinkAccent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      height: 48,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: theme.colors.white,
      fontSize: 16,
      fontWeight: "600",
    },
  });
}

export function PrimaryButton({ title, onPress, disabled, loading }) {
  const theme = useTheme();
  const styles = createPrimaryButtonStyles(theme);
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={[styles.button, (disabled || loading) && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

function createPillStyles(theme) {
  return StyleSheet.create({
    pill: {
      backgroundColor: theme.colors.bg3,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      alignSelf: "flex-start",
    },
    pillAccent: {
      backgroundColor: theme.colors.pinkAccent,
    },
    pillText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    pillAccentText: {
      color: theme.colors.white,
    },
  });
}

export function Pill({ children, tone = "default" }) {
  const theme = useTheme();
  const styles = createPillStyles(theme);
  return <View style={[styles.pill, tone === "accent" && styles.pillAccent]}><Text style={[styles.pillText, tone === "accent" && styles.pillAccentText]}>{children}</Text></View>;
}

function createInputStyles(theme) {
  return StyleSheet.create({
    input: {
      backgroundColor: theme.colors.bg2,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.textPrimary,
      fontSize: 16,
    },
  });
}

export function AppTextInput({ style, ...props }) {
  const theme = useTheme();
  const styles = createInputStyles(theme);
  return <TextInput placeholderTextColor={theme.colors.textTertiary} style={[styles.input, style]} {...props} />;
}

function createTabBarStyles(theme) {
  return StyleSheet.create({
    tabBar: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 16,
      flexDirection: "row",
      backgroundColor: theme.colors.colorScheme === "dark" ? "rgba(26, 24, 21, 0.96)" : "rgba(250, 248, 245, 0.96)",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 6,
      gap: 4,
    },
    tabItem: {
      flex: 1,
      minHeight: 48,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    tabItemActive: {
      backgroundColor: "rgba(196, 114, 138, 0.14)",
    },
    tabText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    tabTextActive: {
      color: theme.colors.pinkAccent,
    },
  });
}

export function TabBar({ activeTab, onChange }) {
  const theme = useTheme();
  const styles = createTabBarStyles(theme);
  const tabs = [
    { key: "cycle", label: "Ciclo" },
    { key: "symptoms", label: "Sintomas" },
    { key: "hrt", label: "TRH" },
    { key: "analytics", label: "Analiticas" },
    { key: "diary", label: "Diario" },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}>
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStatCardStyles(theme) {
  return StyleSheet.create({
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.bg2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: "center",
    },
    statValue: {
      fontSize: 26,
      fontWeight: "500",
    },
    statLabel: {
      marginTop: 4,
      fontSize: 11,
      color: theme.colors.textTertiary,
      textAlign: "center",
    },
  });
}

export function StatCard({ value, label, color }) {
  const theme = useTheme();
  const styles = createStatCardStyles(theme);
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createConfidenceBarStyles(theme) {
  return StyleSheet.create({
    confidenceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    confidenceLabel: {
      color: theme.colors.textTertiary,
      fontSize: 12,
    },
    confidenceTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.bg3,
      overflow: "hidden",
    },
    confidenceFill: {
      height: "100%",
      backgroundColor: theme.colors.pinkAccent,
      borderRadius: 999,
    },
    helperText: {
      marginTop: 8,
      color: theme.colors.textTertiary,
      fontSize: 12,
    },
  });
}

export function ConfidenceBar({ score }) {
  const theme = useTheme();
  const styles = createConfidenceBarStyles(theme);
  return (
    <View>
      <View style={styles.confidenceHeader}>
        <Text style={styles.confidenceLabel}>Confianza del modelo</Text>
        <Text style={styles.confidenceLabel}>{Math.round(score * 100)}%</Text>
      </View>
      <View style={styles.confidenceTrack}>
        <View style={[styles.confidenceFill, { width: `${Math.max(8, score * 100)}%` }]} />
      </View>
      {score < 0.4 ? <Text style={styles.helperText}>Registra sintomas con mas frecuencia para mejorar la precision.</Text> : null}
    </View>
  );
}

function createPhaseStripeStyles(theme) {
  return StyleSheet.create({
    phaseRow: {
      flexDirection: "row",
      gap: 14,
      alignItems: "center",
    },
    phaseStripe: {
      width: 4,
      alignSelf: "stretch",
      borderRadius: 999,
    },
    phaseCopy: {
      flex: 1,
      gap: 4,
    },
    phaseTitle: {
      fontSize: 17,
      color: theme.colors.textPrimary,
      fontWeight: "600",
    },
    phaseDescription: {
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
  });
}

export function PhaseStripe({ phase, title, description }) {
  const theme = useTheme();
  const styles = createPhaseStripeStyles(theme);
  return (
    <Card>
      <View style={styles.phaseRow}>
        <View style={[styles.phaseStripe, { backgroundColor: colorForPhase(phase) }]} />
        <View style={styles.phaseCopy}>
          <Text style={styles.phaseTitle}>{title}</Text>
          <Text style={styles.phaseDescription}>{description}</Text>
        </View>
      </View>
    </Card>
  );
}

function createEmptyStateStyles(theme) {
  return StyleSheet.create({
    emptyState: {
      alignItems: "flex-start",
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    emptyDescription: {
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
  });
}

export function EmptyState({ title, description }) {
  const theme = useTheme();
  const styles = createEmptyStateStyles(theme);
  return (
    <Card style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </Card>
  );
}
