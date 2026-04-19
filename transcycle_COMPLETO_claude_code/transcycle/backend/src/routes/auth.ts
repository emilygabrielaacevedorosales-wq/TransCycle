/**
 * TransCycle — Rutas de autenticación
 * POST /auth/register
 * POST /auth/login
 * POST /auth/refresh
 * GET  /auth/me
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db/pool";
import { signToken, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// ── Schemas ───────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  displayName: z.string().min(1).max(80),
  pronouns: z.string().max(40).optional(),
  timezone: z.string().default("America/Santiago"),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── POST /auth/register ───────────────────────────

router.post("/register", validate(RegisterSchema), async (req, res) => {
  try {
    const { email, password, displayName, pronouns, timezone } = req.body;

    const existing = await query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email ya registrado" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const rows = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, display_name, pronouns, timezone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [email.toLowerCase(), passwordHash, displayName, pronouns ?? null, timezone]
    );

    const userId = rows[0].id;
    const token = signToken({
      userId,
      email: email.toLowerCase(),
      discreteMode: false,
    });

    return res.status(201).json({ token, userId });
  } catch (err: any) {
    console.error("[auth/register]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /auth/login ──────────────────────────────

router.post("/login", validate(LoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const rows = await query<{
      id: string;
      password_hash: string;
      discrete_mode_enabled: boolean;
    }>(
      `SELECT id, password_hash, discrete_mode_enabled
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const token = signToken({
      userId: user.id,
      email: email.toLowerCase(),
      discreteMode: user.discrete_mode_enabled,
    });

    return res.json({ token, userId: user.id });
  } catch (err: any) {
    console.error("[auth/login]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /auth/me ──────────────────────────────────

router.get("/me", requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, email, display_name, pronouns, timezone,
              discrete_mode_enabled, discrete_app_name, biometric_lock
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.json(rows[0]);
  } catch (err: any) {
    console.error("[auth/me]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ── PATCH /auth/discrete-mode ─────────────────────

router.patch("/discrete-mode", requireAuth, async (req, res) => {
  const { enabled, appName, iconKey } = req.body;
  try {
    await query(
      `UPDATE users
       SET discrete_mode_enabled = $1,
           discrete_app_name     = COALESCE($2, discrete_app_name),
           discrete_icon_key     = COALESCE($3, discrete_icon_key)
       WHERE id = $4`,
      [Boolean(enabled), appName ?? null, iconKey ?? null, req.user!.userId]
    );
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[auth/discrete-mode]", err.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
