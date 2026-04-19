import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getDrugs, getMedications, addMedication, getAdministrationLog, logAdministration } from "../api/client";
import { Card, PrimaryButton, Screen, SectionLabel, EmptyState, Pill, AppTextInput } from "../components";
import { theme } from "../theme";
import { scheduleMedicationNotifications, cancelMedicationNotifications, formatNextDose, getOptimalTimes } from "../notifications/scheduler";
import { useApp } from "../context/AppContext";

export function HrtScreen({ session }) {
  const { activeTab } = useApp();
  const [loadError, setLoadError] = useState(null);

  const [drugs, setDrugs] = useState([]);
  const [medications, setMedications] = useState([]);
  const [adminLog, setAdminLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [takingDose, setTakingDose] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  // Form state
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [doseAmount, setDoseAmount] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [frequencyHours, setFrequencyHours] = useState("12");
  const [preferredTimes, setPreferredTimes] = useState(["08:00", "20:00"]);
  const [stockUnits, setStockUnits] = useState("30");

  async function load() {
    setLoading(true);
    setMessage("");
    setLoadError(null);
    try {
      console.log("HrtScreen: Iniciando carga de datos");
      const drugsData = await getDrugs(session, session?.mode || "demo");
      console.log("HrtScreen: Fármacos cargados:", drugsData?.length);

      const medsData = await getMedications(session, session?.mode || "demo");
      console.log("HrtScreen: Medicamentos cargados:", medsData?.length);

      const logData = await getAdministrationLog(session, session?.mode || "demo");
      console.log("HrtScreen: Historial cargado:", logData?.length);

      setDrugs(drugsData || []);
      setMedications(medsData || []);
      setAdminLog(logData || []);
    } catch (error) {
      console.error("Error en HrtScreen.load():", error);
      setLoadError(error.message);
      setMessage("Error cargando datos: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      if (activeTab === "hrt" && session) {
        load();
      }
    } catch (error) {
      console.error("Error en useEffect de HrtScreen:", error);
      setLoadError(error.message);
      setLoading(false);
    }
  }, [activeTab, session]);

  async function handleAddMedication() {
    if (!selectedDrug || !doseAmount || !frequencyHours) {
      setMessage("Completa todos los campos");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const payload = {
        drug_key: selectedDrug.drug_key,
        display_name: selectedDrug.display_name,
        category: selectedDrug.category,
        dose_amount: parseFloat(doseAmount),
        dose_unit: doseUnit,
        frequency_hours: parseInt(frequencyHours),
        preferred_times: preferredTimes,
        stock_units: parseInt(stockUnits) || 30,
        is_active: true,
      };

      await addMedication(session, session?.mode || "demo", payload);

      // Programar notificaciones
      await scheduleMedicationNotifications(payload);

      setMessage("✓ Medicamento agregado");
      setShowForm(false);
      resetForm();
      await load();
    } catch (error) {
      setMessage("Error: " + error.message);
      console.warn("Error en handleAddMedication:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleTakeDose(medication) {
    setTakingDose(medication.id || medication.drug_key);
    try {
      const payload = {
        medication_id: medication.id,
        drug_key: medication.drug_key,
        dose_amount: medication.dose_amount,
        dose_unit: medication.dose_unit,
        administered_at: new Date(),
        body_site: null,
        notes: null,
        was_late: false,
      };

      await logAdministration(session, session?.mode || "demo", payload);
      setMessage("✓ Dosis registrada");

      // Reprogramar notificaciones
      await scheduleMedicationNotifications(medication);

      await load();
    } catch (error) {
      setMessage("Error: " + error.message);
      console.warn("Error en handleTakeDose:", error);
    } finally {
      setTakingDose(null);
    }
  }

  async function handleRemoveMedication(medication) {
    try {
      await cancelMedicationNotifications(medication.id);
      setMessage("✓ Medicamento desactivado");
      await load();
    } catch (error) {
      setMessage("Error: " + error.message);
      console.warn("Error en handleRemoveMedication:", error);
    }
  }

  function resetForm() {
    setSelectedDrug(null);
    setDoseAmount("");
    setDoseUnit("mg");
    setFrequencyHours("12");
    setPreferredTimes(["08:00", "20:00"]);
    setStockUnits("30");
  }

  function handleFrequencyChange(value) {
    setFrequencyHours(value);
    const optimal = getOptimalTimes(parseInt(value) || 12);
    setPreferredTimes(optimal);
  }

  const mode = session?.mode || "demo";
  const today = new Date().toDateString();
  const todayTakes = adminLog.filter((log) => {
    const logDate = new Date(log.administered_at?.toDate?.() || log.administered_at).toDateString();
    return logDate === today;
  });

  if (loading && medications.length === 0) {
    return (
      <Screen>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.pinkAccent} />
          <Text style={styles.loadingText}>Cargando medicamentos...</Text>
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <Card style={[styles.messageCard, styles.errorCard]}>
          <Text style={styles.messageText}>Error: {loadError}</Text>
        </Card>
        <PrimaryButton title="Reintentar" onPress={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Mis medicamentos</Text>
        <Text style={styles.subtitle}>
          {mode === "demo" ? "Modo demo" : `Tienes ${medications.length} medicamento${medications.length !== 1 ? "s" : ""}`}
        </Text>
      </View>

      {message && (
        <Card style={[styles.messageCard, message.includes("✓") ? styles.successCard : styles.errorCard]}>
          <Text style={styles.messageText}>{message}</Text>
        </Card>
      )}

      {medications.length === 0 ? (
        <EmptyState
          title="Sin medicamentos aún"
          description="Agrega los medicamentos que te recetó tu doctora para comenzar a rastrear tu TRH."
        />
      ) : (
        <View>
          <SectionLabel>Medicamentos activos</SectionLabel>
          {medications.map((med) => (
            <Card key={med.id || med.drug_key} style={styles.medCard}>
              <View style={styles.medHeader}>
                <View style={styles.medInfo}>
                  <Text style={styles.medName}>{med.display_name}</Text>
                  <Pill tone={med.category === "antiandrogen" ? "accent" : "default"}>
                    {med.category === "estrogen" && "Estrógeno"}
                    {med.category === "progesterone" && "Progesterona"}
                    {med.category === "antiandrogen" && "Bloq. Androgénico"}
                  </Pill>
                </View>
                <Pressable onPress={() => handleRemoveMedication(med)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </Pressable>
              </View>

              <Text style={styles.dosage}>
                {med.dose_amount} {med.dose_unit} · cada {med.frequency_hours}h
              </Text>
              <Text style={styles.nextDose}>{formatNextDose(med.frequency_hours, med.preferred_times)}</Text>

              <PrimaryButton
                title="Tomar ahora"
                onPress={() => handleTakeDose(med)}
                disabled={takingDose === (med.id || med.drug_key)}
                loading={takingDose === (med.id || med.drug_key)}
              />
            </Card>
          ))}
        </View>
      )}

      <View style={styles.spacer} />

      <SectionLabel>Historial de hoy</SectionLabel>
      {todayTakes.length === 0 ? (
        <Text style={styles.noTakes}>No hay registros hoy</Text>
      ) : (
        todayTakes.map((take, idx) => (
          <Card key={idx} style={styles.takeCard}>
            <Text style={styles.takeTime}>
              {new Date(take.administered_at?.toDate?.() || take.administered_at).toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Text style={styles.takeMed}>{take.drug_key}</Text>
            <Text style={styles.takeDose}>
              {take.dose_amount} {take.dose_unit}
            </Text>
          </Card>
        ))
      )}

      <View style={styles.spacer} />

      {!showForm ? (
        <PrimaryButton title="+ Agregar medicamento" onPress={() => setShowForm(true)} />
      ) : (
        <Card style={styles.formCard}>
          <SectionLabel>Nuevo medicamento</SectionLabel>

          <Text style={styles.fieldLabel}>Selecciona medicamento</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.drugSelector}>
            {drugs.map((drug) => (
              <Pressable
                key={drug.id || drug.drug_key}
                style={[
                  styles.drugPill,
                  selectedDrug?.drug_key === drug.drug_key && styles.drugPillSelected,
                ]}
                onPress={() => setSelectedDrug(drug)}
              >
                <Text
                  style={[
                    styles.drugPillText,
                    selectedDrug?.drug_key === drug.drug_key && styles.drugPillTextSelected,
                  ]}
                >
                  {drug.display_name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Dosis</Text>
          <View style={styles.doseRow}>
            <AppTextInput
              style={styles.doseInput}
              placeholder="2"
              value={doseAmount}
              onChangeText={setDoseAmount}
              keyboardType="decimal-pad"
            />
            <View style={styles.unitSelector}>
              {["mg", "mcg", "ml"].map((unit) => (
                <Pressable
                  key={unit}
                  style={[styles.unitBtn, doseUnit === unit && styles.unitBtnActive]}
                  onPress={() => setDoseUnit(unit)}
                >
                  <Text style={[styles.unitBtnText, doseUnit === unit && styles.unitBtnTextActive]}>
                    {unit}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text style={styles.fieldLabel}>Cada cuántas horas</Text>
          <View style={styles.frequencyRow}>
            {[8, 12, 24].map((freq) => (
              <Pressable
                key={freq}
                style={[styles.freqBtn, parseInt(frequencyHours) === freq && styles.freqBtnActive]}
                onPress={() => handleFrequencyChange(String(freq))}
              >
                <Text
                  style={[styles.freqBtnText, parseInt(frequencyHours) === freq && styles.freqBtnTextActive]}
                >
                  {freq}h
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Stock inicial</Text>
          <AppTextInput
            placeholder="30"
            value={stockUnits}
            onChangeText={setStockUnits}
            keyboardType="number-pad"
          />

          <View style={styles.formButtons}>
            <PrimaryButton
              title="Guardar"
              onPress={handleAddMedication}
              disabled={!selectedDrug || !doseAmount}
              loading={saving}
            />
            <Pressable style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
          </View>
        </Card>
      )}

      <View style={styles.spacer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingText: { color: theme.colors.textSecondary, fontSize: 14 },
  header: { marginBottom: 8, gap: 4 },
  title: { fontSize: 30, fontWeight: "700", color: theme.colors.textPrimary },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14 },
  messageCard: { padding: 12, borderRadius: 12, marginBottom: 12 },
  successCard: { backgroundColor: "#E8F5E9", borderColor: "#4CAF50" },
  errorCard: { backgroundColor: "#FFEBEE", borderColor: "#F44336" },
  messageText: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: "600" },
  medCard: { marginBottom: 12 },
  medHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  medInfo: { flex: 1 },
  medName: { fontSize: 16, fontWeight: "700", color: theme.colors.textPrimary, marginBottom: 6 },
  dosage: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 },
  nextDose: { fontSize: 12, color: theme.colors.pinkAccent, fontWeight: "600", marginBottom: 10 },
  removeBtn: { fontSize: 20, color: theme.colors.textTertiary, fontWeight: "600" },
  noTakes: { fontSize: 13, color: theme.colors.textTertiary, fontStyle: "italic", marginBottom: 12 },
  takeCard: { marginBottom: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  takeTime: { fontSize: 13, fontWeight: "700", color: theme.colors.pinkAccent },
  takeMed: { fontSize: 12, color: theme.colors.textSecondary },
  takeDose: { fontSize: 12, color: theme.colors.textTertiary },
  formCard: { padding: 16, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.textSecondary, marginTop: 12, marginBottom: 8, textTransform: "uppercase" },
  drugSelector: { marginBottom: 12, marginHorizontal: -16, paddingHorizontal: 16 },
  drugPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.bg3, marginRight: 8 },
  drugPillSelected: { backgroundColor: theme.colors.pinkAccent },
  drugPillText: { fontSize: 12, color: theme.colors.textPrimary, fontWeight: "600" },
  drugPillTextSelected: { color: theme.colors.white },
  doseRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  doseInput: { flex: 1, height: 40 },
  unitSelector: { flexDirection: "row", gap: 4 },
  unitBtn: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: theme.colors.bg3, borderRadius: 8 },
  unitBtnActive: { backgroundColor: theme.colors.pinkAccent },
  unitBtnText: { fontSize: 11, fontWeight: "600", color: theme.colors.textPrimary },
  unitBtnTextActive: { color: theme.colors.white },
  frequencyRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  freqBtn: { flex: 1, paddingVertical: 8, backgroundColor: theme.colors.bg3, borderRadius: 8, alignItems: "center" },
  freqBtnActive: { backgroundColor: theme.colors.pinkAccent },
  freqBtnText: { fontSize: 12, fontWeight: "600", color: theme.colors.textPrimary },
  freqBtnTextActive: { color: theme.colors.white },
  formButtons: { flexDirection: "row", gap: 8, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.colors.bg2, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: theme.colors.textSecondary },
  spacer: { height: 20 },
});
