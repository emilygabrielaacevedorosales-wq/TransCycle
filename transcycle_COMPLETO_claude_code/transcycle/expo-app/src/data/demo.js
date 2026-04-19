const today = new Date();

export const demoUser = {
  id: "demo-user",
  email: "demo@transcycle.app",
  display_name: "Demo",
  pronouns: "ella/ella",
  timezone: "America/Santiago",
  discrete_mode_enabled: false,
};

export const demoCycleStatus = {
  currentDay: 18,
  phase: "luteal_early",
  e2Trend: "falling",
  daysUntilGhostPeriod: 4,
  confidenceScore: 0.76,
  cycleNumber: 3,
  ghostPeriod: {
    startDay: 22,
    endDay: 26,
  },
};

export const demoRing = Array.from({ length: 28 }, (_, index) => {
  const day = index + 1;
  let phase = "trough";
  if (day <= 5) phase = "follicular_early";
  else if (day <= 11) phase = "follicular_late";
  else if (day <= 14) phase = "ovulation_virtual";
  else if (day <= 21) phase = "luteal_early";
  else if (day <= 24) phase = "luteal_late";

  return {
    day,
    phase,
    isGhostPeriod: day >= 25 && day <= 28,
  };
});

export const demoSymptoms = [
  {
    id: "sym-1",
    logged_at: today.toISOString(),
    mood_score: 7,
    breast_tenderness: 5,
    fatigue_level: 4,
    digestive_changes: 3,
    libido_score: 6,
    skin_changes: 5,
    brain_fog: 2,
    emotional_lability: 4,
    virtual_cycle_day: 18,
    phase: "luteal_early",
  },
  {
    id: "sym-2",
    logged_at: new Date(today.getTime() - 86400000).toISOString(),
    mood_score: 6,
    breast_tenderness: 4,
    fatigue_level: 5,
    digestive_changes: 3,
    libido_score: 6,
    skin_changes: 4,
    brain_fog: 3,
    emotional_lability: 5,
    virtual_cycle_day: 17,
    phase: "luteal_early",
  },
  {
    id: "sym-3",
    logged_at: new Date(today.getTime() - 2 * 86400000).toISOString(),
    mood_score: 8,
    breast_tenderness: 3,
    fatigue_level: 3,
    digestive_changes: 2,
    libido_score: 7,
    skin_changes: 5,
    brain_fog: 2,
    emotional_lability: 3,
    virtual_cycle_day: 16,
    phase: "ovulation_virtual",
  },
];

export const demoDiaryEntries = [
  {
    id: "dia-1",
    entryDate: today.toISOString().slice(0, 10),
    wellbeingScore: 8,
    virtualCycleDay: 18,
    phase: "luteal_early",
    bodyChanges: "Pecho sensible y un poco mas de retencion de liquidos.",
    emotionalNotes: "Dia estable, con energia media y foco aceptable.",
  },
  {
    id: "dia-2",
    entryDate: new Date(today.getTime() - 86400000).toISOString().slice(0, 10),
    wellbeingScore: 7,
    virtualCycleDay: 17,
    phase: "luteal_early",
    bodyChanges: "Dormi bien, pero senti fatiga ligera por la tarde.",
    emotionalNotes: "Mas sensible de lo normal, pero manejable.",
  },
];

export const demoBloodTests = [
  {
    id: "lab-1",
    test_date: new Date(today.getTime() - 15 * 86400000).toISOString(),
    estradiol_pg_ml: 173,
    testosterone_ng_dl: 29,
    progesterone_ng_ml: 1.8,
    hours_since_last_dose: 10,
    lab_name: "Laboratorio demo",
  },
  {
    id: "lab-2",
    test_date: new Date(today.getTime() - 43 * 86400000).toISOString(),
    estradiol_pg_ml: 156,
    testosterone_ng_dl: 34,
    progesterone_ng_ml: 1.3,
    hours_since_last_dose: 12,
    lab_name: "Laboratorio demo",
  },
];

export const demoDrugCatalog = [
  { drug_key: "estradiol_sublingual", display_name: "Estradiol sublingual", category: "estrogen" },
  { drug_key: "estradiol_valerate_im", display_name: "Valerato de estradiol IM", category: "estrogen" },
  { drug_key: "progesterone_rectal", display_name: "Progesterona micronizada", category: "progesterone" },
  { drug_key: "spironolactone_oral", display_name: "Espironolactona", category: "antiandrogen" },
];
