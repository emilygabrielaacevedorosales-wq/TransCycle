import {
  demoBloodTests,
  demoCycleStatus,
  demoDiaryEntries,
  demoDrugCatalog,
  demoRing,
  demoSymptoms,
  demoUser,
} from "../data/demo";
import * as firestore from "../firebase/firestore";

const demoState = {
  token: "demo-token",
  user: { ...demoUser },
  symptoms: [...demoSymptoms],
  diary: [...demoDiaryEntries],
  bloodTests: [...demoBloodTests],
};

export async function getDashboardData(session, mode) {
  if (mode === "demo" || !session) {
    return { status: demoCycleStatus, ring: demoRing };
  }

  try {
    const cycle = await firestore.getCurrentCycle(session.uid);
    const ring = demoRing;
    return { status: cycle || demoCycleStatus, ring };
  } catch (error) {
    console.warn("Error cargando dashboard:", error);
    return { status: demoCycleStatus, ring: demoRing };
  }
}

export async function getSymptoms(session, mode, limit = 7) {
  if (mode === "demo" || !session) {
    return demoState.symptoms.slice(0, limit);
  }

  try {
    return await firestore.getSymptoms(session.uid, limit);
  } catch (error) {
    console.warn("Error cargando síntomas:", error);
    return demoState.symptoms.slice(0, limit);
  }
}

export async function logSymptoms(session, mode, payload) {
  if (mode === "demo" || !session) {
    demoState.symptoms.unshift({
      id: `sym-${Date.now()}`,
      logged_at: new Date(),
      mood_score: payload.moodScore,
      breast_tenderness: payload.breastTenderness,
      fatigue_level: payload.fatigueLevel,
      digestive_changes: payload.digestiveChanges,
      libido_score: payload.libidoScore,
      skin_changes: payload.skinChanges,
      brain_fog: payload.brainFog,
      emotional_lability: payload.emotionalLability,
      virtual_cycle_day: demoCycleStatus.currentDay,
      phase: demoCycleStatus.phase,
    });
    return { ok: true };
  }

  try {
    return await firestore.logSymptoms(session.uid, payload);
  } catch (error) {
    console.warn("Error registrando síntomas:", error);
    demoState.symptoms.unshift({
      id: `sym-${Date.now()}`,
      logged_at: new Date(),
      mood_score: payload.moodScore,
      breast_tenderness: payload.breastTenderness,
      fatigue_level: payload.fatigueLevel,
      digestive_changes: payload.digestiveChanges,
      libido_score: payload.libidoScore,
      skin_changes: payload.skinChanges,
      brain_fog: payload.brainFog,
      emotional_lability: payload.emotionalLability,
      virtual_cycle_day: demoCycleStatus.currentDay,
      phase: demoCycleStatus.phase,
    });
    return { ok: true };
  }
}

export async function getDiaryEntries(session, mode) {
  if (mode === "demo" || !session) {
    return demoState.diary;
  }

  try {
    return await firestore.getDiaryEntries(session.uid);
  } catch (error) {
    console.warn("Error cargando diario:", error);
    return demoState.diary;
  }
}

export async function saveDiaryEntry(session, mode, payload) {
  if (mode === "demo" || !session) {
    const next = {
      id: `dia-${Date.now()}`,
      entry_date: payload.entry_date,
      wellbeing_score: payload.wellbeing_score,
      virtual_cycle_day: demoCycleStatus.currentDay,
      phase: demoCycleStatus.phase,
      body_changes: payload.body_changes,
      emotional_notes: payload.emotional_notes,
    };
    demoState.diary = [next, ...demoState.diary.filter((item) => item.entry_date !== payload.entry_date)];
    return { ok: true };
  }

  try {
    return await firestore.saveDiaryEntry(session.uid, payload.entry_date, payload);
  } catch (error) {
    console.warn("Error guardando diario:", error);
    const next = {
      id: `dia-${Date.now()}`,
      entry_date: payload.entry_date,
      wellbeing_score: payload.wellbeing_score,
      virtual_cycle_day: demoCycleStatus.currentDay,
      phase: demoCycleStatus.phase,
      body_changes: payload.body_changes,
      emotional_notes: payload.emotional_notes,
    };
    demoState.diary = [next, ...demoState.diary.filter((item) => item.entry_date !== payload.entry_date)];
    return { ok: true };
  }
}

export async function getBloodTests(session, mode) {
  if (mode === "demo" || !session) {
    return demoState.bloodTests;
  }

  try {
    return await firestore.getBloodTests(session.uid);
  } catch (error) {
    console.warn("Error cargando exámenes:", error);
    return demoState.bloodTests;
  }
}

export async function addBloodTest(session, mode, payload) {
  if (mode === "demo" || !session) {
    demoState.bloodTests.unshift({
      id: `test-${Date.now()}`,
      test_date: payload.test_date,
      lab_name: payload.lab_name,
      estradiol_pg_ml: payload.estradiol_pg_ml,
      testosterone_ng_dl: payload.testosterone_ng_dl,
      prolactin_ng_ml: payload.prolactin_ng_ml,
    });
    return { ok: true };
  }

  try {
    return await firestore.addBloodTest(session.uid, payload);
  } catch (error) {
    console.warn("Error agregando examen:", error);
    return { ok: true };
  }
}

export async function getDrugs(session, mode) {
  if (mode === "demo" || !session) {
    return demoDrugCatalog;
  }

  try {
    return await firestore.getDrugs();
  } catch (error) {
    console.warn("Error cargando fármacos:", error);
    return demoDrugCatalog;
  }
}

export async function getMedications(session, mode) {
  if (mode === "demo" || !session) {
    return [];
  }

  try {
    return await firestore.getMedications(session.uid);
  } catch (error) {
    console.warn("Error cargando medicamentos:", error);
    return [];
  }
}

export async function addMedication(session, mode, payload) {
  if (mode === "demo" || !session) {
    return { ok: true };
  }

  try {
    return await firestore.addMedication(session.uid, payload);
  } catch (error) {
    console.warn("Error agregando medicamento:", error);
    return { ok: true };
  }
}

export async function getAdministrationLog(session, mode) {
  if (mode === "demo" || !session) {
    return [];
  }

  try {
    return await firestore.getAdministrationLog(session.uid);
  } catch (error) {
    console.warn("Error cargando registro:", error);
    return [];
  }
}

export async function logAdministration(session, mode, payload) {
  if (mode === "demo" || !session) {
    return { ok: true };
  }

  try {
    return await firestore.logAdministration(session.uid, payload);
  } catch (error) {
    console.warn("Error registrando dosis:", error);
    return { ok: true };
  }
}

export async function getBodyMapSites(session, mode) {
  if (mode === "demo" || !session) {
    return [];
  }

  try {
    return await firestore.getBodyMapSites(session.uid);
  } catch (error) {
    console.warn("Error cargando mapa corporal:", error);
    return [];
  }
}
