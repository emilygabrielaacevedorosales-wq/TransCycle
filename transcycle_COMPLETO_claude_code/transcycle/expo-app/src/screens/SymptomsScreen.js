import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { getSymptoms, logSymptoms } from "../api/client";
import { Card, PrimaryButton, Screen, SectionLabel } from "../components";
import { average, formatRelativeDate } from "../utils";
import { useTheme } from "../hooks/useTheme";

const symptomLabels = {
  moodScore: "Estado de animo",
  breastTenderness: "Sensibilidad mamaria",
  fatigueLevel: "Fatiga",
  digestiveChanges: "Cambios digestivos",
  libidoScore: "Libido",
  skinChanges: "Cambios en piel",
  brainFog: "Niebla mental",
  emotionalLability: "Labilidad emocional",
};

const initialScores = {
  moodScore: 7,
  breastTenderness: 4,
  fatigueLevel: 4,
  digestiveChanges: 3,
  libidoScore: 6,
  skinChanges: 5,
  brainFog: 3,
  emotionalLability: 5,
};

export function SymptomsScreen({ session }) {
  const theme = useTheme();
  const [scores, setScores] = useState(initialScores);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await getSymptoms(session, session?.mode || "demo", 7);
      setHistory(rows);
    } catch (nextError) {
      setError(nextError.message || "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await logSymptoms(session, session?.mode || "demo", {
        loggedAt: new Date().toISOString(),
        ...scores,
      });
      await load();
    } catch (nextError) {
      setError(nextError.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const avgScore = useMemo(() => average(Object.values(scores)), [scores]);
  const styles = createSymptomsStyles(theme);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Sintomas</Text>
        <Text style={styles.subtitle}>Registra el dia y observa tus patrones recientes.</Text>
      </View>

      <Card style={styles.formCard}>
        <View style={styles.formHeader}>
          <SectionLabel>Registro de hoy</SectionLabel>
          <Text style={styles.average}>Promedio {avgScore.toFixed(1)}/10</Text>
        </View>

        {Object.entries(symptomLabels).map(([key, label]) => (
          <View key={key} style={styles.sliderRow}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>{label}</Text>
              <Text style={styles.sliderValue}>{scores[key]}</Text>
            </View>
            <View style={styles.segmentRow}>
              {Array.from({ length: 10 }, (_, index) => {
                const value = index + 1;
                const active = value <= scores[key];
                return (
                  <Pressable
                    key={value}
                    onPress={() => setScores((current) => ({ ...current, [key]: value }))}
                    style={[styles.segment, active && styles.segmentActive]}
                  />
                );
              })}
            </View>
          </View>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Guardar registro de hoy" onPress={save} loading={saving} />
      </Card>

      <SectionLabel>Historial reciente</SectionLabel>
      {loading ? (
        <ActivityIndicator color={theme.colors.pinkAccent} />
      ) : (
        history.map((entry) => {
          const scoresList = [
            entry.mood_score,
            entry.breast_tenderness,
            entry.fatigue_level,
            entry.digestive_changes,
            entry.libido_score,
            entry.skin_changes,
            entry.brain_fog,
            entry.emotional_lability,
          ].filter((item) => typeof item === "number");

          return (
            <Card key={entry.id || entry.logged_at} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>{formatRelativeDate(entry.logged_at)}</Text>
                <Text style={styles.historyMeta}>{entry.virtual_cycle_day ? `Dia ${entry.virtual_cycle_day}` : "-"}</Text>
              </View>
              <View style={styles.historyBars}>
                {scoresList.map((item, index) => (
                  <View key={`${entry.id || "entry"}-${index}`} style={[styles.historyBar, { height: 12 + item * 7 }]} />
                ))}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

function createSymptomsStyles(theme) {
  return StyleSheet.create({
    header: {
      gap: 4,
    },
    title: {
      fontSize: 30,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    subtitle: {
      color: theme.colors.textSecondary,
    },
    formCard: {
      gap: 14,
    },
    formHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    average: {
      color: theme.colors.pinkAccent,
      fontWeight: "600",
    },
    sliderRow: {
      gap: 8,
    },
    sliderHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    sliderLabel: {
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    sliderValue: {
      color: theme.colors.textPrimary,
      fontWeight: "700",
    },
    segmentRow: {
      flexDirection: "row",
      gap: 6,
    },
    segment: {
      flex: 1,
      height: 12,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.bg3,
    },
    segmentActive: {
      backgroundColor: theme.colors.pinkAccent,
    },
    error: {
      color: theme.colors.trough,
    },
    historyCard: {
      paddingVertical: 14,
      gap: 14,
    },
    historyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    historyDate: {
      color: theme.colors.textSecondary,
      fontWeight: "600",
    },
    historyMeta: {
      color: theme.colors.textTertiary,
    },
    historyBars: {
      flexDirection: "row",
      gap: 6,
      alignItems: "flex-end",
    },
    historyBar: {
      width: 12,
      borderRadius: 4,
      backgroundColor: theme.colors.pinkAccent,
    },
  });
}
