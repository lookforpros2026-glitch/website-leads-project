export const REQUIRED_CLIENT_ENVS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
] as const;

export const REQUIRED_ADMIN_ENVS = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
] as const;

export function missingEnv(keys: readonly string[]) {
  return keys.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");
}

export function hasAdminEnv(): boolean {
  return missingEnv(REQUIRED_ADMIN_ENVS).length === 0;
}

function getHeaders(): Headers {
  if (typeof window !== "undefined") return new Headers();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { headers } = require("next/headers");
    return headers();
  } catch {
    return new Headers();
  }
}

export function requireClientEnv() {
  const missing = missingEnv(REQUIRED_CLIENT_ENVS);
  if (missing.length) {
    throw new Error(`Missing Firebase client env vars: ${missing.join(", ")}`);
  }
}

/**
 * Only call this inside admin-only routes / actions.
 */
export function requireAdminEnv() {
  const missing = missingEnv(REQUIRED_ADMIN_ENVS);
  if (missing.length) {
    throw new Error(`Missing Firebase admin env vars: ${missing.join(", ")}`);
  }
}

export function getEnvWarnings() {
  const warnings: string[] = [];
  const missingClient = missingEnv(REQUIRED_CLIENT_ENVS);
  const missingAdmin = missingEnv(REQUIRED_ADMIN_ENVS);
  if (missingClient.length) warnings.push(`Missing client env vars: ${missingClient.join(", ")}`);
  if (missingAdmin.length) warnings.push(`Missing admin env vars: ${missingAdmin.join(", ")}`);
  return warnings;
}

export function resolveBaseUrl(hdrs?: Headers, override?: string) {
  if (override) return override;
  const envBase = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (envBase) return envBase;
  const headers = hdrs || getHeaders();
  const proto = headers.get("x-forwarded-proto") || "http";
  const host = headers.get("x-forwarded-host") || headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}
