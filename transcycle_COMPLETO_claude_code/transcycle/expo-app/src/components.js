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
import { colorForPhase, theme } from "./theme";

export function Screen({ children }) {
  return <ScrollView contentContainerStyle={styles.screen}>{children}</ScrollView>;
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function PrimaryButton({ title, onPress, disabled, loading }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={[styles.button, (disabled || loading) && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function Pill({ children, tone = "default" }) {
  return <View style={[styles.pill, tone === "accent" && styles.pillAccent]}><Text style={[styles.pillText, tone === "accent" && styles.pillAccentText]}>{children}</Text></View>;
}

export function AppTextInput({ style, ...props }) {
  return <TextInput placeholderTextColor={theme.colors.textTertiary} style={[styles.input, style]} {...props} />;
}

export function TabBar({ activeTab, onChange }) {
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

export function StatCard({ value, label, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function ConfidenceBar({ score }) {
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

export function PhaseStripe({ phase, title, description }) {
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

export function EmptyState({ title, description }) {
  return (
    <Card style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.bg2,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.textTertiary,
  },
  button: {
    minHeight: 52,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.pinkAccent,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.bg3,
  },
  pillAccent: {
    backgroundColor: "rgba(196, 114, 138, 0.14)",
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  pillAccentText: {
    color: theme.colors.pinkAccent,
    fontWeight: "600",
  },
  input: {
    minHeight: 50,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    paddingHorizontal: 14,
    color: theme.colors.textPrimary,
  },
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    backgroundColor: "rgba(250, 248, 245, 0.96)",
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
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.bg2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
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
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.bg3,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    backgroundColor: theme.colors.pinkAccent,
    borderRadius: theme.radius.pill,
  },
  helperText: {
    marginTop: 8,
    color: theme.colors.textTertiary,
    fontSize: 12,
  },
  phaseRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  phaseStripe: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: theme.radius.pill,
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
