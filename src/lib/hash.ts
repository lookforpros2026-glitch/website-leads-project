import crypto from "crypto";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits;
}

export function normalizeEmail(email?: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}
