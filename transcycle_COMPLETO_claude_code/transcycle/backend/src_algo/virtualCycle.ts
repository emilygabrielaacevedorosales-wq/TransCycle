/**
 * TransCycle & Health — Módulo de Ciclo Virtual
 * Bloque 2: Algoritmo de Equivalencia Hormonal
 *
 * Este módulo toma la curva farmacocinética calculada en el Bloque 1
 * y la transforma en un calendario de 28 días con fases reconocibles,
 * correlaciona síntomas con posición hormonal, y detecta el
 * "período fantasma" (ventana de máxima sensibilidad sintomática).
 *
 * Arquitectura del algoritmo:
 *   1. NormalizeCurve     → Mapea niveles E2/P4 a un ciclo de 28 días
 *   2. AssignPhases       → Etiqueta cada día con su fase virtual
 *   3. CorrelateSymptoms  → Pearson entre síntomas y posición en curva
 *   4. DetectGhostPeriod  → Identifica ventana de mayor sensibilidad
 *   5. RefineCycle        → Actualiza el modelo con datos reales acumulados
 */

import {
  type PlasmaPoint,
  type DrugKey,
  type PhaseLabel,
  DRUG_PROFILES,
} from "./pharmacokinetics";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface SymptomEntry {
  loggedAt: Date;
  moodScore: number;           // 1-10
  breastTenderness: number;    // 1-10
  fatigueLevel: number;        // 1-10
  digestiveChanges: number;    // 1-10
  libidoScore: number;         // 1-10
  skinChanges: number;         // 1-10
  brainFog: number;            // 1-10
  emotionalLability: number;   // 1-10
}

export interface CycleDay {
  day: number;                 // 1-28
  phase: PhaseLabel;
  avgE2Level: number;          // pg/mL promedio del día
  avgP4Level: number;          // ng/mL promedio del día
  e2Trend: "rising" | "falling" | "stable";
  p4Trend: "rising" | "falling" | "stable";
  compositeScore: number;      // 0-100: intensidad hormonal combinada normalizada
  symptoms?: DaySymptomSummary;
}

export interface DaySymptomSummary {
  avgMood: number;
  avgBreastTenderness: number;
  avgFatigue: number;
  avgDigestive: number;
  avgLibido: number;
  avgSkinChanges: number;
  avgBrainFog: number;
  avgEmotionalLability: number;
  overallIntensity: number;    // promedio de todos los síntomas
  sampleCount: number;
}

export interface PhaseWindow {
  startDay: number;
  endDay: number;
  label: PhaseLabel;
  description: string;
  dominantHormone: "estradiol" | "progesterone" | "trough";
}

export interface GhostPeriod {
  startDay: number;
  endDay: number;
  peakDay: number;
  confidence: number;          // 0-1
  dominantSymptoms: string[];
  triggerType: "e2_trough" | "p4_peak" | "both" | "symptom_cluster";
  description: string;
}

export interface SymptomCorrelation {
  symptomKey: string;
  correlationWithE2: number;   // Pearson -1 a 1
  correlationWithP4: number;
  peakCycleDay: number;        // día del ciclo donde ese síntoma es máximo
  troughCycleDay: number;      // día donde es mínimo
  significance: "high" | "moderate" | "low" | "none";
}

export interface VirtualCycleProfile {
  userId: string;
  cycleNumber: number;
  cycleLengthDays: number;
  follicularDays: number;
  lutealDays: number;
  days: CycleDay[];
  phases: PhaseWindow[];
  ghostPeriod: GhostPeriod | null;
  symptomCorrelations: SymptomCorrelation[];
  confidenceScore: number;     // 0-1, sube con más datos
  dataPointsUsed: number;
  lastUpdated: Date;
  insights: string[];          // observaciones en lenguaje natural
}

export interface NormalizationInput {
  plasmaPoints: PlasmaPoint[];
  symptomEntries: SymptomEntry[];
  cycleAnchorDate: Date;       // fecha del inicio del ciclo (primera dosis del ciclo)
  cycleLengthDays?: number;    // default 28
  drugRegimen: DrugKey[];      // fármacos activos
}

// ─────────────────────────────────────────────
// Constantes de fases
// ─────────────────────────────────────────────

export const PHASE_DEFINITIONS: PhaseWindow[] = [
  {
    startDay: 1,
    endDay: 7,
    label: "follicular_early",
    description: "Inicio de ciclo — E2 en ascenso desde el valle",
    dominantHormone: "estradiol",
  },
  {
    startDay: 8,
    endDay: 13,
    label: "follicular_late",
    description: "E2 en niveles altos — mayor energía y bienestar",
    dominantHormone: "estradiol",
  },
  {
    startDay: 14,
    endDay: 14,
    label: "ovulation_virtual",
    description: "Pico máximo de E2 del ciclo",
    dominantHormone: "estradiol",
  },
  {
    startDay: 15,
    endDay: 20,
    label: "luteal_early",
    description: "P4 en ascenso — E2 comienza a descender",
    dominantHormone: "progesterone",
  },
  {
    startDay: 21,
    endDay: 26,
    label: "luteal_late",
    description: "P4 alta — mayor sensibilidad sintomática",
    dominantHormone: "progesterone",
  },
  {
    startDay: 27,
    endDay: 28,
    label: "trough",
    description: "Valle pre-ciclo — mínimos hormonales",
    dominantHormone: "trough",
  },
];

const SYMPTOM_KEYS = [
  "moodScore",
  "breastTenderness",
  "fatigueLevel",
  "digestiveChanges",
  "libidoScore",
  "skinChanges",
  "brainFog",
  "emotionalLability",
] as const;

type SymptomKey = typeof SYMPTOM_KEYS[number];

// ─────────────────────────────────────────────
// 1. Normalización de curva a 28 días
// ─────────────────────────────────────────────

/**
 * Agrupa los puntos plasmáticos por día del ciclo (1-28).
 * Si el ciclo tiene más de 28 días, comprime proporcionalmente.
 */
function groupPointsByDay(
  plasmaPoints: PlasmaPoint[],
  anchorDate: Date,
  cycleLengthDays: number
): Map<number, PlasmaPoint[]> {
  const byDay = new Map<number, PlasmaPoint[]>();
  for (let d = 1; d <= cycleLengthDays; d++) byDay.set(d, []);

  for (const pt of plasmaPoints) {
    const msFromAnchor = pt.calculatedAt.getTime() - anchorDate.getTime();
    if (msFromAnchor < 0) continue;

    const dayFloat = msFromAnchor / (24 * 3_600_000);
    // Normalizar al rango 1-28 si el ciclo real ≠ 28 días
    const normalizedDay = Math.ceil(
      (dayFloat / cycleLengthDays) * 28
    );
    const day = Math.min(Math.max(normalizedDay, 1), cycleLengthDays);

    byDay.get(day)!.push(pt);
  }

  return byDay;
}

/**
 * Calcula la tendencia de un valor entre tres días consecutivos.
 */
function calcTrend(prev: number, curr: number, next: number): "rising" | "falling" | "stable" {
  const delta = (next - prev) / 2;
  if (delta > curr * 0.05) return "rising";
  if (delta < -curr * 0.05) return "falling";
  return "stable";
}

/**
 * Normaliza un array de valores al rango 0-100.
 */
function normalize0to100(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => Math.round(((v - min) / (max - min)) * 100));
}

// ─────────────────────────────────────────────
// 2. Asignación de fases virtuales
// ─────────────────────────────────────────────

/**
 * Asigna la fase del ciclo a un día dado.
 * La asignación puede ser estática (por posición) o dinámica
 * (por forma de la curva si hay suficientes datos).
 */
export function assignPhaseToDay(
  day: number,
  e2Trend: string,
  p4Level: number,
  e2Level: number,
  avgE2: number,
  avgP4: number
): PhaseLabel {
  // Fase lútea: P4 por encima del promedio y E2 descendente
  if (p4Level > avgP4 * 1.2 && e2Trend === "falling" && day > 14) {
    return day > 21 ? "luteal_late" : "luteal_early";
  }

  // Trough: ambas hormonas en mínimos
  if (e2Level < avgE2 * 0.4 && p4Level < avgP4 * 0.4) {
    return "trough";
  }

  // Pico virtual: E2 en máximo
  if (e2Level > avgE2 * 1.4 && e2Trend === "stable") {
    return "ovulation_virtual";
  }

  // Folicular: E2 dominante
  if (day <= 7) return "follicular_early";
  if (day <= 13) return "follicular_late";
  if (day === 14) return "ovulation_virtual";
  if (day <= 20) return "luteal_early";
  if (day <= 26) return "luteal_late";
  return "trough";
}

// ─────────────────────────────────────────────
// 3. Correlación de síntomas (Pearson)
// ─────────────────────────────────────────────

/**
 * Calcula el coeficiente de correlación de Pearson entre dos arrays.
 * Devuelve NaN si no hay varianza suficiente.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return NaN;

  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let num = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return NaN;
  return Math.round((num / denom) * 1000) / 1000;
}

/**
 * Interpreta la magnitud de una correlación de Pearson.
 */
function significanceFromR(r: number): "high" | "moderate" | "low" | "none" {
  const abs = Math.abs(r);
  if (isNaN(abs)) return "none";
  if (abs >= 0.6) return "high";
  if (abs >= 0.35) return "moderate";
  if (abs >= 0.15) return "low";
  return "none";
}

/**
 * Para cada síntoma, calcula su correlación con E2 y P4 día a día,
 * e identifica en qué día del ciclo ese síntoma es máximo/mínimo.
 */
export function correlateSymptoms(
  days: CycleDay[]
): SymptomCorrelation[] {
  const daysWithSymptoms = days.filter((d) => d.symptoms !== undefined);
  if (daysWithSymptoms.length < 4) return [];

  const e2Series = daysWithSymptoms.map((d) => d.avgE2Level);
  const p4Series = daysWithSymptoms.map((d) => d.avgP4Level);

  const symptomDisplayNames: Record<string, string> = {
    moodScore: "estado de ánimo",
    breastTenderness: "sensibilidad mamaria",
    fatigueLevel: "fatiga",
    digestiveChanges: "cambios digestivos",
    libidoScore: "libido",
    skinChanges: "cambios en piel",
    brainFog: "niebla mental",
    emotionalLability: "labilidad emocional",
  };

  return SYMPTOM_KEYS.map((key) => {
    const symptomSeries = daysWithSymptoms.map(
      (d) => d.symptoms![key.replace("Score","").replace("Level","").replace("Changes","") as keyof DaySymptomSummary] as number ?? 5
    );

    // Reconstruir serie con nombres correctos del DaySymptomSummary
    const summaryKeyMap: Record<SymptomKey, keyof DaySymptomSummary> = {
      moodScore:        "avgMood",
      breastTenderness: "avgBreastTenderness",
      fatigueLevel:     "avgFatigue",
      digestiveChanges: "avgDigestive",
      libidoScore:      "avgLibido",
      skinChanges:      "avgSkinChanges",
      brainFog:         "avgBrainFog",
      emotionalLability:"avgEmotionalLability",
    };

    const mappedSeries = daysWithSymptoms.map(
      (d) => (d.symptoms![summaryKeyMap[key]] as number) ?? 5
    );

    const corrE2 = pearsonCorrelation(e2Series, mappedSeries);
    const corrP4 = pearsonCorrelation(p4Series, mappedSeries);

    // Día de pico y valle
    let peakVal = -Infinity, troughVal = Infinity;
    let peakDay = 1, troughDay = 1;
    daysWithSymptoms.forEach((d) => {
      const v = (d.symptoms![summaryKeyMap[key]] as number) ?? 5;
      if (v > peakVal) { peakVal = v; peakDay = d.day; }
      if (v < troughVal) { troughVal = v; troughDay = d.day; }
    });

    return {
      symptomKey: symptomDisplayNames[key] ?? key,
      correlationWithE2: isNaN(corrE2) ? 0 : corrE2,
      correlationWithP4: isNaN(corrP4) ? 0 : corrP4,
      peakCycleDay: peakDay,
      troughCycleDay: troughDay,
      significance: significanceFromR(Math.max(Math.abs(corrE2), Math.abs(corrP4))),
    };
  });
}

// ─────────────────────────────────────────────
// 4. Detección del período fantasma
// ─────────────────────────────────────────────

/**
 * Detecta la ventana del "período fantasma": el clúster de días
 * donde la usuaria experimenta mayor sensibilidad sintomática,
 * correlacionado con el valle de E2 y/o el pico de P4.
 *
 * Estrategia de detección (en orden de prioridad):
 *   1. Valle de E2 coincidente con clúster sintomático elevado
 *   2. Pico de P4 coincidente con clúster sintomático
 *   3. Ambos simultáneos (señal más fuerte)
 *   4. Clúster sintomático puro (sin datos hormonales suficientes)
 */
export function detectGhostPeriod(
  days: CycleDay[],
  correlations: SymptomCorrelation[]
): GhostPeriod | null {
  const daysWithSymptoms = days.filter((d) => d.symptoms !== undefined);
  if (daysWithSymptoms.length < 7) return null;

  // Calcular intensidad sintomática por día (ventana deslizante de 3 días)
  const symptomIntensity = days.map((d) => {
    if (!d.symptoms) return 0;
    return d.symptoms.overallIntensity;
  });

  // Suavizar con media móvil de 3 días
  const smoothed = symptomIntensity.map((_, i) => {
    const window = symptomIntensity.slice(
      Math.max(0, i - 1),
      Math.min(days.length, i + 2)
    );
    return window.reduce((s, v) => s + v, 0) / window.length;
  });

  // Encontrar el pico de intensidad sintomática
  let maxIntensity = -Infinity;
  let peakIdx = 0;
  smoothed.forEach((v, i) => {
    if (v > maxIntensity) { maxIntensity = v; peakIdx = i; }
  });

  const peakDay = days[peakIdx]?.day ?? 27;

  // Definir ventana del período fantasma (±2 días del pico)
  const startDay = Math.max(1, peakDay - 2);
  const endDay = Math.min(28, peakDay + 2);

  // Evaluar tipo de trigger
  const peakDayData = days[peakIdx];
  const avgE2 = days.reduce((s, d) => s + d.avgE2Level, 0) / days.length;
  const avgP4 = days.reduce((s, d) => s + d.avgP4Level, 0) / days.length;

  const isE2Low = peakDayData?.avgE2Level < avgE2 * 0.6;
  const isP4High = peakDayData?.avgP4Level > avgP4 * 1.3;

  let triggerType: GhostPeriod["triggerType"];
  if (isE2Low && isP4High) triggerType = "both";
  else if (isE2Low) triggerType = "e2_trough";
  else if (isP4High) triggerType = "p4_peak";
  else triggerType = "symptom_cluster";

  // Síntomas dominantes en este período
  const dominantSymptoms = correlations
    .filter((c) => c.significance === "high" || c.significance === "moderate")
    .filter((c) => c.peakCycleDay >= startDay && c.peakCycleDay <= endDay)
    .map((c) => c.symptomKey)
    .slice(0, 4);

  // Confianza: más datos = más confianza
  const dataRatio = daysWithSymptoms.length / 28;
  const intensityRatio = maxIntensity / 10;
  const confidence = Math.min(Math.round(dataRatio * intensityRatio * 10 * 10) / 10, 1.0);

  // Descripción en lenguaje natural
  const triggerDescriptions: Record<string, string> = {
    both: "Valle de E2 y pico de P4 simultáneos — señal hormonal fuerte",
    e2_trough: "Valle de estradiol — descenso previo a la siguiente dosis",
    p4_peak: "Pico de progesterona — fase de mayor sensibilidad lútea",
    symptom_cluster: "Clúster sintomático identificado por patrón de registro",
  };

  return {
    startDay,
    endDay,
    peakDay,
    confidence,
    dominantSymptoms,
    triggerType,
    description: triggerDescriptions[triggerType],
  };
}

// ─────────────────────────────────────────────
// 5. Generación de insights en lenguaje natural
// ─────────────────────────────────────────────

function generateInsights(
  days: CycleDay[],
  ghostPeriod: GhostPeriod | null,
  correlations: SymptomCorrelation[],
  confidenceScore: number
): string[] {
  const insights: string[] = [];

  if (confidenceScore < 0.3) {
    insights.push(
      "Aún hay pocos datos registrados. Con más semanas de seguimiento, el ciclo virtual se volverá más preciso."
    );
  }

  if (ghostPeriod) {
    insights.push(
      `Tu período de mayor sensibilidad ocurre alrededor del día ${ghostPeriod.peakDay} del ciclo ` +
      `(días ${ghostPeriod.startDay}–${ghostPeriod.endDay}). ` +
      ghostPeriod.description + "."
    );
  }

  const highCorr = correlations.filter((c) => c.significance === "high");
  if (highCorr.length > 0) {
    const names = highCorr.map((c) => c.symptomKey).join(", ");
    insights.push(`Los síntomas con mayor correlación hormonal son: ${names}.`);
  }

  // Día de mejor bienestar (máximo ánimo + mínima fatiga)
  const bestDay = days
    .filter((d) => d.symptoms)
    .sort(
      (a, b) =>
        (b.symptoms!.avgMood - b.symptoms!.avgFatigue) -
        (a.symptoms!.avgMood - a.symptoms!.avgFatigue)
    )[0];
  if (bestDay) {
    insights.push(
      `Tu día de mayor bienestar tiende a ser alrededor del día ${bestDay.day} ` +
      `(fase ${bestDay.phase.replace("_", " ")}).`
    );
  }

  // Correlación E2 y ánimo
  const moodCorr = correlations.find((c) => c.symptomKey === "estado de ánimo");
  if (moodCorr && moodCorr.correlationWithE2 > 0.4) {
    insights.push(
      "Tu estado de ánimo tiene una correlación positiva fuerte con los niveles de estradiol. " +
      "Los días de valle pueden sentirse emocionalmente más difíciles."
    );
  }

  return insights;
}

// ─────────────────────────────────────────────
// 6. Constructor principal del ciclo virtual
// ─────────────────────────────────────────────

/**
 * Función principal. Toma los datos crudos y produce el perfil
 * completo del ciclo virtual de la usuaria.
 */
export function buildVirtualCycle(
  input: NormalizationInput,
  userId: string,
  cycleNumber: number = 1
): VirtualCycleProfile {
  const cycleLengthDays = input.cycleLengthDays ?? 28;

  // ── Separar puntos por hormona ──
  const e2Points = input.plasmaPoints.filter(
    (p) =>
      p.drugKey === "E2_SUBLINGUAL" ||
      p.drugKey === "E2_VALERATE_IM" ||
      p.drugKey === "E2_CYPIONATE_IM" ||
      p.drugKey === "E2_PATCH"
  );
  const p4Points = input.plasmaPoints.filter(
    (p) => p.drugKey === "P4_RECTAL"
  );

  // ── Agrupar por día ──
  const e2ByDay = groupPointsByDay(e2Points, input.cycleAnchorDate, cycleLengthDays);
  const p4ByDay = groupPointsByDay(p4Points, input.cycleAnchorDate, cycleLengthDays);

  // ── Promedios por día ──
  const avg = (pts: PlasmaPoint[]) =>
    pts.length === 0
      ? 0
      : Math.round((pts.reduce((s, p) => s + p.levelValue, 0) / pts.length) * 100) / 100;

  const e2Avgs = Array.from({ length: cycleLengthDays }, (_, i) =>
    avg(e2ByDay.get(i + 1) ?? [])
  );
  const p4Avgs = Array.from({ length: cycleLengthDays }, (_, i) =>
    avg(p4ByDay.get(i + 1) ?? [])
  );

  // ── Normalizar síntomas por día del ciclo ──
  const symptomsByDay = new Map<number, SymptomEntry[]>();
  for (let d = 1; d <= cycleLengthDays; d++) symptomsByDay.set(d, []);

  for (const entry of input.symptomEntries) {
    const msFromAnchor = entry.loggedAt.getTime() - input.cycleAnchorDate.getTime();
    if (msFromAnchor < 0) continue;
    const dayFloat = msFromAnchor / (24 * 3_600_000);
    const normalizedDay = Math.ceil((dayFloat / cycleLengthDays) * 28);
    const day = Math.min(Math.max(normalizedDay, 1), cycleLengthDays);
    symptomsByDay.get(day)!.push(entry);
  }

  // ── Valores globales para fases dinámicas ──
  const globalAvgE2 = e2Avgs.reduce((s, v) => s + v, 0) / cycleLengthDays;
  const globalAvgP4 = p4Avgs.reduce((s, v) => s + v, 0) / cycleLengthDays;

  // ── Score compuesto normalizado (E2 + P4 ponderados) ──
  const compositeRaw = e2Avgs.map((e2, i) => e2 * 0.6 + p4Avgs[i] * 40); // escalar P4 (ng→pg equiv)
  const compositeNorm = normalize0to100(compositeRaw);

  // ── Construir días ──
  const days: CycleDay[] = [];

  for (let i = 0; i < cycleLengthDays; i++) {
    const day = i + 1;
    const e2 = e2Avgs[i];
    const p4 = p4Avgs[i];
    const prevE2 = i > 0 ? e2Avgs[i - 1] : e2;
    const nextE2 = i < cycleLengthDays - 1 ? e2Avgs[i + 1] : e2;
    const e2Trend = calcTrend(prevE2, e2, nextE2);
    const prevP4 = i > 0 ? p4Avgs[i - 1] : p4;
    const nextP4 = i < cycleLengthDays - 1 ? p4Avgs[i + 1] : p4;
    const p4Trend = calcTrend(prevP4, p4, nextP4);

    const phase = assignPhaseToDay(day, e2Trend, p4, e2, globalAvgE2, globalAvgP4);

    // Síntomas del día
    const daySymptoms = symptomsByDay.get(day) ?? [];
    let symptoms: DaySymptomSummary | undefined;

    if (daySymptoms.length > 0) {
      const meanSymptom = (key: SymptomKey) =>
        Math.round(
          (daySymptoms.reduce((s, e) => s + e[key], 0) / daySymptoms.length) * 10
        ) / 10;

      const avgMood            = meanSymptom("moodScore");
      const avgBreastTenderness = meanSymptom("breastTenderness");
      const avgFatigue         = meanSymptom("fatigueLevel");
      const avgDigestive       = meanSymptom("digestiveChanges");
      const avgLibido          = meanSymptom("libidoScore");
      const avgSkinChanges     = meanSymptom("skinChanges");
      const avgBrainFog        = meanSymptom("brainFog");
      const avgEmotionalLability = meanSymptom("emotionalLability");
      const overallIntensity   =
        Math.round(
          ((avgBreastTenderness + avgFatigue + avgDigestive + avgBrainFog + avgEmotionalLability) / 5) * 10
        ) / 10;

      symptoms = {
        avgMood,
        avgBreastTenderness,
        avgFatigue,
        avgDigestive,
        avgLibido,
        avgSkinChanges,
        avgBrainFog,
        avgEmotionalLability,
        overallIntensity,
        sampleCount: daySymptoms.length,
      };
    }

    days.push({
      day,
      phase,
      avgE2Level: e2,
      avgP4Level: p4,
      e2Trend,
      p4Trend,
      compositeScore: compositeNorm[i],
      symptoms,
    });
  }

  // ── Correlaciones y período fantasma ──
  const symptomCorrelations = correlateSymptoms(days);
  const ghostPeriod = detectGhostPeriod(days, symptomCorrelations);

  // ── Confianza del modelo ──
  const daysWithData = days.filter((d) => d.avgE2Level > 0 || d.avgP4Level > 0).length;
  const daysWithSymptoms = days.filter((d) => d.symptoms !== undefined).length;
  const confidenceScore =
    Math.round(
      Math.min(
        (daysWithData / 28) * 0.5 + (daysWithSymptoms / 28) * 0.5,
        1.0
      ) * 100
    ) / 100;

  // ── Insights ──
  const insights = generateInsights(days, ghostPeriod, symptomCorrelations, confidenceScore);

  return {
    userId,
    cycleNumber,
    cycleLengthDays,
    follicularDays: 14,
    lutealDays: 14,
    days,
    phases: PHASE_DEFINITIONS,
    ghostPeriod,
    symptomCorrelations,
    confidenceScore,
    dataPointsUsed: input.plasmaPoints.length + input.symptomEntries.length,
    lastUpdated: new Date(),
    insights,
  };
}

// ─────────────────────────────────────────────
// 7. Refinamiento iterativo del ciclo
// ─────────────────────────────────────────────

/**
 * Actualiza un ciclo existente incorporando nuevos datos.
 * Se llama al final de cada ciclo de 28 días.
 * Usa media exponencial ponderada para suavizar la evolución del modelo.
 */
export function refineCycle(
  existing: VirtualCycleProfile,
  newInput: NormalizationInput
): VirtualCycleProfile {
  const newCycle = buildVirtualCycle(
    newInput,
    existing.userId,
    existing.cycleNumber + 1
  );

  const alpha = 0.3; // peso del ciclo nuevo vs. el histórico

  // Promediar niveles día a día con peso exponencial
  const refinedDays = existing.days.map((oldDay, i) => {
    const newDay = newCycle.days[i];
    if (!newDay) return oldDay;
    return {
      ...oldDay,
      avgE2Level: Math.round(
        (oldDay.avgE2Level * (1 - alpha) + newDay.avgE2Level * alpha) * 100
      ) / 100,
      avgP4Level: Math.round(
        (oldDay.avgP4Level * (1 - alpha) + newDay.avgP4Level * alpha) * 100
      ) / 100,
      compositeScore: Math.round(
        oldDay.compositeScore * (1 - alpha) + newDay.compositeScore * alpha
      ),
    };
  });

  return {
    ...newCycle,
    days: refinedDays,
    cycleNumber: existing.cycleNumber + 1,
    confidenceScore: Math.min(
      Math.round((existing.confidenceScore * 0.7 + newCycle.confidenceScore * 0.3) * 100) / 100,
      1.0
    ),
  };
}

// ─────────────────────────────────────────────
// 8. Utilidades para el dashboard
// ─────────────────────────────────────────────

/**
 * Devuelve el estado del ciclo para el día de hoy.
 * Usado por el dashboard circular.
 */
export function getTodayCycleStatus(
  profile: VirtualCycleProfile,
  cycleAnchorDate: Date,
  today: Date = new Date()
): {
  currentDay: number;
  phase: PhaseLabel;
  phaseDescription: string;
  daysUntilGhostPeriod: number | null;
  compositeScore: number;
  e2Trend: string;
  p4Trend: string;
} {
  const msElapsed = today.getTime() - cycleAnchorDate.getTime();
  const daysElapsed = Math.floor(msElapsed / (24 * 3_600_000));
  const currentDay = (daysElapsed % profile.cycleLengthDays) + 1;

  const todayData = profile.days.find((d) => d.day === currentDay) ?? profile.days[0];
  const phaseInfo = profile.phases.find((p) => p.label === todayData.phase);

  let daysUntilGhostPeriod: number | null = null;
  if (profile.ghostPeriod) {
    const diff = profile.ghostPeriod.startDay - currentDay;
    daysUntilGhostPeriod = diff >= 0 ? diff : diff + profile.cycleLengthDays;
  }

  return {
    currentDay,
    phase: todayData.phase,
    phaseDescription: phaseInfo?.description ?? "",
    daysUntilGhostPeriod,
    compositeScore: todayData.compositeScore,
    e2Trend: todayData.e2Trend,
    p4Trend: todayData.p4Trend,
  };
}

/**
 * Genera los 28 puntos para el anillo del dashboard circular,
 * cada uno con su color de fase y score hormonal.
 */
export function getDashboardRingData(profile: VirtualCycleProfile): Array<{
  day: number;
  phase: PhaseLabel;
  compositeScore: number;
  hasSymptomData: boolean;
  isGhostPeriod: boolean;
}> {
  const gp = profile.ghostPeriod;
  return profile.days.map((d) => ({
    day: d.day,
    phase: d.phase,
    compositeScore: d.compositeScore,
    hasSymptomData: d.symptoms !== undefined,
    isGhostPeriod: gp
      ? d.day >= gp.startDay && d.day <= gp.endDay
      : false,
  }));
}
