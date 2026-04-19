/**
 * TransCycle — Análisis y Diario
 *
 * GET  /analytics/blood-tests         — historial de exámenes
 * POST /analytics/blood-tests         — cargar nuevo examen
 * GET  /analytics/trends              — tendencias E2/T/P4 vs dosis
 *
 * GET  /diary                         — entradas del diario
 * POST /diary                         — nueva entrada
 * GET  /diary/:date                   — entrada de una fecha
 */

import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { encrypt, safeDecrypt, encryptJson, decryptJson } from "../services/encryption";

// ── Analytics ─────────────────────────────────────

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const BloodTestSchema = z.object({
  testDate: z.string().datetime(),
  labName: z.string().max(100).optional(),
  estradiolPgMl: z.number().positive().optional(),
  testosteroneNgDl: z.number().positive().optional(),
  prolactinNgMl: z.number().positive().optional(),
  lhMiuMl: z.number().positive().optional(),
  fshMiuMl: z.number().positive().optional(),
  progesteroneNgMl: z.number().positive().optional(),
  shbgNmolL: z.number().positive().optional(),
  hoursSinceLastDose: z.number().min(0).optional(),
  labNotes: z.string().max(2000).optional(),
});

analyticsRouter.post("/blood-tests", validate(BloodTestSchema), async (req, res) => {
  try {
    const {
      testDate, labName,
      estradiolPgMl, testosteroneNgDl, prolactinNgMl,
      lhMiuMl, fshMiuMl, progesteroneNgMl, shbgNmolL,
      hoursSinceLastDose, labNotes,
    } = req.body;

    const labNotesEncrypted = labNotes ? encrypt(labNotes) : null;

    const rows = await query<{ id: string }>(
      `INSERT INTO blood_tests
         (user_id, test_date, lab_name,
          estradiol_pg_ml, testosterone_ng_dl, prolactin_ng_ml,
          lh_miu_ml, fsh_miu_ml, progesterone_ng_ml, shbg_nmol_l,
          hours_since_last_dose, lab_notes_encrypted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        req.user!.userId, new Date(testDate), labName ?? null,
        estradiolPgMl ?? null, testosteroneNgDl ?? null, prolactinNgMl ?? null,
        lhMiuMl ?? null, fshMiuMl ?? null, progesteroneNgMl ?? null, shbgNmolL ?? null,
        hoursSinceLastDose ?? null, labNotesEncrypted,
      ]
    );
    return res.status(201).json({ id: rows[0].id });
  } catch (err: any) {
    console.error("[analytics/blood-tests POST]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

analyticsRouter.get("/blood-tests", async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, test_date, lab_name,
              estradiol_pg_ml, testosterone_ng_dl, prolactin_ng_ml,
              lh_miu_ml, fsh_miu_ml, progesterone_ng_ml, shbg_nmol_l,
              hours_since_last_dose, created_at
       FROM blood_tests
       WHERE user_id = $1
       ORDER BY test_date DESC LIMIT 50`,
      [req.user!.userId]
    );
    return res.json(rows);
  } catch (err: any) {
    console.error("[analytics/blood-tests GET]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// Tendencias: une exámenes con dosis del mismo período
analyticsRouter.get("/trends", async (req, res) => {
  try {
    const rows = await query(
      `SELECT
         bt.test_date,
         bt.estradiol_pg_ml,
         bt.testosterone_ng_dl,
         bt.progesterone_ng_ml,
         bt.hours_since_last_dose,
         (SELECT SUM(al.actual_dose)
          FROM administration_log al
          JOIN hrt_medications m ON m.id = al.medication_id
          JOIN drug_profiles dp ON dp.id = m.drug_profile_id
          WHERE al.user_id = bt.user_id
            AND dp.category = 'estrogen'
            AND al.administered_at BETWEEN bt.test_date - INTERVAL '7 days' AND bt.test_date
         ) AS weekly_e2_dose
       FROM blood_tests bt
       WHERE bt.user_id = $1
       ORDER BY bt.test_date`,
      [req.user!.userId]
    );
    return res.json(rows);
  } catch (err: any) {
    console.error("[analytics/trends]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── Diary ─────────────────────────────────────────

export const diaryRouter = Router();
diaryRouter.use(requireAuth);

const DiarySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  wellbeingScore: z.number().int().min(1).max(10),
  bodyChanges: z.string().max(5000).optional(),
  emotionalNotes: z.string().max(5000).optional(),
  photoUrls: z.array(z.string().url()).optional(),
});

diaryRouter.post("/", validate(DiarySchema), async (req, res) => {
  try {
    const { entryDate, wellbeingScore, bodyChanges, emotionalNotes, photoUrls } = req.body;

    const bodyEncrypted   = bodyChanges    ? encrypt(bodyChanges)           : null;
    const emotEncrypted   = emotionalNotes ? encrypt(emotionalNotes)        : null;
    const photosEncrypted = photoUrls      ? encryptJson(photoUrls)         : null;

    await query(
      `INSERT INTO evolution_diary
         (user_id, entry_date, wellbeing_score,
          body_changes_encrypted, emotional_notes_encrypted, photo_urls_encrypted)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, entry_date) DO UPDATE
       SET wellbeing_score            = $3,
           body_changes_encrypted     = $4,
           emotional_notes_encrypted  = $5,
           photo_urls_encrypted       = $6`,
      [
        req.user!.userId, entryDate, wellbeingScore,
        bodyEncrypted, emotEncrypted, photosEncrypted,
      ]
    );
    return res.status(201).json({ ok: true });
  } catch (err: any) {
    console.error("[diary POST]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

diaryRouter.get("/", async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, entry_date, wellbeing_score, virtual_cycle_day, phase,
              body_changes_encrypted, emotional_notes_encrypted
       FROM evolution_diary
       WHERE user_id = $1
       ORDER BY entry_date DESC LIMIT 60`,
      [req.user!.userId]
    );

    const result = rows.map((r: any) => ({
      id: r.id,
      entryDate: r.entry_date,
      wellbeingScore: r.wellbeing_score,
      virtualCycleDay: r.virtual_cycle_day,
      phase: r.phase,
      bodyChanges:    safeDecrypt(r.body_changes_encrypted),
      emotionalNotes: safeDecrypt(r.emotional_notes_encrypted),
    }));

    return res.json(result);
  } catch (err: any) {
    console.error("[diary GET]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

diaryRouter.get("/:date", async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM evolution_diary
       WHERE user_id = $1 AND entry_date = $2`,
      [req.user!.userId, req.params.date]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Sin entrada para esa fecha" });

    const r = rows[0] as any;
    return res.json({
      id: r.id,
      entryDate: r.entry_date,
      wellbeingScore: r.wellbeing_score,
      virtualCycleDay: r.virtual_cycle_day,
      phase: r.phase,
      bodyChanges:    safeDecrypt(r.body_changes_encrypted),
      emotionalNotes: safeDecrypt(r.emotional_notes_encrypted),
      photoUrls:      r.photo_urls_encrypted ? decryptJson(r.photo_urls_encrypted) : [],
    });
  } catch (err: any) {
    console.error("[diary/:date]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});
