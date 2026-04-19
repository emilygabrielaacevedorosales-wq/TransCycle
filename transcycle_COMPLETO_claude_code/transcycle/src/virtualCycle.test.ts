/**
 * TransCycle — Tests del módulo de Ciclo Virtual
 * Ejecutar: TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node src/virtualCycle.test.ts
 */

import assert from "assert";
import {
  pearsonCorrelation,
  assignPhaseToDay,
  correlateSymptoms,
  detectGhostPeriod,
  buildVirtualCycle,
  refineCycle,
  getTodayCycleStatus,
  getDashboardRingData,
  type SymptomEntry,
  type CycleDay,
  type NormalizationInput,
} from "./virtualCycle";
import {
  generatePlasmaTimeSeries,
  type DoseEvent,
} from "./pharmacokinetics";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ─── Helpers ─────────────────────────────────

const anchor = new Date("2025-01-01T08:00:00Z");

function makeDoseEvents(
  drugKey: DoseEvent["drugKey"],
  doseAmountMg: number,
  intervalHours: number,
  count: number,
  startAt: Date
): DoseEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    administeredAt: new Date(startAt.getTime() + i * intervalHours * 3_600_000),
    doseAmountMg,
    drugKey,
  }));
}

function makeSymptomEntry(
  day: number,
  overrides: Partial<SymptomEntry> = {}
): SymptomEntry {
  const base = new Date(anchor.getTime() + (day - 1) * 24 * 3_600_000);
  return {
    loggedAt: base,
    moodScore: 7,
    breastTenderness: 3,
    fatigueLevel: 4,
    digestiveChanges: 2,
    libidoScore: 6,
    skinChanges: 3,
    brainFog: 3,
    emotionalLability: 4,
    ...overrides,
  };
}

// ─── Pearson ──────────────────────────────────
console.log("\nCorrelación de Pearson");

test("correlación perfecta positiva = 1", () => {
  const r = pearsonCorrelation([1,2,3,4,5], [1,2,3,4,5]);
  assert.ok(Math.abs(r - 1) < 0.001, `esperado 1, obtenido ${r}`);
});

test("correlación perfecta negativa = -1", () => {
  const r = pearsonCorrelation([1,2,3,4,5], [5,4,3,2,1]);
  assert.ok(Math.abs(r + 1) < 0.001, `esperado -1, obtenido ${r}`);
});

test("correlación sin covarianza = NaN o 0", () => {
  const r = pearsonCorrelation([3,3,3,3,3], [1,2,3,4,5]);
  assert.ok(isNaN(r) || r === 0, `esperado NaN o 0`);
});

test("arrays de largo distinto devuelve NaN", () => {
  const r = pearsonCorrelation([1,2,3], [1,2]);
  assert.ok(isNaN(r));
});

test("arrays menores a 3 elementos devuelven NaN", () => {
  const r = pearsonCorrelation([1,2], [1,2]);
  assert.ok(isNaN(r));
});

// ─── Asignación de fases ──────────────────────
console.log("\nAsignación de fases");

test("día 1 → follicular_early", () => {
  const phase = assignPhaseToDay(1, "rising", 1, 80, 100, 5);
  assert.equal(phase, "follicular_early");
});

test("día 14 con E2 alto → ovulation_virtual", () => {
  const phase = assignPhaseToDay(14, "stable", 2, 180, 100, 5);
  assert.equal(phase, "ovulation_virtual");
});

test("día 22 con P4 alta y E2 cayendo → luteal_late", () => {
  const phase = assignPhaseToDay(22, "falling", 8, 90, 100, 5);
  assert.equal(phase, "luteal_late");
});

test("E2 y P4 muy bajos → trough", () => {
  const phase = assignPhaseToDay(27, "falling", 0.5, 30, 100, 5);
  assert.equal(phase, "trough");
});

// ─── Construcción del ciclo virtual ───────────
console.log("\nConstrucción del ciclo virtual");

// Generar datos realistas de 28 días
const e2Doses = makeDoseEvents("E2_SUBLINGUAL", 1, 8, 84, anchor); // 3x/día × 28 días
const p4Doses = makeDoseEvents("P4_RECTAL", 200, 24, 28, anchor);  // 1x/día × 28 días

const cycleEnd = new Date(anchor.getTime() + 28 * 24 * 3_600_000);

const e2Series = generatePlasmaTimeSeries(e2Doses, "E2_SUBLINGUAL", anchor, cycleEnd);
const p4Series = generatePlasmaTimeSeries(p4Doses, "P4_RECTAL", anchor, cycleEnd);
const allPlasma = [...e2Series, ...p4Series];

// Síntomas con patrón: mayor sensibilidad días 25-28
const symptoms: SymptomEntry[] = [
  ...Array.from({ length: 24 }, (_, i) => makeSymptomEntry(i + 1)),
  ...Array.from({ length: 4 }, (_, i) =>
    makeSymptomEntry(i + 25, {
      breastTenderness: 8,
      fatigueLevel: 7,
      emotionalLability: 8,
      brainFog: 7,
      moodScore: 4,
    })
  ),
];

const input: NormalizationInput = {
  plasmaPoints: allPlasma,
  symptomEntries: symptoms,
  cycleAnchorDate: anchor,
  cycleLengthDays: 28,
  drugRegimen: ["E2_SUBLINGUAL", "P4_RECTAL"],
};

const profile = buildVirtualCycle(input, "user-test-001", 1);

test("ciclo tiene exactamente 28 días", () => {
  assert.equal(profile.days.length, 28);
});

test("todos los días tienen una fase asignada", () => {
  assert.ok(profile.days.every((d) => d.phase !== undefined));
});

test("compositeScore está entre 0 y 100", () => {
  assert.ok(profile.days.every((d) => d.compositeScore >= 0 && d.compositeScore <= 100),
    "algún día tiene compositeScore fuera de rango");
});

test("días con síntomas cargados tienen summary", () => {
  const withSymptoms = profile.days.filter((d) => d.symptoms !== undefined);
  assert.ok(withSymptoms.length >= 20, `esperado ≥20 días con síntomas, obtenido ${withSymptoms.length}`);
});

test("confidenceScore entre 0 y 1", () => {
  assert.ok(profile.confidenceScore >= 0 && profile.confidenceScore <= 1);
});

test("el ciclo detecta el período fantasma cerca de días 25-28", () => {
  assert.ok(profile.ghostPeriod !== null, "ghostPeriod no debe ser null con datos suficientes");
  assert.ok(
    profile.ghostPeriod!.peakDay >= 23 && profile.ghostPeriod!.peakDay <= 28,
    `peakDay esperado 23-28, obtenido ${profile.ghostPeriod!.peakDay}`
  );
  console.log(`    → Período fantasma: días ${profile.ghostPeriod!.startDay}–${profile.ghostPeriod!.endDay}, pico día ${profile.ghostPeriod!.peakDay}`);
  console.log(`    → Trigger: ${profile.ghostPeriod!.triggerType}`);
});

test("genera al menos un insight", () => {
  assert.ok(profile.insights.length >= 1, "debe haber al menos 1 insight generado");
  console.log(`    → Insight: "${profile.insights[0]}"`);
});

// ─── Correlaciones ────────────────────────────
console.log("\nCorrelaciones sintomáticas");

test("correlaciones tienen 8 entradas (una por síntoma)", () => {
  assert.equal(profile.symptomCorrelations.length, 8);
});

test("todos los correlaciones tienen peakCycleDay en rango 1-28", () => {
  assert.ok(
    profile.symptomCorrelations.every(
      (c) => c.peakCycleDay >= 1 && c.peakCycleDay <= 28
    )
  );
});

test("síntomas del período fantasma correlacionan con E2 bajo", () => {
  const breastCorr = profile.symptomCorrelations.find(
    (c) => c.symptomKey === "sensibilidad mamaria"
  );
  assert.ok(breastCorr !== undefined);
  console.log(`    → Sensibilidad mamaria ↔ E2: r=${breastCorr!.correlationWithE2}, ↔ P4: r=${breastCorr!.correlationWithP4}`);
});

// ─── Refinamiento ─────────────────────────────
console.log("\nRefinamiento iterativo");

const newAnchor = new Date(anchor.getTime() + 28 * 24 * 3_600_000);
const newE2Doses = makeDoseEvents("E2_SUBLINGUAL", 1, 8, 84, newAnchor);
const newP4Doses = makeDoseEvents("P4_RECTAL", 200, 24, 28, newAnchor);
const newEnd = new Date(newAnchor.getTime() + 28 * 24 * 3_600_000);
const newPlasma = [
  ...generatePlasmaTimeSeries(newE2Doses, "E2_SUBLINGUAL", newAnchor, newEnd),
  ...generatePlasmaTimeSeries(newP4Doses, "P4_RECTAL", newAnchor, newEnd),
];
const newInput: NormalizationInput = {
  plasmaPoints: newPlasma,
  symptomEntries: symptoms.map((s) => ({
    ...s,
    loggedAt: new Date(s.loggedAt.getTime() + 28 * 24 * 3_600_000),
  })),
  cycleAnchorDate: newAnchor,
  cycleLengthDays: 28,
  drugRegimen: ["E2_SUBLINGUAL", "P4_RECTAL"],
};

const refined = refineCycle(profile, newInput);

test("ciclo refinado tiene número de ciclo incrementado", () => {
  assert.equal(refined.cycleNumber, profile.cycleNumber + 1);
});

test("cycleNumber del refinado es 2", () => {
  assert.equal(refined.cycleNumber, 2);
});

// ─── Dashboard utils ──────────────────────────
console.log("\nUtilidades de dashboard");

test("getDashboardRingData devuelve 28 puntos", () => {
  const ring = getDashboardRingData(profile);
  assert.equal(ring.length, 28);
});

test("días del período fantasma marcados en el ring", () => {
  const ring = getDashboardRingData(profile);
  const ghostDays = ring.filter((r) => r.isGhostPeriod);
  assert.ok(ghostDays.length > 0, "debe haber días marcados como ghostPeriod");
  console.log(`    → Días marcados en ring como período fantasma: ${ghostDays.map((d) => d.day).join(", ")}`);
});

test("getTodayCycleStatus devuelve día válido", () => {
  const today = new Date(anchor.getTime() + 10 * 24 * 3_600_000); // día 11 del ciclo
  const status = getTodayCycleStatus(profile, anchor, today);
  assert.equal(status.currentDay, 11);
  assert.ok(status.phase !== undefined);
  console.log(`    → Día 11: fase=${status.phase}, score=${status.compositeScore}, E2=${status.e2Trend}`);
});

// ─── Resultado ────────────────────────────────
console.log(`\n─────────────────────────────────`);
console.log(`  ${passed} tests pasaron  |  ${failed} fallaron`);
if (failed > 0) process.exit(1);
