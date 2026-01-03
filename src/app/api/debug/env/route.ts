export async function GET() {
  return Response.json({
    hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? String(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN).slice(0, 20) : null,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? String(process.env.NEXT_PUBLIC_FIREBASE_APP_ID).slice(0, 12) : null,
    senderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? null,
  });
}
