import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colorForPhase, theme } from "./theme";

export function CycleRing({ days, currentDay, phaseName }) {
  const size = 220;
  const radius = 88;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {days.map((day) => {
        const angle = ((day.day - 1) / days.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const backgroundColor = day.isGhostPeriod ? theme.colors.trough : colorForPhase(day.phase);
        const opacity = day.day === currentDay ? 1 : day.day < currentDay ? 0.85 : 0.25;

        return (
          <View
            key={day.day}
            style={[
              styles.segment,
              {
                backgroundColor,
                opacity,
                transform: [{ translateX: x }, { translateY: y }, { rotate: `${angle + Math.PI / 2}rad` }],
              },
            ]}
          />
        );
      })}
      <View style={styles.center}>
        <Text style={styles.dayLabel}>Dia {currentDay}</Text>
        <Text style={styles.phaseLabel}>{phaseName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  segment: {
    position: "absolute",
    width: 18,
    height: 40,
    borderRadius: 8,
  },
  center: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
  },
  dayLabel: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "600",
  },
  phaseLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
});
