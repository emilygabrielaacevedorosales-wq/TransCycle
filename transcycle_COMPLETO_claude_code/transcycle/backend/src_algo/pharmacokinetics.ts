/**
 * TransCycle & Health — Módulo de Farmacocinética
 * Bloque 1: Modelado de niveles plasmáticos hormonales
 *
 * Fármacos soportados:
 *   E2_SUBLINGUAL   — Estradiol sublingual
 *   E2_VALERATE_IM  — Valerato de estradiol IM
 *   E2_CYPIONATE_IM — Cipionato de estradiol IM
 *   E2_PATCH        — Estradiol parche transdérmico
 *   P4_RECTAL       — Progesterona micronizada rectal
 *   SPIRO           — Espironolactona (modelo de supresión androgénica)
 */

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type DrugKey =
  | "E2_SUBLINGUAL"
  | "E2_VALERATE_IM"
  | "E2_CYPIONATE_IM"
  | "E2_PATCH"
  | "P4_RECTAL"
  | "SPIRO";

export type PhaseLabel =
  | "follicular_early"
  | "follicular_late"
  | "ovulation_virtual"
  | "luteal_early"
  | "luteal_late"
  | "trough";

export interface DrugProfile {
  key: DrugKey;
  displayName: string;
  category: "estrogen" | "progestogen" | "antiandrogen";
  halfLifeHours: number;
  halfLifeSecondaryHours?: number; // metabolito activo (espironolactona → canrenoato)
  peakHours: number;               // tmax: tiempo al pico plasmático
  troughFraction: number;          // fracción de Cmax que se considera valle clínico
  cmaxPerMg?: number;              // concentración pico de referencia por mg de dosis
  cmaxUnit: "pg_per_mg" | "ng_per_mg" | "pg_per_patch";
  isSuppressionModel: boolean;
  suppressionTarget?: "testosterone";
  notes: string;
}

export interface DoseEvent {
  administeredAt: Date;
  doseAmountMg: number;
  drugKey: DrugKey;
}

export interface PlasmaPoint {
  calculatedAt: Date;
  hoursPostDose: number;
  levelValue: number;   // pg/mL (E2), ng/mL (P4), 0-1 (Spiro supresión)
  levelUnit: string;
  drugKey: DrugKey;
  phase: PhaseLabel | null;
  virtualCycleDay: number | null;
}

export interface CycleNormalization {
  cycleLengthDays: number;
  follicularDays: number;
  lutealDays: number;
}

// ─────────────────────────────────────────────
// Perfiles farmacocinéticos
// ─────────────────────────────────────────────

export const DRUG_PROFILES: Record<DrugKey, DrugProfile> = {
  E2_SUBLINGUAL: {
    key: "E2_SUBLINGUAL",
    displayName: "Estradiol sublingual",
    category: "estrogen",
    halfLifeHours: 3.0,
    peakHours: 0.75,       // 45 min promedio
    troughFraction: 0.05,
    cmaxPerMg: 350,        // pg/mL por mg
    cmaxUnit: "pg_per_mg",
    isSuppressionModel: false,
    notes:
      "Evita primer paso hepático. Pico agudo a los 30-60min. " +
      "Típicamente 1-2mg 2-3x/día. Ciclos de pico-valle muy marcados.",
  },

  E2_VALERATE_IM: {
    key: "E2_VALERATE_IM",
    displayName: "Valerato de estradiol IM",
    category: "estrogen",
    halfLifeHours: 96,     // ~4 días
    peakHours: 48,
    troughFraction: 0.10,
    cmaxPerMg: 80,
    cmaxUnit: "pg_per_mg",
    isSuppressionModel: false,
    notes: "Inyección semanal o quincenal. Pico a 24-72h, lenta eliminación.",
  },

  E2_CYPIONATE_IM: {
    key: "E2_CYPIONATE_IM",
    displayName: "Cipionato de estradiol IM",
    category: "estrogen",
    halfLifeHours: 168,    // ~7 días
    peakHours: 72,
    troughFraction: 0.10,
    cmaxPerMg: 90,
    cmaxUnit: "pg_per_mg",
    isSuppressionModel: false,
    notes:
      "Liberación más sostenida que valerato. " +
      "Niveles más estables con inyección semanal.",
  },

  E2_PATCH: {
    key: "E2_PATCH",
    displayName: "Estradiol parche transdérmico",
    category: "estrogen",
    halfLifeHours: 18,     // t½ efectiva en steady-state
    peakHours: 10,
    troughFraction: 0.30,
    cmaxUnit: "pg_per_patch",
    isSuppressionModel: false,
    notes:
      "Cmax varía por marca/dosis del parche (50-200 pg/mL). " +
      "Steady-state al 2do parche. Cambiar cada 3-4 días.",
  },

  P4_RECTAL: {
    key: "P4_RECTAL",
    displayName: "Progesterona micronizada (rectal)",
    category: "progestogen",
    halfLifeHours: 20,     // t½ efectiva 13-25h
    peakHours: 3.5,
    troughFraction: 0.15,
    cmaxPerMg: 0.08,       // ng/mL por mg (200mg → ~16 ng/mL)
    cmaxUnit: "ng_per_mg",
    isSuppressionModel: false,
    notes:
      "Vía rectal en mujeres trans: evita primer paso hepático " +
      "y el efecto sedante de la alopregnanolona oral. " +
      "Absorción sostenida similar a la vía vaginal. " +
      "Dosis habitual: 100-200mg/noche.",
  },

  SPIRO: {
    key: "SPIRO",
    displayName: "Espironolactona",
    category: "antiandrogen",
    halfLifeHours: 1.4,
    halfLifeSecondaryHours: 16,  // canrenoato (metabolito activo)
    peakHours: 2.5,
    troughFraction: 0.20,
    cmaxUnit: "ng_per_mg",
    isSuppressionModel: true,
    suppressionTarget: "testosterone",
    notes:
      "Bloqueador de receptor androgénico. " +
      "Modelar como supresión de T, no como hormona exógena. " +
      "El efecto clínico persiste por el canrenoato (t½ 16h). " +
      "Dosis típica: 50-200mg/día en 1-2 tomas.",
  },
};

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const LN2 = Math.LN2;
const CALCULATION_INTERVAL_HOURS = 2; // puntos cada 2h
const HOURS_TO_CALCULATE = 336;       // 14 días de proyección por dosis

// ─────────────────────────────────────────────
// Motor farmacocinético central
// ─────────────────────────────────────────────

/**
 * Calcula el nivel plasmático de un fármaco en un momento dado
 * después de una dosis única, usando modelo bicompartimental simplificado.
 *
 * Fase de absorción: ascenso lineal hacia Cmax
 * Fase de eliminación: decaimiento exponencial desde Cmax
 */
export function singleDoseLevel(
  doseAmountMg: number,
  hoursSinceDose: number,
  profile: DrugProfile
): number {
  if (hoursSinceDose < 0) return 0;

  // Parche: dosis expresada en unidades de parche, Cmax fijo por parche
  const cMax =
    profile.cmaxUnit === "pg_per_patch"
      ? 100 * doseAmountMg   // 100 pg/mL por parche (referencia conservadora)
      : (profile.cmaxPerMg ?? 1) * doseAmountMg;

  const ke = LN2 / profile.halfLifeHours;

  if (hoursSinceDose <= profile.peakHours) {
    // Absorción: rampa lineal hacia el pico
    return cMax * (hoursSinceDose / profile.peakHours);
  } else {
    // Eliminación: decaimiento exponencial desde el pico
    const hoursPostPeak = hoursSinceDose - profile.peakHours;
    return cMax * Math.exp(-ke * hoursPostPeak);
  }
}

/**
 * Espironolactona: modelo de supresión androgénica.
 * Devuelve un valor 0-1 representando la fracción de supresión de T,
 * usando el canrenoato (metabolito activo, t½ 16h) como driver principal.
 * 0 = sin supresión, 1 = supresión máxima.
 */
export function spiroSuppressionLevel(
  doseAmountMg: number,
  hoursSinceDose: number
): number {
  const profile = DRUG_PROFILES.SPIRO;
  const ke_active = LN2 / (profile.halfLifeSecondaryHours ?? 16);

  // La supresión satura a ~200mg/día; normalizar
  const maxSuppression = Math.min(doseAmountMg / 200, 1.0);

  if (hoursSinceDose <= profile.peakHours) {
    return maxSuppression * (hoursSinceDose / profile.peakHours);
  }
  const hoursPostPeak = hoursSinceDose - profile.peakHours;
  return maxSuppression * Math.exp(-ke_active * hoursPostPeak);
}

/**
 * Superposición lineal de múltiples dosis activas.
 * Principio de superposición: válido para cinética de primer orden.
 */
export function totalPlasmaLevel(
  activeDoses: DoseEvent[],
  atTime: Date,
  drugKey: DrugKey
): number {
  const profile = DRUG_PROFILES[drugKey];

  return activeDoses
    .filter((d) => d.drugKey === drugKey && d.administeredAt <= atTime)
    .reduce((sum, dose) => {
      const hoursSinceDose =
        (atTime.getTime() - dose.administeredAt.getTime()) / 3_600_000;

      if (hoursSinceDose > HOURS_TO_CALCULATE) return sum; // dosis ya eliminada

      const level =
        drugKey === "SPIRO"
          ? spiroSuppressionLevel(dose.doseAmountMg, hoursSinceDose)
          : singleDoseLevel(dose.doseAmountMg, hoursSinceDose, profile);

      return sum + level;
    }, 0);
}

// ─────────────────────────────────────────────
// Steady-state (estado estacionario)
// ─────────────────────────────────────────────

/**
 * Calcula el nivel valle en steady-state para un régimen de dosis fija.
 * Fórmula analítica exacta para cinética de primer orden.
 *
 * C_trough_ss = Cmax / (1 - e^(-ke * τ))  * e^(-ke * τ)
 */
export function steadyStateTrough(
  doseAmountMg: number,
  intervalHours: number,
  drugKey: DrugKey
): number {
  const profile = DRUG_PROFILES[drugKey];
  if (profile.isSuppressionModel) {
    // Para espiro: supresión en steady-state depende del canrenoato
    const ke = LN2 / (profile.halfLifeSecondaryHours ?? 16);
    const accumFactor = Math.exp(-ke * intervalHours) / (1 - Math.exp(-ke * intervalHours));
    return Math.min((profile.cmaxPerMg ?? 0.5) * doseAmountMg * accumFactor, 1.0);
  }

  const cMax =
    profile.cmaxUnit === "pg_per_patch"
      ? 100 * doseAmountMg
      : (profile.cmaxPerMg ?? 1) * doseAmountMg;

  const ke = LN2 / profile.halfLifeHours;
  const accumFactor = Math.exp(-ke * intervalHours) / (1 - Math.exp(-ke * intervalHours));
  return cMax * accumFactor;
}

/**
 * Número de dosis para alcanzar el 90% del steady-state.
 * Regla general: ~3.3 × t½ / intervalo de dosis.
 */
export function dosesToSteadyState(drugKey: DrugKey, intervalHours: number): number {
  const profile = DRUG_PROFILES[drugKey];
  const t12 = profile.isSuppressionModel
    ? (profile.halfLifeSecondaryHours ?? 16)
    : profile.halfLifeHours;
  return Math.ceil((3.3 * t12) / intervalHours);
}

// ─────────────────────────────────────────────
// Generación de curva completa
// ─────────────────────────────────────────────

/**
 * Genera una serie temporal de niveles plasmáticos para un conjunto
 * de dosis activas, calculando cada CALCULATION_INTERVAL_HOURS horas.
 */
export function generatePlasmaTimeSeries(
  doses: DoseEvent[],
  drugKey: DrugKey,
  fromTime: Date,
  toTime: Date,
  cycleParams?: CycleNormalization
): PlasmaPoint[] {
  const points: PlasmaPoint[] = [];
  const profile = DRUG_PROFILES[drugKey];
  const intervalMs = CALCULATION_INTERVAL_HOURS * 3_600_000;

  let current = new Date(fromTime);

  while (current <= toTime) {
    const level = totalPlasmaLevel(doses, current, drugKey);
    const phase = cycleParams
      ? resolveCyclePhase(current, doses, cycleParams, profile)
      : null;

    const lastDose = [...doses]
      .filter((d) => d.drugKey === drugKey && d.administeredAt <= current)
      .sort((a, b) => b.administeredAt.getTime() - a.administeredAt.getTime())[0];

    const hoursPostDose = lastDose
      ? (current.getTime() - lastDose.administeredAt.getTime()) / 3_600_000
      : 0;

    points.push({
      calculatedAt: new Date(current),
      hoursPostDose: Math.round(hoursPostDose * 10) / 10,
      levelValue: Math.round(level * 100) / 100,
      levelUnit: resolveUnit(drugKey),
      drugKey,
      phase: phase?.label ?? null,
      virtualCycleDay: phase?.day ?? null,
    });

    current = new Date(current.getTime() + intervalMs);
  }

  return points;
}

// ─────────────────────────────────────────────
// Mapeo al ciclo virtual de 28 días
// ─────────────────────────────────────────────

interface PhaseResult {
  label: PhaseLabel;
  day: number;
}

/**
 * Mapea un punto temporal al ciclo virtual normalizando
 * la curva plasmática en un calendario de 28 días.
 *
 * Lógica de asignación de fases:
 *   Días 1–13  → follicular_early / follicular_late
 *   Día 14     → ovulation_virtual (pico máximo E2)
 *   Días 15–26 → luteal_early / luteal_late
 *   Días 27–28 → trough (mínimo pre-siguiente dosis)
 */
export function resolveCyclePhase(
  atTime: Date,
  doses: DoseEvent[],
  cycleParams: CycleNormalization,
  profile: DrugProfile
): PhaseResult {
  // Obtener la primera dosis del ciclo actual como ancla
  const sortedDoses = [...doses]
    .filter((d) => d.drugKey === profile.key && d.administeredAt <= atTime)
    .sort((a, b) => a.administeredAt.getTime() - b.administeredAt.getTime());

  if (sortedDoses.length === 0) return { label: "trough", day: 1 };

  const cycleAnchor = sortedDoses[0].administeredAt;
  const cycleLengthMs = cycleParams.cycleLengthDays * 24 * 3_600_000;
  const elapsedMs = atTime.getTime() - cycleAnchor.getTime();
  const cyclePositionMs = elapsedMs % cycleLengthMs;
  const cycleDay = Math.floor(cyclePositionMs / (24 * 3_600_000)) + 1;

  const { follicularDays } = cycleParams;

  let label: PhaseLabel;
  if (cycleDay <= Math.floor(follicularDays / 2)) {
    label = "follicular_early";
  } else if (cycleDay < follicularDays) {
    label = "follicular_late";
  } else if (cycleDay === follicularDays) {
    label = "ovulation_virtual";
  } else if (cycleDay <= follicularDays + 6) {
    label = "luteal_early";
  } else if (cycleDay <= cycleParams.cycleLengthDays - 2) {
    label = "luteal_late";
  } else {
    label = "trough";
  }

  return { label, day: cycleDay };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function resolveUnit(drugKey: DrugKey): string {
  const profile = DRUG_PROFILES[drugKey];
  if (profile.isSuppressionModel) return "suppression_0_1";
  if (profile.category === "progestogen") return "ng_ml";
  return "pg_ml";
}

/**
 * Calcula si una dosis está próxima a su valle clínico.
 * Útil para enviar recordatorio de toma antes de que caiga demasiado.
 */
export function isApproachingTrough(
  hoursSinceLastDose: number,
  drugKey: DrugKey,
  intervalHours: number
): boolean {
  const warningWindowHours = 2;
  return hoursSinceLastDose >= intervalHours - warningWindowHours;
}

/**
 * Devuelve el nivel actual como porcentaje de Cmax del régimen.
 * Útil para el indicador visual del dashboard circular.
 */
export function levelAsPercentOfPeak(
  currentLevel: number,
  doseAmountMg: number,
  drugKey: DrugKey
): number {
  const profile = DRUG_PROFILES[drugKey];
  if (profile.isSuppressionModel) return Math.round(currentLevel * 100);
  const cMax =
    profile.cmaxUnit === "pg_per_patch"
      ? 100 * doseAmountMg
      : (profile.cmaxPerMg ?? 1) * doseAmountMg;
  if (cMax === 0) return 0;
  return Math.min(Math.round((currentLevel / cMax) * 100), 100);
}
