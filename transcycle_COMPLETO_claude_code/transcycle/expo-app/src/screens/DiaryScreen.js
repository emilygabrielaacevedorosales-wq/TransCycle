import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getDiaryEntries, saveDiaryEntry } from "../api/client";
import { AppTextInput, Card, EmptyState, PrimaryButton, Screen, SectionLabel } from "../components";
import { formatShortDate } from "../utils";
import { useTheme } from "../hooks/useTheme";

export function DiaryScreen({ session }) {
  const theme = useTheme();
  const [wellbeingScore, setWellbeingScore] = useState("8");
  const [bodyChanges, setBodyChanges] = useState("");
  const [emotionalNotes, setEmotionalNotes] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const rows = await getDiaryEntries(session, session?.mode || "demo");
      setEntries(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await saveDiaryEntry(session, session?.mode || "demo", {
        entryDate: new Date().toISOString().slice(0, 10),
        wellbeingScore: Number(wellbeingScore || 0),
        bodyChanges,
        emotionalNotes,
      });
      setMessage("Entrada guardada");
      setBodyChanges("");
      setEmotionalNotes("");
      await load();
    } catch (error) {
      setMessage(error.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const styles = createDiaryStyles(theme);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Diario</Text>
        <Text style={styles.subtitle}>Seguimiento corporal y emocional con contexto de ciclo.</Text>
      </View>

      <Card style={styles.formCard}>
        <SectionLabel>Nueva entrada</SectionLabel>
        <AppTextInput
          placeholder="Bienestar general del 1 al 10"
          keyboardType="number-pad"
          value={wellbeingScore}
          onChangeText={setWellbeingScore}
        />
        <AppTextInput
          placeholder="Cambios corporales"
          multiline
          style={styles.textArea}
          value={bodyChanges}
          onChangeText={setBodyChanges}
        />
        <AppTextInput
          placeholder="Notas emocionales"
          multiline
          style={styles.textArea}
          value={emotionalNotes}
          onChangeText={setEmotionalNotes}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <PrimaryButton title="Guardar entrada" onPress={save} loading={saving} disabled={!wellbeingScore} />
      </Card>

      <SectionLabel>Entradas recientes</SectionLabel>
      {loading ? (
        <ActivityIndicator color={theme.colors.pinkAccent} />
      ) : entries.length === 0 ? (
        <EmptyState title="Todavia no hay entradas" description="Cuando registres tu primer dia aparecera aqui con el contexto del ciclo virtual." />
      ) : (
        entries.map((entry) => (
          <Card key={entry.id || entry.entryDate} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryDate}>{formatShortDate(entry.entryDate || entry.entry_date)}</Text>
              <Text style={styles.entryMeta}>
                {entry.virtualCycleDay ? `Dia ${entry.virtualCycleDay}` : entry.phase || ""}
              </Text>
            </View>
            <Text style={styles.entryScore}>Bienestar {entry.wellbeingScore || entry.wellbeing_score}/10</Text>
            {entry.bodyChanges ? <Text style={styles.entryText}>{entry.bodyChanges}</Text> : null}
            {entry.emotionalNotes ? <Text style={styles.entryText}>{entry.emotionalNotes}</Text> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

function createDiaryStyles(theme) {
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
      gap: 12,
    },
    textArea: {
      minHeight: 110,
      textAlignVertical: "top",
      paddingTop: 14,
    },
    message: {
      color: theme.colors.pinkAccent,
      fontWeight: "600",
    },
    entryCard: {
      gap: 8,
    },
    entryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    entryDate: {
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    entryMeta: {
      color: theme.colors.textTertiary,
    },
    entryScore: {
      color: theme.colors.pinkAccent,
      fontWeight: "600",
    },
    entryText: {
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
  });
}
