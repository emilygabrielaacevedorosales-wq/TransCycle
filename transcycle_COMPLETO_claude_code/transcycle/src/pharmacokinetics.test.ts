/**
 * TransCycle — Tests del módulo de farmacocinética
 * Ejecutar con: npx ts-node pharmacokinetics.test.ts
 *
 * No requiere framework externo — usa assert nativo de Node.
 */

import assert from "assert";
import {
  DRUG_PROFILES,
  singleDoseLevel,
  spiroSuppressionLevel,
  totalPlasmaLevel,
  steadyStateTrough,
  dosesToSteadyState,
  generatePlasmaTimeSeries,
  type DoseEvent,
  type DrugKey,
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

// ─────────────────────────────────────────────
// Perfiles de fármacos
// ─────────────────────────────────────────────
console.log("\nPerfiles de fármacos");

test("todos los 6 fármacos están definidos", () => {
  const keys: DrugKey[] = ["E2_SUBLINGUAL","E2_VALERATE_IM","E2_CYPIONATE_IM","E2_PATCH","P4_RECTAL","SPIRO"];
  keys.forEach((k) => assert.ok(DRUG_PROFILES[k], `falta ${k}`));
});

test("SPIRO tiene t½ secundaria (canrenoato)", () => {
  assert.ok(DRUG_PROFILES.SPIRO.halfLifeSecondaryHours === 16);
});

test("P4_RECTAL tiene vía rectal y categoría progestogen", () => {
  const p = DRUG_PROFILES.P4_RECTAL;
  assert.equal(p.category, "progestogen");
  assert.equal(p.cmaxUnit, "ng_per_mg");
});

test("E2_SUBLINGUAL tiene pico en 45 min", () => {
  assert.equal(DRUG_PROFILES.E2_SUBLINGUAL.peakHours, 0.75);
});

// ─────────────────────────────────────────────
// Niveles de dosis única
// ─────────────────────────────────────────────
console.log("\nNiveles dosis única");

test("nivel en t=0 es 0", () => {
  const lvl = singleDoseLevel(1, 0, DRUG_PROFILES.E2_SUBLINGUAL);
  assert.equal(lvl, 0);
});

test("nivel en t<0 es 0", () => {
  assert.equal(singleDoseLevel(1, -1, DRUG_PROFILES.E2_SUBLINGUAL), 0);
});

test("E2_SUBLINGUAL 1mg alcanza Cmax aprox en t_peak", () => {
  const lvl = singleDoseLevel(1, 0.75, DRUG_PROFILES.E2_SUBLINGUAL);
  // En t=tmax debe estar en o cerca de Cmax (350 pg/mL)
  assert.ok(lvl > 340 && lvl <= 350, `esperado ~350, obtenido ${lvl}`);
});

test("E2_SUBLINGUAL decae al 50% aprox en t½ tras el pico", () => {
  const peakLvl = singleDoseLevel(1, 0.75, DRUG_PROFILES.E2_SUBLINGUAL);
  const halfLifeLvl = singleDoseLevel(1, 0.75 + 3.0, DRUG_PROFILES.E2_SUBLINGUAL);
  const ratio = halfLifeLvl / peakLvl;
  assert.ok(ratio > 0.45 && ratio < 0.55, `ratio esperado ~0.5, obtenido ${ratio.toFixed(3)}`);
});

test("P4_RECTAL 200mg alcanza ~16 ng/mL en el pico", () => {
  const lvl = singleDoseLevel(200, 3.5, DRUG_PROFILES.P4_RECTAL);
  assert.ok(lvl > 14 && lvl < 18, `esperado ~16 ng/mL, obtenido ${lvl.toFixed(2)}`);
});

test("E2_VALERATE_IM 5mg pico ocurre en t=48h", () => {
  const atPeak = singleDoseLevel(5, 48, DRUG_PROFILES.E2_VALERATE_IM);
  const before  = singleDoseLevel(5, 24, DRUG_PROFILES.E2_VALERATE_IM);
  const after   = singleDoseLevel(5, 72, DRUG_PROFILES.E2_VALERATE_IM);
  assert.ok(atPeak > before, "el pico debe ser mayor que a las 24h");
  assert.ok(atPeak > after,  "el pico debe ser mayor que a las 72h");
});

// ─────────────────────────────────────────────
// Espironolactona (modelo de supresión)
// ─────────────────────────────────────────────
console.log("\nEspironolactona — modelo de supresión");

test("SPIRO 200mg tiene supresión máxima = 1.0", () => {
  const lvl = spiroSuppressionLevel(200, 2.5);
  assert.ok(lvl >= 0.99, `esperado ~1.0, obtenido ${lvl.toFixed(3)}`);
});

test("SPIRO 100mg tiene supresión máxima = 0.5", () => {
  const lvl = spiroSuppressionLevel(100, 2.5);
  assert.ok(lvl > 0.49 && lvl <= 0.5, `esperado ~0.5, obtenido ${lvl.toFixed(3)}`);
});

test("SPIRO supresión baja con t½ del canrenoato (16h)", () => {
  const atPeak = spiroSuppressionLevel(200, 2.5);
  const at18h  = spiroSuppressionLevel(200, 2.5 + 16);
  const ratio  = at18h / atPeak;
  assert.ok(ratio > 0.45 && ratio < 0.55, `ratio esperado ~0.5, obtenido ${ratio.toFixed(3)}`);
});

// ─────────────────────────────────────────────
// Superposición (múltiples dosis)
// ─────────────────────────────────────────────
console.log("\nSuperposición de dosis");

const baseTime = new Date("2025-01-01T08:00:00Z");

test("dos dosis suman más que una sola", () => {
  const oneDose: DoseEvent[] = [
    { administeredAt: baseTime, doseAmountMg: 1, drugKey: "E2_SUBLINGUAL" },
  ];
  const twoDoses: DoseEvent[] = [
    { administeredAt: baseTime,         doseAmountMg: 1, drugKey: "E2_SUBLINGUAL" },
    { administeredAt: new Date(baseTime.getTime() - 8 * 3_600_000), doseAmountMg: 1, drugKey: "E2_SUBLINGUAL" },
  ];
  const atTime = new Date(baseTime.getTime() + 1 * 3_600_000);
  const lvl1 = totalPlasmaLevel(oneDose,  atTime, "E2_SUBLINGUAL");
  const lvl2 = totalPlasmaLevel(twoDoses, atTime, "E2_SUBLINGUAL");
  assert.ok(lvl2 > lvl1, `${lvl2.toFixed(1)} debe ser mayor que ${lvl1.toFixed(1)}`);
});

test("dosis futura no contribuye al nivel actual", () => {
  const futureDose: DoseEvent[] = [
    { administeredAt: new Date(baseTime.getTime() + 2 * 3_600_000), doseAmountMg: 2, drugKey: "E2_SUBLINGUAL" },
  ];
  const lvl = totalPlasmaLevel(futureDose, baseTime, "E2_SUBLINGUAL");
  assert.equal(lvl, 0);
});

// ─────────────────────────────────────────────
// Steady-state
// ─────────────────────────────────────────────
console.log("\nSteady-state");

test("E2_SUBLINGUAL 1mg cada 8h: trough de estado estacionario calculable", () => {
  const trough = steadyStateTrough(1, 8, "E2_SUBLINGUAL");
  assert.ok(trough > 0, `trough debe ser > 0, obtenido ${trough.toFixed(2)}`);
  console.log(`    → trough E2_SUBLINGUAL 1mg/8h: ${trough.toFixed(1)} pg/mL`);
});

test("cipionato IM alcanza steady-state en ~3-4 semanas", () => {
  const n = dosesToSteadyState("E2_CYPIONATE_IM", 168);
  assert.ok(n >= 3 && n <= 5, `esperado 3-5 dosis, obtenido ${n}`);
  console.log(`    → dosis para SS cipionato (semanal): ${n}`);
});

test("E2_SUBLINGUAL alcanza SS rápido (pocas dosis)", () => {
  const n = dosesToSteadyState("E2_SUBLINGUAL", 8);
  assert.ok(n <= 5, `E2_SUBLINGUAL debe alcanzar SS en ≤5 dosis, obtenido ${n}`);
  console.log(`    → dosis para SS sublingual (c/8h): ${n}`);
});

// ─────────────────────────────────────────────
// Serie temporal
// ─────────────────────────────────────────────
console.log("\nSerie temporal");

test("generatePlasmaTimeSeries produce puntos cada 2h", () => {
  const doses: DoseEvent[] = [
    { administeredAt: baseTime, doseAmountMg: 1, drugKey: "E2_SUBLINGUAL" },
  ];
  const to = new Date(baseTime.getTime() + 24 * 3_600_000);
  const pts = generatePlasmaTimeSeries(doses, "E2_SUBLINGUAL", baseTime, to);
  assert.equal(pts.length, 13); // 0h a 24h inclusive, cada 2h = 13 puntos
});

test("todos los puntos tienen levelValue >= 0", () => {
  const doses: DoseEvent[] = [
    { administeredAt: baseTime, doseAmountMg: 200, drugKey: "P4_RECTAL" },
  ];
  const to = new Date(baseTime.getTime() + 48 * 3_600_000);
  const pts = generatePlasmaTimeSeries(doses, "P4_RECTAL", baseTime, to);
  assert.ok(pts.every((p) => p.levelValue >= 0));
});

// ─────────────────────────────────────────────
// Resultado
// ─────────────────────────────────────────────
console.log(`\n─────────────────────────────────`);
console.log(`  ${passed} tests pasaron  |  ${failed} fallaron`);
if (failed > 0) process.exit(1);
