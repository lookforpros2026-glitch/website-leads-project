import * as admin from "firebase-admin";
import type { Bucket } from "@google-cloud/storage";
import { hasAdminEnv, requireAdminEnv } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __adminApp: admin.app.App | undefined;
  // eslint-disable-next-line no-var
  var __adminDb: admin.firestore.Firestore | undefined;
}

export function canUseAdmin(): boolean {
  return hasAdminEnv();
}

export function getAdminApp(): admin.app.App {
  requireAdminEnv();
  if (global.__adminApp) return global.__adminApp;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n");

  global.__adminApp =
    admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        });

  return global.__adminApp;
}

export function getAdminDb(): admin.firestore.Firestore {
  if (global.__adminDb) return global.__adminDb;
  const app = getAdminApp();
  const db = app.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  global.__adminDb = db;
  return db;
}

export function getAdminAuth(): admin.auth.Auth {
  return getAdminApp().auth();
}

export function getAdminStorageBucket(): Bucket {
  const app = getAdminApp();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error("FIREBASE_STORAGE_BUCKET not configured");
  }
  return app.storage().bucket(bucketName);
}
