/**
 * TransCycle & Health — Servidor principal
 * Node.js + Express + PostgreSQL
 */

import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { checkConnection } from "./db/pool";
import authRouter from "./routes/auth";
import hrtRouter from "./routes/hrt";
import cycleRouter from "./routes/cycle";
import { analyticsRouter, diaryRouter } from "./routes/analyticsAndDiary";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// ── Seguridad ─────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'"],
      imgSrc:     ["'self'", "data:"],
    },
  },
}));

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean),
  credentials: true,
}));

// Rate limiting global
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
  max:      Number(process.env.RATE_LIMIT_MAX ?? 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta más tarde." },
}));

// Rate limiting más estricto para auth
app.use("/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Demasiados intentos de autenticación." },
}));

app.use(express.json({ limit: "2mb" }));

// ── Health check ──────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ── Rutas ─────────────────────────────────────────

app.use("/auth",      authRouter);
app.use("/hrt",       hrtRouter);
app.use("/cycle",     cycleRouter);
app.use("/analytics", analyticsRouter);
app.use("/diary",     diaryRouter);

// ── 404 ───────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// ── Error handler global ──────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Error interno del servidor" });
});

// ── Arranque ──────────────────────────────────────

async function start() {
  try {
    await checkConnection();
    app.listen(PORT, () => {
      console.log(`\n  TransCycle API corriendo en http://localhost:${PORT}`);
      console.log(`  Entorno: ${process.env.NODE_ENV ?? "development"}\n`);
    });
  } catch (err: any) {
    console.error("[FATAL] No se pudo conectar a la BD:", err.message);
    process.exit(1);
  }
}

start();

export default app;
