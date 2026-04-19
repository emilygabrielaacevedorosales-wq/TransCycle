/**
 * Tests Módulo B — Algoritmo avanzado
 * TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node src/pharmacokinetics_advanced.test.ts
 */
import assert from "assert";
import {
  combinedE2Level, combinedRegimenSnapshot,
  generateCombinedTimeSeries, detectMissedDoses,
  calculatePersonalCalibration, applyCalibration,
  estimatedTestosteroneLevel, calibrateSpiroSuppression,
  simulateRegimen, compareRegimens,
  type SimulationScenario,
} from "./pharmacokinetics_advanced";
import type { DoseEvent } from "./pharmacokinetics";

let p=0,f=0;
function test(name:string, fn:()=>void){
  try{fn();console.log(`  ✓ ${name}`);p++;}
  catch(e:any){console.error(`  ✗ ${name}: ${e.message}`);f++;}
}

const now = new Date("2025-01-15T12:00:00Z");
const mkDose = (drugKey: DoseEvent["drugKey"], doseAmountMg:number, hoursAgo:number):DoseEvent =>({
  administeredAt: new Date(now.getTime()-hoursAgo*3600000),
  doseAmountMg, drugKey,
});

// ─── Superposición multi-droga ─────────────────────
console.log("\nSuperposición multi-droga");

test("régimen combinado sublingual+parche suma ambas fuentes", ()=>{
  const doses = [mkDose("E2_SUBLINGUAL",1,0.5), mkDose("E2_PATCH",1,8)];
  const solo  = [mkDose("E2_SUBLINGUAL",1,0.5)];
  const combined = combinedE2Level(doses, now);
  const single   = combinedE2Level(solo,  now);
  assert.ok(combined > single, `combinado ${combined.toFixed(1)} debe ser > solo ${single.toFixed(1)}`);
});

test("snapshot incluye desglose por fármaco", ()=>{
  const doses = [mkDose("E2_SUBLINGUAL",1,1), mkDose("P4_RECTAL",200,4), mkDose("SPIRO",100,3)];
  const snap  = combinedRegimenSnapshot(doses, now);
  assert.ok(snap.totalE2PgMl > 0, "E2 debe ser > 0");
  assert.ok(snap.totalP4NgMl > 0, "P4 debe ser > 0");
  assert.ok(snap.spiroSuppression > 0 && snap.spiroSuppression <= 1);
  assert.ok("E2_SUBLINGUAL" in snap.byDrug);
});

test("serie temporal combinada genera puntos c/2h", ()=>{
  const doses = [mkDose("E2_SUBLINGUAL",1,0)];
  const from  = now;
  const to    = new Date(now.getTime()+24*3600000);
  const pts   = generateCombinedTimeSeries(doses, from, to, 2);
  assert.equal(pts.length, 13);
});

test("factor de corrección se aplica al nivel combinado", ()=>{
  const doses = [mkDose("E2_SUBLINGUAL",1,1)];
  const base  = combinedE2Level(doses, now);
  const calibrated = combinedE2Level(doses, now, {E2_SUBLINGUAL: 1.5});
  assert.ok(Math.abs(calibrated - base*1.5) < 1, `esperado ~${(base*1.5).toFixed(0)}, obtenido ${calibrated.toFixed(0)}`);
});

// ─── Detección de dosis saltada ────────────────────
console.log("\nDetección de dosis saltada");

test("detecta gap > 1.5× el intervalo esperado", ()=>{
  const doses:DoseEvent[] = [
    mkDose("E2_SUBLINGUAL",1,32), // dosis de hace 32h
    mkDose("E2_SUBLINGUAL",1,8),  // siguiente esperada a las 24h, llegó a las 32h → gap de 24h (> 8*1.5=12h)
  ];
  const missed = detectMissedDoses(doses, 8);
  assert.equal(missed.length, 1);
  assert.ok(missed[0].gapHours >= 12);
});

test("no detecta falsos positivos con dosis regulares", ()=>{
  const doses:DoseEvent[] = [
    mkDose("E2_SUBLINGUAL",1,24),
    mkDose("E2_SUBLINGUAL",1,16),
    mkDose("E2_SUBLINGUAL",1,8),
    mkDose("E2_SUBLINGUAL",1,0),
  ];
  const missed = detectMissedDoses(doses, 8);
  assert.equal(missed.length, 0);
});

test("detecta múltiples dosis saltadas", ()=>{
  const doses:DoseEvent[] = [
    mkDose("E2_SUBLINGUAL",1,72),
    mkDose("E2_SUBLINGUAL",1,48), // gap 24h > 12h → missed
    mkDose("E2_SUBLINGUAL",1,8),  // gap 40h > 12h → missed
  ];
  const missed = detectMissedDoses(doses, 8);
  assert.equal(missed.length, 2);
});

// ─── Calibración personal ──────────────────────────
console.log("\nCalibración personal");

test("factor de corrección se calcula como medido/estimado", ()=>{
  const doses = [mkDose("E2_SUBLINGUAL",1,1)];
  const estimated = combinedE2Level(doses, now);
  const measured  = estimated * 1.3; // usuaria absorbe 30% más
  const cal = calculatePersonalCalibration(doses, now, measured, "E2_SUBLINGUAL", 1);
  assert.ok(Math.abs(cal.correctionFactor - 1.3) < 0.05, `factor esperado ~1.3, obtenido ${cal.correctionFactor}`);
});

test("applyCalibration suaviza con EWM (no salto brusco)", ()=>{
  const existing = {E2_SUBLINGUAL: 1.0};
  const cal = {
    drugKey: "E2_SUBLINGUAL" as const,
    measuredE2PgMl: 300, estimatedE2PgMl: 200,
    hoursSinceLastDose: 1, correctionFactor: 1.5, appliedAt: new Date(),
  };
  const updated = applyCalibration(existing, cal);
  // EWM α=0.4: 1.0*0.6 + 1.5*0.4 = 1.2
  assert.ok(Math.abs((updated.E2_SUBLINGUAL??0) - 1.2) < 0.01);
});

// ─── Supresión T calibrada ─────────────────────────
console.log("\nSupresión de testosterona");

test("T estimada disminuye con SPIRO activa", ()=>{
  const doses = [mkDose("SPIRO",200,3)];
  const tEstimated = estimatedTestosteroneLevel(doses, now, 400);
  assert.ok(tEstimated < 400, `T estimada ${tEstimated} debe ser menor que baseline 400`);
});

test("calibración de supresión T calcula ratio correcto", ()=>{
  const factor = calibrateSpiroSuppression(50, 80, 400);
  // medida=(1-50/400)=0.875, estimada=(1-80/400)=0.8 → factor=0.875/0.8~1.09
  assert.ok(factor > 1.0 && factor < 1.2, `factor esperado ~1.09, obtenido ${factor}`);
});

// ─── Simulador de regímenes ────────────────────────
console.log("\nSimulador de regímenes");

const scenarioBase:SimulationScenario = {
  drugKey:"E2_SUBLINGUAL", doseAmountMg:1, frequencyHours:8,
  scenarioName:"Régimen actual: 1mg c/8h",
};

test("simulación genera serie de 28 días", ()=>{
  const result = simulateRegimen(scenarioBase);
  // 28 días × 24h / 4h step = 168 puntos + 1
  assert.ok(result.points.length >= 100, `esperado 100+ puntos, obtenido ${result.points.length}`);
});

test("pico mayor que trough en régimen simulado", ()=>{
  const result = simulateRegimen(scenarioBase);
  assert.ok(result.peakE2 > result.troughE2, "pico debe ser mayor que trough");
});

test("dosis mayor produce pico mayor", ()=>{
  const r1 = simulateRegimen({...scenarioBase, doseAmountMg:1});
  const r2 = simulateRegimen({...scenarioBase, doseAmountMg:2});
  assert.ok(r2.peakE2 > r1.peakE2, `${r2.peakE2} debe ser > ${r1.peakE2}`);
});

test("frecuencia más alta produce trough más alto (mayor acumulación)", ()=>{
  const r8h  = simulateRegimen({...scenarioBase, frequencyHours:8});
  const r12h = simulateRegimen({...scenarioBase, frequencyHours:12});
  assert.ok(r8h.troughE2 >= r12h.troughE2, "más frecuencia → trough más alto");
});

test("compareRegimens devuelve deltas y recomendación", ()=>{
  const proposed:SimulationScenario = {...scenarioBase, doseAmountMg:2, scenarioName:"Propuesto: 2mg c/8h"};
  const comparison = compareRegimens(scenarioBase, proposed);
  assert.ok(comparison.deltaE2Peak > 0, "dosis doble debe subir el pico");
  assert.ok(comparison.recommendation.length > 0);
});

console.log(`\n─────────────────────────────────`);
console.log(`  ${p} tests pasaron  |  ${f} fallaron`);
if(f>0) process.exit(1);
