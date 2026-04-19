import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppTextInput, Card, PrimaryButton, Screen } from "../components";
import { theme } from "../theme";

export function AuthScreen({ onLogin, onRegister, loading }) {
  const [registerMode, setRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [error, setError] = useState("");

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
        await onLogin(email.trim(), password);
      }
    } catch (nextError) {
      setError(nextError.message || "No se pudo completar la autenticacion");
    }
  }

  return (
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          title={registerMode ? "Registrarme" : "Entrar"}
          onPress={submit}
          loading={loading}
          disabled={!email.trim() || !password.trim() || (registerMode && !displayName.trim())}
        />
        <Pressable onPress={() => setRegisterMode((current) => !current)}>
          <Text style={styles.switcher}>
            {registerMode ? "Ya tienes cuenta? Inicia sesion" : "Primera vez? Crear cuenta"}
          </Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
