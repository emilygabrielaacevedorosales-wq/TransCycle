export const lightTheme = {
  colors: {
    follicularEarly: "#8BBFB8",
    follicularLate: "#B8AED4",
    ovulationVirtual: "#E8A4B0",
    lutealEarly: "#D4B87A",
    lutealLate: "#D4A96A",
    trough: "#E88C8C",
    bg: "#FAF8F5",
    bg2: "#F2EFE9",
    bg3: "#E7E0D5",
    textPrimary: "#1C1A17",
    textSecondary: "#6B6459",
    textTertiary: "#A09890",
    pinkAccent: "#C4728A",
    teal: "#8BBFB8",
    border: "rgba(0, 0, 0, 0.08)",
    white: "#FFFFFF",
  },
};

export const darkTheme = {
  colors: {
    follicularEarly: "#8BBFB8",
    follicularLate: "#B8AED4",
    ovulationVirtual: "#E8A4B0",
    lutealEarly: "#D4B87A",
    lutealLate: "#D4A96A",
    trough: "#E88C8C",
    bg: "#1A1815",
    bg2: "#2A251F",
    bg3: "#3A3530",
    textPrimary: "#F5F3F0",
    textSecondary: "#D4CBC0",
    textTertiary: "#A09890",
    pinkAccent: "#E8A4B0",
    teal: "#8BBFB8",
    border: "rgba(255, 255, 255, 0.08)",
    white: "#FFFFFF",
  },
};

export const theme = lightTheme;

export function getTheme(colorScheme) {
  return colorScheme === "dark" ? darkTheme : lightTheme;
}

export function colorForPhase(phase) {
  switch (phase) {
    case "follicular_early":
      return theme.colors.follicularEarly;
    case "follicular_late":
      return theme.colors.follicularLate;
    case "ovulation_virtual":
      return theme.colors.ovulationVirtual;
    case "luteal_early":
      return theme.colors.lutealEarly;
    case "luteal_late":
      return theme.colors.lutealLate;
    default:
      return theme.colors.trough;
  }
}
