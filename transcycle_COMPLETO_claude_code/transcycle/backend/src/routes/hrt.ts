/**
 * TransCycle — Rutas de TRH
 *
 * GET    /hrt/drugs                    — catálogo de fármacos
 * GET    /hrt/medications              — medicamentos de la usuaria
 * POST   /hrt/medications              — agregar medicamento
 * PATCH  /hrt/medications/:id          — editar dosis / frecuencia
 * DELETE /hrt/medications/:id          — desactivar medicamento
 *
 * GET    /hrt/log                      — historial de tomas
 * POST   /hrt/log                      — registrar toma
 *
 * GET    /hrt/body-map                 — mapa de sitios corporales
 * GET    /hrt/body-map/next-site/:medId — siguiente sitio recomendado
 * PATCH  /hrt/body-map/:siteCode       — actualizar sitio
 *
 * GET    /hrt/stock-alerts             — medicamentos con stock bajo
 * PATCH  /hrt/medications/:id/stock    — actualizar stock
 */

import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { encrypt, safeDecrypt } from "../services/encryption";
import { generatePlasmaTimeSeries, DRUG_PROFILES } from "../../src_algo/pharmacokinetics";

const router = Router();
router.use(requireAuth);

// ── Schemas ───────────────────────────────────────

const AddMedicationSchema = z.object({
  drugProfileId: z.string().uuid(),
  doseAmount: z.number().positive(),
  doseUnit: z.string().default("mg"),
  frequencyHours: z.number().positive(),
  preferredTimes: z.array(z.string()).optional(),
  stockUnits: z.number().min(0).default(0),
  stockAlertThreshold: z.number().min(0).default(7),
  startDate: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

const LogDoseSchema = z.object({
  medicationId: z.string().uuid(),
  administeredAt: z.string().datetime(),
  actualDose: z.number().positive(),
  bodySite: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// ── GET /hrt/drugs ────────────────────────────────

router.get("/drugs", async (_req, res) => {
  try {
    const rows = await query(
      `SELECT id, drug_key, display_name, category, route,
              half_life_hours, peak_hours, cmax_unit, notes
       FROM drug_profiles WHERE is_active = true
       ORDER BY category, display_name`
    );
    return res.json(rows);
  } catch (err: any) {
    console.error("[hrt/drugs]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /hrt/medications ──────────────────────────

router.get("/medications", async (req, res) => {
  try {
    const rows = await query(
      `SELECT m.*, dp.drug_key, dp.display_name, dp.category,
              dp.route, dp.half_life_hours, dp.peak_hours
       FROM hrt_medications m
       JOIN drug_profiles dp ON dp.id = m.drug_profile_id
       WHERE m.user_id = $1 AND m.is_active = true
       ORDER BY m.created_at`,
      [req.user!.userId]
    );

    const result = rows.map((r) => ({
      ...r,
      notes: r.notes_encrypted ? safeDecrypt(r.notes_encrypted) : null,
      notes_encrypted: undefined,
    }));

    return res.json(result);
  } catch (err: any) {
    console.error("[hrt/medications]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /hrt/medications ─────────────────────────

router.post("/medications", validate(AddMedicationSchema), async (req, res) => {
  try {
    const {
      drugProfileId, doseAmount, doseUnit, frequencyHours,
      preferredTimes, stockUnits, stockAlertThreshold, startDate, notes,
    } = req.body;

    const notesEncrypted = notes ? encrypt(notes) : null;

    const rows = await query<{ id: string }>(
      `INSERT INTO hrt_medications
         (user_id, drug_profile_id, dose_amount, dose_unit, frequency_hours,
          preferred_times, stock_units, stock_alert_threshold, start_date, notes_encrypted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        req.user!.userId, drugProfileId, doseAmount, doseUnit,
        frequencyHours, preferredTimes ?? null,
        stockUnits, stockAlertThreshold,
        new Date(startDate), notesEncrypted,
      ]
    );

    // Inicializar sitios corporales para fármacos inyectables/parche
    const drugRows = await query<{ route: string }>(
      "SELECT route FROM drug_profiles WHERE id = $1",
      [drugProfileId]
    );
    const route = drugRows[0]?.route;
    if (route === "intramuscular" || route === "transdermal_patch") {
      const sites = route === "intramuscular"
        ? ["glut_left","glut_right","quad_left","quad_right","delt_left","delt_right"]
        : ["abd_upper_left","abd_upper_right","abd_lower_left","abd_lower_right",
           "back_left","back_right","arm_left","arm_right"];

      for (const site of sites) {
        await query(
          `INSERT INTO body_map_sites (user_id, medication_id, site_code)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [req.user!.userId, rows[0].id, site]
        );
      }
    }

    return res.status(201).json({ id: rows[0].id });
  } catch (err: any) {
    console.error("[hrt/medications POST]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /hrt/log ─────────────────────────────────

router.post("/log", validate(LogDoseSchema), async (req, res) => {
  try {
    const { medicationId, administeredAt, actualDose, bodySite, notes } = req.body;

    // Verificar que el medicamento pertenece a la usuaria
    const medRows = await query(
      "SELECT id, drug_profile_id, frequency_hours FROM hrt_medications WHERE id = $1 AND user_id = $2",
      [medicationId, req.user!.userId]
    );
    if (medRows.length === 0) {
      return res.status(404).json({ error: "Medicamento no encontrado" });
    }

    const med = medRows[0];
    const adminTime = new Date(administeredAt);
    const notesEncrypted = notes ? encrypt(notes) : null;

    await withTransaction(async (client) => {
      // 1. Insertar en log
      const logRows = await client.query(
        `INSERT INTO administration_log
           (user_id, medication_id, administered_at, actual_dose,
            body_site, notes_encrypted, reminder_sent)
         VALUES ($1,$2,$3,$4,$5,$6,false)
         RETURNING id`,
        [req.user!.userId, medicationId, adminTime, actualDose,
         bodySite ?? null, notesEncrypted]
      );
      const logId = logRows.rows[0].id;

      // 2. Actualizar sitio corporal si aplica
      if (bodySite) {
        await client.query(
          `UPDATE body_map_sites
           SET last_used_at = $1, use_count = use_count + 1,
               is_resting = true,
               available_from = ($1::date + rest_days_required * INTERVAL '1 day')
           WHERE user_id = $2 AND medication_id = $3 AND site_code = $4`,
          [adminTime, req.user!.userId, medicationId, bodySite]
        );
      }

      // 3. Actualizar stock
      await client.query(
        `UPDATE hrt_medications
         SET stock_units = GREATEST(stock_units - 1, 0)
         WHERE id = $1`,
        [medicationId]
      );

      // 4. Calcular puntos plasmáticos (próximas 48h)
      const drugRows = await client.query(
        "SELECT drug_key, cmax_per_unit FROM drug_profiles WHERE id = $1",
        [med.drug_profile_id]
      );
      const drugKey = drugRows.rows[0]?.drug_key;

      if (drugKey && DRUG_PROFILES[drugKey as keyof typeof DRUG_PROFILES]) {
        const endTime = new Date(adminTime.getTime() + 48 * 3_600_000);
        const doseEvent = [{
          administeredAt: adminTime,
          doseAmountMg: actualDose,
          drugKey: drugKey as any,
        }];
        const points = generatePlasmaTimeSeries(doseEvent, drugKey as any, adminTime, endTime);

        for (const pt of points) {
          await client.query(
            `INSERT INTO plasma_levels
               (user_id, administration_id, drug_profile_id,
                calculated_at, hours_post_dose, level_value, level_unit)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              req.user!.userId, logId, med.drug_profile_id,
              pt.calculatedAt, pt.hoursPostDose,
              pt.levelValue, pt.levelUnit,
            ]
          );
        }
      }

      return logId;
    });

    return res.status(201).json({ ok: true });
  } catch (err: any) {
    console.error("[hrt/log POST]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /hrt/log ──────────────────────────────────

router.get("/log", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);

    const rows = await query(
      `SELECT al.id, al.administered_at, al.actual_dose, al.body_site,
              al.was_late, al.late_minutes,
              dp.display_name, dp.drug_key, dp.route
       FROM administration_log al
       JOIN hrt_medications m ON m.id = al.medication_id
       JOIN drug_profiles dp ON dp.id = m.drug_profile_id
       WHERE al.user_id = $1
       ORDER BY al.administered_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.userId, limit, offset]
    );

    return res.json(rows);
  } catch (err: any) {
    console.error("[hrt/log GET]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /hrt/body-map ─────────────────────────────

router.get("/body-map", async (req, res) => {
  try {
    const rows = await query(
      `SELECT bms.*, m.drug_profile_id, dp.display_name
       FROM body_map_sites bms
       JOIN hrt_medications m ON m.id = bms.medication_id
       JOIN drug_profiles dp ON dp.id = m.drug_profile_id
       WHERE bms.user_id = $1
       ORDER BY bms.medication_id, bms.site_code`,
      [req.user!.userId]
    );
    return res.json(rows);
  } catch (err: any) {
    console.error("[hrt/body-map]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /hrt/body-map/next-site/:medId ────────────

router.get("/body-map/next-site/:medId", async (req, res) => {
  try {
    // El sitio recomendado es el disponible con menor uso reciente
    const rows = await query(
      `SELECT site_code, use_count, last_used_at, is_resting, available_from
       FROM body_map_sites
       WHERE user_id = $1 AND medication_id = $2
         AND (is_resting = false OR available_from <= CURRENT_DATE)
       ORDER BY last_used_at ASC NULLS FIRST, use_count ASC
       LIMIT 1`,
      [req.user!.userId, req.params.medId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "No hay sitios disponibles. Todos están en descanso.",
      });
    }

    return res.json(rows[0]);
  } catch (err: any) {
    console.error("[hrt/body-map/next-site]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /hrt/stock-alerts ─────────────────────────

router.get("/stock-alerts", async (req, res) => {
  try {
    const rows = await query(
      `SELECT m.id, m.stock_units, m.stock_alert_threshold,
              dp.display_name, dp.drug_key
       FROM hrt_medications m
       JOIN drug_profiles dp ON dp.id = m.drug_profile_id
       WHERE m.user_id = $1
         AND m.is_active = true
         AND m.stock_units <= m.stock_alert_threshold`,
      [req.user!.userId]
    );
    return res.json(rows);
  } catch (err: any) {
    console.error("[hrt/stock-alerts]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── PATCH /hrt/medications/:id/stock ─────────────

router.patch("/medications/:id/stock", async (req, res) => {
  const { units } = req.body;
  if (typeof units !== "number" || units < 0) {
    return res.status(400).json({ error: "units debe ser número >= 0" });
  }
  try {
    await query(
      `UPDATE hrt_medications SET stock_units = $1
       WHERE id = $2 AND user_id = $3`,
      [units, req.params.id, req.user!.userId]
    );
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[hrt/stock PATCH]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
