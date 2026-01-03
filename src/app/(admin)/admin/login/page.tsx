import { getFirebasePublicConfig, getMissingFirebasePublicKeys } from "@/lib/firebase-public-config";
import { LoginClient } from "./LoginClient";

export default function AdminLoginPage() {
  const missing = getMissingFirebasePublicKeys();
  const config = missing.length ? null : getFirebasePublicConfig();
  return <LoginClient firebaseConfig={config} missing={missing} />;
}
