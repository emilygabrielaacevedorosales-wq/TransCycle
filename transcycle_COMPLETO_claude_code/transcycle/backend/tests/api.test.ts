/**
 * TransCycle — Tests del backend (lógica sin BD)
 * Valida cifrado, auth, schemas de validación y helpers de rutas.
 * No requiere PostgreSQL corriendo.
 *
 * Ejecutar: TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node tests/api.test.ts
 */

process.env.ENCRYPTION_MASTER_KEY = "a".repeat(64); // 32 bytes hex para tests
process.env.JWT_SECRET = "test-secret-para-transcycle-2025";
process.env.JWT_EXPIRES_IN = "1h";

import assert from "assert";
import { encrypt, decrypt, encryptJson, decryptJson, safeDecrypt } from "../src/services/encryption";
import { signToken } from "../src/middleware/auth";
import jwt from "jsonwebtoken";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────
// Cifrado AES-256-GCM
// ─────────────────────────────────────────────
console.log("\nCifrado AES-256-GCM");

test("cifra y descifra un string correctamente", () => {
  const original = "Notas médicas confidenciales de la usuaria";
  const buf = encrypt(original);
  assert.equal(decrypt(buf), original);
});

test("dos cifrados del mismo texto producen buffers distintos (IV aleatorio)", () => {
  const text = "misma nota";
  const buf1 = encrypt(text);
  const buf2 = encrypt(text);
  assert.notEqual(buf1.toString("hex"), buf2.toString("hex"));
});

test("buffer mínimo es IV(12) + Tag(16) + al menos 1 byte = 29 bytes", () => {
  const buf = encrypt("x");
  assert.ok(buf.length >= 29, `buffer de ${buf.length} bytes es demasiado corto`);
});

test("cifra y descifra un objeto JSON", () => {
  const obj = { photoUrls: ["https://cdn.example.com/img1.jpg", "https://cdn.example.com/img2.jpg"] };
  const buf = encryptJson(obj);
  const result = decryptJson<typeof obj>(buf);
  assert.deepEqual(result, obj);
});

test("cifra y descifra texto con caracteres especiales y emojis", () => {
  const text = "Día 14: me sentí muy bien ✨ — nivel de energía: 9/10";
  assert.equal(decrypt(encrypt(text)), text);
});

test("safeDecrypt devuelve null para buffer null", () => {
  assert.equal(safeDecrypt(null), null);
});

test("safeDecrypt devuelve null para buffer corrupto", () => {
  const corrupt = Buffer.from("datos_corruptos_que_no_son_cifrado_valido");
  assert.equal(safeDecrypt(corrupt), null);
});

test("descifrar buffer alterado lanza error (integridad GCM)", () => {
  const buf = encrypt("dato sensible");
  buf[28] ^= 0xff; // Corromper un byte del ciphertext
  assert.throws(() => decrypt(buf), "debe lanzar error de auth tag");
});

// ─────────────────────────────────────────────
// JWT
// ─────────────────────────────────────────────
console.log("\nJWT");

test("signToken genera un token verificable", () => {
  const payload = { userId: "uuid-123", email: "trans@example.com", discreteMode: false };
  const token = signToken(payload);
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.email, payload.email);
});

test("token con secret incorrecto no verifica", () => {
  const token = signToken({ userId: "uuid-123", email: "trans@example.com", discreteMode: false });
  assert.throws(() => jwt.verify(token, "secreto-incorrecto"), "debe lanzar JsonWebTokenError");
});

test("token contiene campo discreteMode", () => {
  const token = signToken({ userId: "u1", email: "x@y.com", discreteMode: true });
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  assert.equal(decoded.discreteMode, true);
});

// ─────────────────────────────────────────────
// Validación de schemas (Zod)
// ─────────────────────────────────────────────
console.log("\nValidación de schemas Zod");

import { z } from "zod";

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

test("schema de síntoma válido pasa validación", () => {
  const data = {
    loggedAt: "2025-01-15T20:00:00.000Z",
    moodScore: 8, breastTenderness: 6, fatigueLevel: 4,
    digestiveChanges: 3, libidoScore: 7, skinChanges: 5,
    brainFog: 3, emotionalLability: 5,
  };
  const result = SymptomSchema.safeParse(data);
  assert.ok(result.success, "debería ser válido");
});

test("symptom score fuera de rango falla validación", () => {
  const data = {
    loggedAt: "2025-01-15T20:00:00.000Z",
    moodScore: 11, breastTenderness: 6, fatigueLevel: 4,
    digestiveChanges: 3, libidoScore: 7, skinChanges: 5,
    brainFog: 3, emotionalLability: 5,
  };
  const result = SymptomSchema.safeParse(data);
  assert.ok(!result.success, "debería fallar con score > 10");
});

const LogDoseSchema = z.object({
  medicationId: z.string().uuid(),
  administeredAt: z.string().datetime(),
  actualDose: z.number().positive(),
  bodySite: z.string().optional(),
  notes: z.string().max(500).optional(),
});

test("dosis con UUID válido y dosis positiva pasa", () => {
  const data = {
    medicationId: "550e8400-e29b-41d4-a716-446655440000",
    administeredAt: "2025-01-15T08:00:00.000Z",
    actualDose: 1.0,
    bodySite: "glut_left",
  };
  assert.ok(LogDoseSchema.safeParse(data).success);
});

test("dosis negativa falla validación", () => {
  const data = {
    medicationId: "550e8400-e29b-41d4-a716-446655440000",
    administeredAt: "2025-01-15T08:00:00.000Z",
    actualDose: -0.5,
  };
  assert.ok(!LogDoseSchema.safeParse(data).success);
});

test("UUID inválido en medicationId falla", () => {
  const data = {
    medicationId: "no-es-un-uuid",
    administeredAt: "2025-01-15T08:00:00.000Z",
    actualDose: 1.0,
  };
  assert.ok(!LogDoseSchema.safeParse(data).success);
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80),
  pronouns: z.string().max(40).optional(),
  timezone: z.string().default("America/Santiago"),
});

test("email inválido falla registro", () => {
  const data = { email: "no-es-email", password: "12345678", displayName: "Emily" };
  assert.ok(!RegisterSchema.safeParse(data).success);
});

test("password corta falla registro", () => {
  const data = { email: "trans@app.com", password: "1234", displayName: "Emily" };
  assert.ok(!RegisterSchema.safeParse(data).success);
});

test("registro válido pasa", () => {
  const data = {
    email: "trans@app.com",
    password: "segura_1234",
    displayName: "Emily",
    pronouns: "ella/ella",
  };
  assert.ok(RegisterSchema.safeParse(data).success);
});

// ─────────────────────────────────────────────
// Integración cifrado + endpoint simulado
// ─────────────────────────────────────────────
console.log("\nIntegración cifrado → BD simulada");

test("flujo completo: cifrar nota → simular BD → descifrar", () => {
  const originalNote = "Semana 3: noté menos vello facial. Ánimo muy estable.";
  const encrypted = encrypt(originalNote);

  // Simular que se guarda como Buffer en la BD y se recupera
  const fromDb = Buffer.from(encrypted);
  const decrypted = decrypt(fromDb);

  assert.equal(decrypted, originalNote);
});

test("flujo diario: cifrar contenido con múltiples campos", () => {
  const entry = {
    bodyChanges: "Piel más suave en brazos y piernas",
    emotionalNotes: "Me sentí completamente yo misma hoy",
    photoUrls: ["https://cdn.tc.app/photos/2025-01-15-front.jpg"],
  };

  const bodyEnc   = encrypt(entry.bodyChanges);
  const emotEnc   = encrypt(entry.emotionalNotes);
  const photosEnc = encryptJson(entry.photoUrls);

  assert.equal(decrypt(bodyEnc),              entry.bodyChanges);
  assert.equal(decrypt(emotEnc),              entry.emotionalNotes);
  assert.deepEqual(decryptJson(photosEnc),    entry.photoUrls);
});

// ─────────────────────────────────────────────
console.log(`\n─────────────────────────────────`);
console.log(`  ${passed} tests pasaron  |  ${failed} fallaron`);
if (failed > 0) process.exit(1);
