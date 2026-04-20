import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { getDashboardData } from "../api/client";
import { Card, ConfidenceBar, PhaseStripe, Pill, Screen, StatCard } from "../components";
import { CycleRing } from "../CycleRing";
import { colorForPhase } from "../theme";
import { useTheme } from "../hooks/useTheme";

const phaseNames = {
  follicular_early: "Folicular temprana",
  follicular_late: "Folicular tardia",
  ovulation_virtual: "Ovulacion virtual",
  luteal_early: "Lutea temprana",
  luteal_late: "Lutea tardia",
  trough: "Valle del ciclo",
};

const phaseDescriptions = {
  follicular_early: "E2 en ascenso. Energia moderada y estabilidad emocional.",
  follicular_late: "E2 en niveles altos. Suele sentirse una etapa de mayor vitalidad.",
  ovulation_virtual: "Pico maximo de E2. Puede aparecer una sensacion de mayor conexion corporal.",
  luteal_early: "P4 en ascenso. Posible sensibilidad mamaria y cambios de apetito.",
  luteal_late: "P4 alta. A veces se nota una respuesta emocional mas intensa.",
  trough: "Minimos hormonales previos a la siguiente fase o dosis clave.",
};

export function DashboardScreen({ session }) {
  const theme = useTheme();
  const [state, setState] = useState({ loading: true, error: "", status: null, ring: [] });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await getDashboardData(session, session?.mode || "demo");
      setState({ loading: false, error: "", status: data.status, ring: data.ring });
    } catch (error) {
      console.error("DashboardScreen error:", error);
      setState({ loading: false, error: error.message, status: null, ring: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 13 ? "Buenos dias" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  const dynamicStyles = createDynamicStyles(theme);

  if (state.loading) {
    return (
      <Screen>
        <ActivityIndicator color={theme.colors.pinkAccent} size="large" />
      </Screen>
    );
  }

  if (state.error || !state.status) {
    return (
      <Screen>
        <Card style={dynamicStyles.errorCard}>
          <Text style={dynamicStyles.errorTitle}>No se pudo cargar el dashboard</Text>
          <Text style={dynamicStyles.errorText}>{state.error || "Faltan datos del ciclo."}</Text>
          <Pressable onPress={load}>
            <Text style={dynamicStyles.retry}>Reintentar</Text>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  const { status, ring } = state;
  const phaseName = phaseNames[status.phase] || status.phase;

  return (
    <Screen>
      <View style={dynamicStyles.header}>
        <View>
          <Text style={dynamicStyles.greeting}>{greeting}</Text>
          <Text style={dynamicStyles.name}>{session.user.display_name || "TransCycle"}</Text>
        </View>
        <Pill tone={session.mode === "demo" ? "accent" : "default"}>{session.mode === "demo" ? "Modo demo" : "API conectada"}</Pill>
      </View>

      {typeof status.daysUntilGhostPeriod === "number" && status.daysUntilGhostPeriod <= 5 ? (
        <Card style={dynamicStyles.banner}>
          <Text style={dynamicStyles.bannerTitle}>Periodo fantasma {status.daysUntilGhostPeriod === 0 ? "hoy" : `en ${status.daysUntilGhostPeriod} dias`}</Text>
          <Text style={dynamicStyles.bannerText}>Se aproxima la fase de valle. Observa energia, sensibilidad y estado de animo.</Text>
        </Card>
      ) : null}

      <Card style={dynamicStyles.ringCard}>
        <CycleRing days={ring} currentDay={status.currentDay} phaseName={phaseName} />
      </Card>

      <PhaseStripe
        phase={status.phase}
        title={phaseName}
        description={phaseDescriptions[status.phase] || "Seguimiento del estado actual del ciclo virtual."}
      />

      <View style={dynamicStyles.statsRow}>
        <StatCard value={`${status.currentDay}/28`} label="Dia del ciclo" color={colorForPhase(status.phase)} />
        <StatCard value={typeof status.daysUntilGhostPeriod === "number" ? `${status.daysUntilGhostPeriod}d` : "-"} label="Hasta periodo" color={theme.colors.trough} />
        <StatCard value={status.e2Trend === "rising" ? "↑" : status.e2Trend === "falling" ? "↓" : "→"} label="Tendencia E2" color={theme.colors.pinkAccent} />
      </View>

      <Card>
        <ConfidenceBar score={status.confidenceScore || 0} />
      </Card>
    </Screen>
  );
}

function createDynamicStyles(theme) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    greeting: {
      color: theme.colors.textSecondary,
      fontSize: 15,
    },
    name: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      marginTop: 2,
    },
    banner: {
      backgroundColor: "#FDF0F0",
      gap: 6,
      borderLeftColor: "#E88C8C",
      borderLeftWidth: 4,
    },
    bannerTitle: {
      color: "#B35A5A",
      fontWeight: "700",
      fontSize: 15,
    },
    bannerText: {
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    ringCard: {
      alignItems: "center",
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
    },
    errorCard: {
      gap: 12,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    errorText: {
      color: theme.colors.textSecondary,
    },
    retry: {
      color: theme.colors.pinkAccent,
      fontWeight: "600",
    },
  });
}
