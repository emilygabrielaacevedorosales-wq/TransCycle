import React, { useState, useEffect } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppTextInput, Card, PrimaryButton, Screen } from "../components";
import { useTheme } from "../hooks/useTheme";
import { useApp } from "../context/AppContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveBiometricCredentials } from "../firebase/auth";

function createAuthStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    themeToggle: {
      position: "absolute",
      top: 12,
      right: 16,
      padding: 8,
      zIndex: 10,
    },
    themeToggleText: {
      fontSize: 24,
    },
    hero: {
      marginTop: 20,
      gap: 6,
    },
    brand: {
      fontSize: 36,
      fontWeight: "700",
      color: theme.colors.pinkAccent,
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 15,
    },
    card: {
      gap: 12,
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.colors.pinkAccent,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxActive: {
      backgroundColor: theme.colors.pinkAccent,
    },
    checkboxLabel: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    bioButton: {
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.pinkAccent,
      alignItems: "center",
      marginTop: 4,
    },
    bioButtonText: {
      color: theme.colors.pinkAccent,
      fontWeight: "600",
      fontSize: 14,
    },
    error: {
      color: theme.colors.trough,
      fontSize: 13,
    },
    switcher: {
      textAlign: "center",
      color: theme.colors.pinkAccent,
      fontWeight: "600",
      marginTop: 4,
    },
  });
}

export function AuthScreen({ onLogin, onRegister, loading }) {
  const theme = useTheme();
  const app = useApp();
  const styles = createAuthStyles(theme);
  const [registerMode, setRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const bioEnabled = await AsyncStorage.getItem("biometric_enabled");
        setBioAvailable(!!bioEnabled);
      } catch {
        setBioAvailable(false);
      }
    };
    checkBiometric();
  }, []);

  async function submit() {
    setError("");
    try {
      if (registerMode) {
        await onRegister({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          pronouns: pronouns.trim() || undefined,
        });
      } else {
        await onLogin(email.trim(), password, rememberMe);

        // Ofrecer guardar biometría después de login exitoso
        if (!bioAvailable) {
          Alert.alert(
            "🔒 Desbloqueo rápido",
            "¿Quieres usar huella digital o patrón para futuras sesiones?",
            [
              {
                text: "Ahora no",
                onPress: () => console.log("Biometría rechazada"),
                style: "cancel",
              },
              {
                text: "Sí, habilitar",
                onPress: async () => {
                  try {
                    await saveBiometricCredentials(email.trim(), password);
                    setBioAvailable(true);
                    Alert.alert("✓ Biometría habilitada", "Próximas veces podrás desbloquear rápidamente");
                  } catch (bioError) {
                    setError(bioError.message);
                  }
                },
              },
            ]
          );
        }
      }
    } catch (nextError) {
      setError(nextError.message || "No se pudo completar la autenticacion");
    }
  }

  async function handleBiometricLogin() {
    setError("");
    try {
      await app.loginWithBiometric();
    } catch (nextError) {
      setError("Biometría fallida. Intenta de nuevo.");
    }
  }

  const checkboxId = rememberMe ? "checkbox-active" : "checkbox-inactive";

  return (
    <View style={styles.container}>
      <Pressable style={styles.themeToggle} onPress={app.toggleTheme}>
        <Text style={styles.themeToggleText}>{app.colorScheme === "dark" ? "☀️" : "🌙"}</Text>
      </Pressable>

      <Screen>
        <View style={styles.hero}>
          <Text style={styles.brand}>TransCycle</Text>
          <Text style={styles.subtitle}>{registerMode ? "Crear cuenta" : "Iniciar sesion"}</Text>
        </View>

        <Card style={styles.card}>
          {registerMode ? (
            <>
              <AppTextInput placeholder="Nombre o apodo" value={displayName} onChangeText={setDisplayName} />
              <AppTextInput placeholder="Pronombres (opcional)" value={pronouns} onChangeText={setPronouns} />
            </>
          ) : null}
          <AppTextInput placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <AppTextInput placeholder="Contrasena" secureTextEntry value={password} onChangeText={setPassword} />

          {!registerMode && (
            <Pressable style={styles.checkboxRow} onPress={() => setRememberMe(!rememberMe)}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe && <Text style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Recordar contraseña</Text>
            </Pressable>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            title={registerMode ? "Registrarme" : "Entrar"}
            onPress={submit}
            loading={loading}
            disabled={!email.trim() || !password.trim() || (registerMode && !displayName.trim())}
          />

          {!registerMode && bioAvailable && (
            <Pressable style={styles.bioButton} onPress={handleBiometricLogin} disabled={loading}>
              <Text style={styles.bioButtonText}>🔒 Desbloquear con biometría</Text>
            </Pressable>
          )}

          <Pressable onPress={() => setRegisterMode((current) => !current)}>
            <Text style={styles.switcher}>
              {registerMode ? "Ya tienes cuenta? Inicia sesion" : "Primera vez? Crear cuenta"}
            </Text>
          </Pressable>
        </Card>
      </Screen>
    </View>
  );
}
