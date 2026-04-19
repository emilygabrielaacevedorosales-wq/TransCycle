/**
 * TransCycle — Servicio de cifrado AES-256-GCM
 *
 * Todos los campos _encrypted en la BD pasan por aquí antes
 * de persistirse. La clave maestra vive en variables de entorno;
 * nunca en el código ni en la BD.
 *
 * Esquema: IV (12 bytes) + AuthTag (16 bytes) + CipherText → Buffer
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY debe ser exactamente 32 bytes en hex (64 chars)"
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Cifra un string y devuelve un Buffer listo para guardar en BYTEA.
 * Layout: [IV 12b][AuthTag 16b][CipherText]
 */
export function encrypt(plaintext: string): Buffer {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Descifra un Buffer proveniente de la BD.
 */
export function decrypt(data: Buffer): string {
  const key = getMasterKey();
  const iv = data.subarray(0, IV_BYTES);
  const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = data.subarray(IV_BYTES + TAG_BYTES);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return (
    decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8")
  );
}

/**
 * Cifra un objeto JSON.
 */
export function encryptJson(obj: unknown): Buffer {
  return encrypt(JSON.stringify(obj));
}

/**
 * Descifra y parsea un objeto JSON.
 */
export function decryptJson<T = unknown>(data: Buffer): T {
  return JSON.parse(decrypt(data)) as T;
}

/**
 * Devuelve null de forma segura si el buffer es null/undefined.
 */
export function safeDecrypt(data: Buffer | null | undefined): string | null {
  if (!data) return null;
  try {
    return decrypt(data);
  } catch {
    return null;
  }
}
