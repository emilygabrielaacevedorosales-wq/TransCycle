import { useApp } from "../context/AppContext";
import { getTheme } from "../theme";

export function useTheme() {
  const { colorScheme } = useApp();
  return getTheme(colorScheme);
}
