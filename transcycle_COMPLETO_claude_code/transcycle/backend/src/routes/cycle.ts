/**
 * TransCycle — Rutas de Ciclo Virtual y Síntomas
 *
 * GET  /cycle/current          — estado del ciclo hoy
 * GET  /cycle/profile          — perfil completo del ciclo virtual
 * POST /cycle/rebuild          — recalcular el ciclo con datos actuales
 *
 * GET  /cycle/symptoms         — historial de síntomas
 * POST /cycle/symptoms         — registrar entrada de síntomas
 *
 * GET  /cycle/plasma           — curva plasmática calculada
 * GET  /cycle/dashboard-ring   — datos para el anillo del dashboard
 */

import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { encrypt, safeDecrypt } from "../services/encryption";
import {
  buildVirtualCycle,
  getTodayCycleStatus,
  getDashboardRingData,
  type NormalizationInput,
} from "../../src_algo/virtualCycle";

const router = Router();
router.use(requireAuth);

// ── Schemas ───────────────────────────────────────

const SymptomSchema = z.object({
  loggedAt: z.string().datetime(),
  moodScore: z.number().int().min(1).max(10),
  breastTenderness: z.number().int().min(1).max(10),
  fatigueLevel: z.number().int().min(1).max(10),
  digestiveChanges: z.number().int().min(1).max(10),
  libidoScore: z.number().int().min(1).max(10),
  skinChanges: z.number().int().min(1).max(10),
  brainFog: z.number().int().min(1).max(10),
  emotionalLability: z.number().int().min(1).max(10),
  freetext: z.string().max(2000).optional(),
});

// ── Helpers ───────────────────────────────────────

async function getCycleAnchor(userId: string): Promise<Date | null> {
  const rows = await query<{ cycle_start_date: Date }>(
    `SELECT cycle_start_date FROM virtual_cycle
     WHERE user_id = $1 ORDER BY cycle_number DESC LIMIT 1`,
    [userId]
  );
  return rows[0]?.cycle_start_date ?? null;
}

async function getPlasmaPoints(userId: string, fromDate: Date, toDate: Date) {
  return query(
    `SELECT pl.calculated_at, pl.hours_post_dose, pl.level_value,
            pl.level_unit, dp.drug_key
     FROM plasma_levels pl
     JOIN administration_log al ON al.id = pl.administration_id
     JOIN hrt_medications m ON m.id = al.medication_id
     JOIN drug_profiles dp ON dp.id = m.drug_profile_id
     WHERE pl.user_id = $1
       AND pl.calculated_at BETWEEN $2 AND $3
     ORDER BY pl.calculated_at`,
    [userId, fromDate, toDate]
  );
}

async function getSymptomEntries(userId: string, fromDate: Date, toDate: Date) {
  return query(
    `SELECT logged_at, mood_score, breast_tenderness, fatigue_level,
            digestive_changes, libido_score, skin_changes,
            brain_fog, emotional_lability
     FROM symptom_log
     WHERE user_id = $1 AND logged_at BETWEEN $2 AND $3
     ORDER BY logged_at`,
    [userId, fromDate, toDate]
  );
}

// ── GET /cycle/current ────────────────────────────

router.get("/current", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const anchor = await getCycleAnchor(userId);

    if (!anchor) {
      return res.status(404).json({
        error: "No hay ciclo activo. Registra al menos una dosis para comenzar.",
      });
    }

    // Cargar el perfil del ciclo desde la BD (snapshot guardado)
    const profileRows = await query(
      `SELECT * FROM virtual_cycle WHERE user_id = $1
       ORDER BY cycle_number DESC LIMIT 1`,
      [userId]
    );

    if (!profileRows[0]?.phase_pattern_json) {
      return res.status(202).json({
        message: "El ciclo se está calculando. Vuelve en unos momentos.",
      });
    }

    const profile = profileRows[0].phase_pattern_json;
    const status = getTodayCycleStatus(profile, new Date(anchor));

    return res.json({
      ...status,
      cycleNumber: profileRows[0].cycle_number,
      confidenceScore: profileRows[0].confidence_score,
      ghostPeriod: profile.ghostPeriod,
    });
  } catch (err: any) {
    console.error("[cycle/current]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /cycle/rebuild ───────────────────────────

router.post("/rebuild", async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Determinar ventana del ciclo actual (últimos 28 días)
    const now = new Date();
    const fromDate = new Date(now.getTime() - 28 * 24 * 3_600_000);

    const [plasmaRaw, symptomsRaw, medRows] = await Promise.all([
      getPlasmaPoints(userId, fromDate, now),
      getSymptomEntries(userId, fromDate, now),
      query("SELECT drug_key FROM hrt_medications m JOIN drug_profiles dp ON dp.id = m.drug_profile_id WHERE m.user_id = $1 AND m.is_active = true", [userId]),
    ]);

    // Formatear para el algoritmo
    const plasmaPoints = plasmaRaw.map((r: any) => ({
      calculatedAt: new Date(r.calculated_at),
      hoursPostDose: Number(r.hours_post_dose),
      levelValue: Number(r.level_value),
      levelUnit: r.level_unit,
      drugKey: r.drug_key,
      phase: null,
      virtualCycleDay: null,
    }));

    const symptomEntries = symptomsRaw.map((r: any) => ({
      loggedAt: new Date(r.logged_at),
      moodScore: r.mood_score,
      breastTenderness: r.breast_tenderness,
      fatigueLevel: r.fatigue_level,
      digestiveChanges: r.digestive_changes,
      libidoScore: r.libido_score,
      skinChanges: r.skin_changes,
      brainFog: r.brain_fog,
      emotionalLability: r.emotional_lability,
    }));

    const input: NormalizationInput = {
      plasmaPoints,
      symptomEntries,
      cycleAnchorDate: fromDate,
      cycleLengthDays: 28,
      drugRegimen: medRows.map((r: any) => r.drug_key),
    };

    const profile = buildVirtualCycle(input, userId);

    // Guardar/actualizar en BD
    await query(
      `INSERT INTO virtual_cycle
         (user_id, cycle_number, cycle_start_date, follicular_days, luteal_days,
          avg_peak_e2, avg_trough_e2, phase_pattern_json, confidence_score)
       VALUES ($1, 1, $2, 14, 14, $3, $4, $5, $6)
       ON CONFLICT (user_id, cycle_number) DO UPDATE
       SET phase_pattern_json = $5,
           confidence_score   = $6,
           avg_peak_e2        = $3,
           avg_trough_e2      = $4`,
      [
        userId,
        fromDate,
        Math.max(...profile.days.map((d) => d.avgE2Level), 0),
        Math.min(...profile.days.filter((d) => d.avgE2Level > 0).map((d) => d.avgE2Level), Infinity) || 0,
        JSON.stringify(profile),
        profile.confidenceScore,
      ]
    );

    return res.json({
      ok: true,
      confidenceScore: profile.confidenceScore,
      ghostPeriod: profile.ghostPeriod,
      insights: profile.insights,
    });
  } catch (err: any) {
    console.error("[cycle/rebuild]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /cycle/symptoms ──────────────────────────

router.post("/symptoms", validate(SymptomSchema), async (req, res) => {
  try {
    const {
      loggedAt, moodScore, breastTenderness, fatigueLevel,
      digestiveChanges, libidoScore, skinChanges, brainFog,
      emotionalLability, freetext,
    } = req.body;

    const freetextEncrypted = freetext ? encrypt(freetext) : null;

    await query(
      `INSERT INTO symptom_log
         (user_id, logged_at, mood_score, breast_tenderness, fatigue_level,
          digestive_changes, libido_score, skin_changes, brain_fog,
          emotional_lability, freetext_encrypted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        req.user!.userId, new Date(loggedAt),
        moodScore, breastTenderness, fatigueLevel,
        digestiveChanges, libidoScore, skinChanges,
        brainFog, emotionalLability, freetextEncrypted,
      ]
    );

    return res.status(201).json({ ok: true });
  } catch (err: any) {
    console.error("[cycle/symptoms POST]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /cycle/symptoms ───────────────────────────

router.get("/symptoms", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 30), 90);
    const rows = await query(
      `SELECT id, logged_at, mood_score, breast_tenderness, fatigue_level,
              digestive_changes, libido_score, skin_changes, brain_fog,
              emotional_lability, virtual_cycle_day, phase
       FROM symptom_log
       WHERE user_id = $1
       ORDER BY logged_at DESC LIMIT $2`,
      [req.user!.userId, limit]
    );
    return res.json(rows);
  } catch (err: any) {
    console.error("[cycle/symptoms GET]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /cycle/plasma ─────────────────────────────

router.get("/plasma", async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days ?? 14), 90);
    const fromDate = new Date(Date.now() - days * 24 * 3_600_000);

    const rows = await query(
      `SELECT pl.calculated_at, pl.level_value, pl.level_unit,
              dp.drug_key, dp.display_name, dp.category
       FROM plasma_levels pl
       JOIN administration_log al ON al.id = pl.administration_id
       JOIN hrt_medications m ON m.id = al.medication_id
       JOIN drug_profiles dp ON dp.id = m.drug_profile_id
       WHERE pl.user_id = $1 AND pl.calculated_at >= $2
       ORDER BY pl.calculated_at, dp.category`,
      [req.user!.userId, fromDate]
    );

    return res.json(rows);
  } catch (err: any) {
    console.error("[cycle/plasma]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /cycle/dashboard-ring ─────────────────────

router.get("/dashboard-ring", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const profileRows = await query(
      `SELECT phase_pattern_json, confidence_score, cycle_start_date
       FROM virtual_cycle WHERE user_id = $1
       ORDER BY cycle_number DESC LIMIT 1`,
      [userId]
    );

    if (!profileRows[0]?.phase_pattern_json) {
      return res.status(404).json({ error: "Sin ciclo calculado aún" });
    }

    const profile = profileRows[0].phase_pattern_json;
    const ring = getDashboardRingData(profile);
    const status = getTodayCycleStatus(
      profile,
      new Date(profileRows[0].cycle_start_date)
    );

    return res.json({ ring, status, confidenceScore: profileRows[0].confidence_score });
  } catch (err: any) {
    console.error("[cycle/dashboard-ring]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
