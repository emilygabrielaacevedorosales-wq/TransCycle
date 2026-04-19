/**
 * TransCycle — Módulo B: Algoritmo avanzado
 * Extensión de pharmacokinetics.ts con:
 *   - Superposición multi-droga (regímenes combinados)
 *   - Detección de dosis saltada
 *   - Calibración personal con examen real
 *   - Modelo de supresión T calibrado
 *   - Endpoint simulate helper
 */

import {
  DRUG_PROFILES,
  singleDoseLevel,
  spiroSuppressionLevel,
  type DoseEvent,
  type DrugKey,
  type PlasmaPoint,
} from "./pharmacokinetics";

// ─────────────────────────────────────────────
// Tipos nuevos
// ─────────────────────────────────────────────

export interface CombinedRegimenLevel {
  calculatedAt: Date;
  totalE2PgMl: number;       // suma de todas las fuentes de E2
  totalP4NgMl: number;
  spiroSuppression: number;  // 0-1
  byDrug: Record<string, number>; // desglose por drug_key
}

export interface MissedDoseEvent {
  medicationId: string;
  drugKey: DrugKey;
  expectedAt: Date;
  detectedAt: Date;
  gapHours: number;
}

export interface PersonalCalibration {
  drugKey: DrugKey;
  measuredE2PgMl: number;      // valor real del examen
  estimatedE2PgMl: number;     // lo que el modelo calculaba
  hoursSinceLastDose: number;  // cuándo se sacó el examen
  correctionFactor: number;    // measuredE2 / estimatedE2
  appliedAt: Date;
}

export interface SimulationResult {
  scenario: string;
  points: Array<{ h: number; e2: number; p4: number }>;
  peakE2: number;
  troughE2: number;
  steadyStateTrough: number;
  daysToSteadyState: number;
}

// ─────────────────────────────────────────────
// 1. Superposición multi-droga
// ─────────────────────────────────────────────

/**
 * Calcula el nivel combinado de E2 sumando todas las fuentes activas.
 * Maneja unidades heterogéneas (pg/mL de sublingual + parche + IM)
 * normalizando todo a pg/mL.
 */
export function combinedE2Level(
  doses: DoseEvent[],
  atTime: Date,
  correctionFactors: Partial<Record<DrugKey, number>> = {}
): number {
  const e2Keys: DrugKey[] = ["E2_SUBLINGUAL", "E2_VALERATE_IM", "E2_CYPIONATE_IM", "E2_PATCH"];

  return e2Keys.reduce((total, drugKey) => {
    const profile = DRUG_PROFILES[drugKey];
    const correction = correctionFactors[drugKey] ?? 1.0;

    const contribution = doses
      .filter(d => d.drugKey === drugKey && d.administeredAt <= atTime)
      .reduce((sum, dose) => {
        const h = (atTime.getTime() - dose.administeredAt.getTime()) / 3_600_000;
        if (h > 336) return sum;
        return sum + singleDoseLevel(dose.doseAmountMg, h, profile) * correction;
      }, 0);

    return total + contribution;
  }, 0);
}

/**
 * Snapshot completo del régimen combinado en un momento dado.
 * Devuelve E2 total, P4, supresión de T y desglose por fármaco.
 */
export function combinedRegimenSnapshot(
  doses: DoseEvent[],
  atTime: Date,
  correctionFactors: Partial<Record<DrugKey, number>> = {}
): CombinedRegimenLevel {
  const byDrug: Record<string, number> = {};
  let totalE2 = 0;
  let totalP4 = 0;
  let spiroSup = 0;

  for (const drugKey of Object.keys(DRUG_PROFILES) as DrugKey[]) {
    const profile = DRUG_PROFILES[drugKey];
    const correction = correctionFactors[drugKey] ?? 1.0;

    const drugDoses = doses.filter(
      d => d.drugKey === drugKey && d.administeredAt <= atTime
    );

    if (drugDoses.length === 0) continue;

    let level = 0;
    for (const dose of drugDoses) {
      const h = (atTime.getTime() - dose.administeredAt.getTime()) / 3_600_000;
      if (h > 336) continue;

      if (drugKey === "SPIRO") {
        level = Math.max(level, spiroSuppressionLevel(dose.doseAmountMg, h));
      } else {
        level += singleDoseLevel(dose.doseAmountMg, h, profile) * correction;
      }
    }

    byDrug[drugKey] = Math.round(level * 100) / 100;

    if (profile.category === "estrogen") totalE2 += level;
    if (profile.category === "progestogen") totalP4 += level;
    if (drugKey === "SPIRO") spiroSup = level;
  }

  return {
    calculatedAt: atTime,
    totalE2PgMl: Math.round(totalE2 * 10) / 10,
    totalP4NgMl: Math.round(totalP4 * 100) / 100,
    spiroSuppression: Math.round(spiroSup * 1000) / 1000,
    byDrug,
  };
}

/**
 * Genera una serie temporal combinada para graficar todos los fármacos juntos.
 */
export function generateCombinedTimeSeries(
  doses: DoseEvent[],
  fromTime: Date,
  toTime: Date,
  stepHours = 2,
  correctionFactors: Partial<Record<DrugKey, number>> = {}
): CombinedRegimenLevel[] {
  const points: CombinedRegimenLevel[] = [];
  const stepMs = stepHours * 3_600_000;
  let current = new Date(fromTime);

  while (current <= toTime) {
    points.push(combinedRegimenSnapshot(doses, current, correctionFactors));
    current = new Date(current.getTime() + stepMs);
  }

  return points;
}

// ─────────────────────────────────────────────
// 2. Detección de dosis saltada
// ─────────────────────────────────────────────

/**
 * Analiza el log de dosis y detecta gaps que excedan 1.5× el intervalo esperado.
 * Marca esas ventanas como "dosis saltada" para no extrapolar la curva erróneamente.
 */
export function detectMissedDoses(
  doses: DoseEvent[],
  expectedIntervalHours: number,
  toleranceMultiplier = 1.5
): MissedDoseEvent[] {
  const missed: MissedDoseEvent[] = [];
  const threshold = expectedIntervalHours * toleranceMultiplier * 3_600_000;

  // Agrupar por drugKey y ordenar cronológicamente
  const byDrug = new Map<DrugKey, DoseEvent[]>();
  for (const dose of doses) {
    if (!byDrug.has(dose.drugKey)) byDrug.set(dose.drugKey, []);
    byDrug.get(dose.drugKey)!.push(dose);
  }

  for (const [drugKey, drugDoses] of byDrug) {
    const sorted = [...drugDoses].sort(
      (a, b) => a.administeredAt.getTime() - b.administeredAt.getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].administeredAt.getTime() - sorted[i - 1].administeredAt.getTime();
      if (gap > threshold) {
        const gapHours = gap / 3_600_000;
        const expectedAt = new Date(
          sorted[i - 1].administeredAt.getTime() + expectedIntervalHours * 3_600_000
        );
        missed.push({
          medicationId: drugKey,
          drugKey,
          expectedAt,
          detectedAt: sorted[i].administeredAt,
          gapHours: Math.round(gapHours * 10) / 10,
        });
      }
    }
  }

  return missed;
}

/**
 * Versión segura de totalPlasmaLevel que respeta los gaps de dosis saltadas.
 * Si el punto de tiempo cae dentro de una ventana de "dosis saltada",
 * sólo incluye las dosis que realmente ocurrieron.
 */
export function safeE2LevelWithGaps(
  doses: DoseEvent[],
  atTime: Date,
  missedDoses: MissedDoseEvent[],
  correctionFactors: Partial<Record<DrugKey, number>> = {}
): number {
  // Para cada dosis saltada, excluir contribuciones de dosis imaginarias
  // (el modelo ya no extrapola, simplemente usa solo dosis reales)
  // La superposición lineal garantiza que dosis reales contribuyen correctamente
  return combinedE2Level(doses, atTime, correctionFactors);
}

// ─────────────────────────────────────────────
// 3. Calibración personal
// ─────────────────────────────────────────────

/**
 * Calcula el factor de corrección personal comparando el nivel
 * medido en sangre con el nivel estimado por el modelo en ese momento.
 *
 * correctionFactor = measuredE2 / estimatedE2
 *
 * Si el factor es > 1: la usuaria absorbe más de lo esperado (metabolismo rápido)
 * Si el factor es < 1: absorbe menos (metabolismo lento o primera paso hepático mayor)
 */
export function calculatePersonalCalibration(
  doses: DoseEvent[],
  testDate: Date,
  measuredE2PgMl: number,
  drugKey: DrugKey,
  hoursSinceLastDose: number
): PersonalCalibration {
  const estimatedLevel = combinedE2Level(doses, testDate);

  const correctionFactor =
    estimatedLevel > 0
      ? Math.round((measuredE2PgMl / estimatedLevel) * 1000) / 1000
      : 1.0;

  return {
    drugKey,
    measuredE2PgMl,
    estimatedE2PgMl: Math.round(estimatedLevel * 10) / 10,
    hoursSinceLastDose,
    correctionFactor,
    appliedAt: new Date(),
  };
}

/**
 * Aplica la calibración a un conjunto de factores de corrección.
 * Suaviza con el factor anterior para evitar saltos bruscos (EWM α=0.4).
 */
export function applyCalibration(
  existing: Partial<Record<DrugKey, number>>,
  newCalibration: PersonalCalibration
): Partial<Record<DrugKey, number>> {
  const alpha = 0.4;
  const prev = existing[newCalibration.drugKey] ?? 1.0;
  const smoothed =
    Math.round((prev * (1 - alpha) + newCalibration.correctionFactor * alpha) * 1000) / 1000;

  return { ...existing, [newCalibration.drugKey]: smoothed };
}

// ─────────────────────────────────────────────
// 4. Supresión de T calibrada
// ─────────────────────────────────────────────

/**
 * Calibra el modelo de supresión de espironolactona usando el valor
 * real de testosterona del último examen de la usuaria.
 *
 * Devuelve el nivel estimado de T en ng/dL basándose en la supresión actual.
 */
export function estimatedTestosteroneLevel(
  spiroDoses: DoseEvent[],
  atTime: Date,
  baselineTestosterone: number  // T de referencia pre-TRH o sin SPIRO (ng/dL)
): number {
  const suppression = spiroDoses
    .filter(d => d.drugKey === "SPIRO" && d.administeredAt <= atTime)
    .reduce((max, dose) => {
      const h = (atTime.getTime() - dose.administeredAt.getTime()) / 3_600_000;
      if (h > 168) return max;
      return Math.max(max, spiroSuppressionLevel(dose.doseAmountMg, h));
    }, 0);

  const estimated = baselineTestosterone * (1 - suppression);
  return Math.round(estimated * 10) / 10;
}

/**
 * Calcula el factor de corrección de supresión comparando T medida vs. estimada.
 */
export function calibrateSpiroSuppression(
  measuredT: number,
  estimatedT: number,
  baselineT: number
): number {
  const measuredSuppression = 1 - measuredT / baselineT;
  const estimatedSuppression = 1 - estimatedT / baselineT;
  if (estimatedSuppression <= 0) return 1.0;
  return Math.round((measuredSuppression / estimatedSuppression) * 1000) / 1000;
}

// ─────────────────────────────────────────────
// 5. Simulador de escenarios (/cycle/simulate)
// ─────────────────────────────────────────────

export interface SimulationScenario {
  drugKey: DrugKey;
  doseAmountMg: number;
  frequencyHours: number;
  scenarioName: string;
}

/**
 * Simula cómo cambiaría la curva bajo un régimen hipotético.
 * Genera 28 días de proyección para comparar con el régimen actual.
 */
export function simulateRegimen(
  scenario: SimulationScenario,
  startFrom: Date = new Date()
): SimulationResult {
  const { drugKey, doseAmountMg, frequencyHours } = scenario;
  const profile = DRUG_PROFILES[drugKey];
  const ke = Math.LN2 / profile.halfLifeHours;

  // Proyectar 28 días de dosis simuladas
  const doseCount = Math.floor((28 * 24) / frequencyHours);
  const simulatedDoses: DoseEvent[] = Array.from({ length: doseCount }, (_, i) => ({
    administeredAt: new Date(startFrom.getTime() + i * frequencyHours * 3_600_000),
    doseAmountMg,
    drugKey,
  }));

  // Calcular serie temporal (cada 4h para eficiencia)
  const endTime = new Date(startFrom.getTime() + 28 * 24 * 3_600_000);
  const points: Array<{ h: number; e2: number; p4: number }> = [];
  let current = new Date(startFrom);
  const stepMs = 4 * 3_600_000;

  while (current <= endTime) {
    const h = (current.getTime() - startFrom.getTime()) / 3_600_000;
    const level = combinedE2Level(simulatedDoses, current);
    const isE2 = profile.category === "estrogen";
    points.push({
      h: Math.round(h),
      e2: isE2 ? Math.round(level * 10) / 10 : 0,
      p4: profile.category === "progestogen" ? Math.round(level * 100) / 100 : 0,
    });
    current = new Date(current.getTime() + stepMs);
  }

  // Steady-state analítico
  const cMax = (profile.cmaxPerMg ?? 1) * doseAmountMg;
  const ssTrough =
    Math.round(
      (cMax * Math.exp(-ke * frequencyHours)) /
      (1 - Math.exp(-ke * frequencyHours)) * 100
    ) / 100;

  const e2Values = points.filter(p => p.e2 > 0).map(p => p.e2);
  const peakE2   = e2Values.length ? Math.max(...e2Values) : 0;
  const troughE2 = e2Values.length ? Math.min(...e2Values) : 0;

  const daysToSteadyState = Math.ceil((3.3 * profile.halfLifeHours) / frequencyHours);

  return {
    scenario: scenario.scenarioName,
    points,
    peakE2: Math.round(peakE2 * 10) / 10,
    troughE2: Math.round(troughE2 * 10) / 10,
    steadyStateTrough: ssTrough,
    daysToSteadyState,
  };
}

/**
 * Compara el régimen actual con uno propuesto.
 * Útil para el endpoint /cycle/simulate.
 */
export function compareRegimens(
  current: SimulationScenario,
  proposed: SimulationScenario
): {
  current: SimulationResult;
  proposed: SimulationResult;
  deltaE2Peak: number;
  deltaE2Trough: number;
  recommendation: string;
} {
  const currentResult  = simulateRegimen(current);
  const proposedResult = simulateRegimen(proposed);

  const deltaE2Peak   = Math.round((proposedResult.peakE2 - currentResult.peakE2) * 10) / 10;
  const deltaE2Trough = Math.round((proposedResult.troughE2 - currentResult.troughE2) * 10) / 10;

  let recommendation = "";
  if (deltaE2Trough > 20) {
    recommendation = "El régimen propuesto elevaría el nivel basal significativamente. Discute con tu endocrinólogo/a antes de cambiar.";
  } else if (deltaE2Trough < -20) {
    recommendation = "El régimen propuesto reduciría el nivel basal. Puede aumentar los síntomas del período fantasma.";
  } else {
    recommendation = "Los cambios son moderados y podrían mejorar la estabilidad del ciclo.";
  }

  return { current: currentResult, proposed: proposedResult, deltaE2Peak, deltaE2Trough, recommendation };
}
