import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getBloodTests } from "../api/client";
import { Card, EmptyState, Screen, SectionLabel } from "../components";
import { formatShortDate } from "../utils";
import { useTheme } from "../hooks/useTheme";

export function AnalyticsScreen({ session }) {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBloodTests(session, session?.mode || "demo")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const styles = createAnalyticsStyles(theme);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Analiticas</Text>
        <Text style={styles.subtitle}>Historial basico conectado a `GET /analytics/blood-tests`.</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.pinkAccent} />
      ) : rows.length === 0 ? (
        <EmptyState title="Sin analiticas todavia" description="Cuando registres examenes en la API se mostraran aqui." />
      ) : (
        rows.map((row) => (
          <Card key={row.id || row.test_date} style={styles.labCard}>
            <View style={styles.labHeader}>
              <Text style={styles.labDate}>{formatShortDate(row.test_date)}</Text>
              <Text style={styles.labName}>{row.lab_name || "Sin laboratorio"}</Text>
            </View>
            <SectionLabel>Valores</SectionLabel>
            <View style={styles.metrics}>
              <Metric label="E2" value={row.estradiol_pg_ml ? `${row.estradiol_pg_ml} pg/mL` : "-"} metricStyles={styles} />
              <Metric label="T" value={row.testosterone_ng_dl ? `${row.testosterone_ng_dl} ng/dL` : "-"} metricStyles={styles} />
              <Metric label="P4" value={row.progesterone_ng_ml ? `${row.progesterone_ng_ml} ng/mL` : "-"} metricStyles={styles} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

function Metric({ label, value, metricStyles }) {
  return (
    <View style={metricStyles.metric}>
      <Text style={metricStyles.metricLabel}>{label}</Text>
      <Text style={metricStyles.metricValue}>{value}</Text>
    </View>
  );
}

function createAnalyticsStyles(theme) {
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
    labCard: {
      gap: 12,
    },
    labHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    labDate: {
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    labName: {
      color: theme.colors.textTertiary,
    },
    metrics: {
      flexDirection: "row",
      gap: 10,
    },
    metric: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.sm,
      padding: 12,
    },
    metricLabel: {
      color: theme.colors.textTertiary,
      fontSize: 11,
      marginBottom: 4,
    },
    metricValue: {
      color: theme.colors.textPrimary,
      fontWeight: "600",
    },
  });
}
