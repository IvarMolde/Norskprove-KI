/** Lokal test bekrefter ordren uten å trekke penger. Vipps-nøkler slår den av. */
export function lokalBekreftelseTillatt(): boolean {
  if (process.env.BETALING_LOKAL_BEKREFTELSE !== "1") {
    return false;
  }

  const vipps = Boolean(
    process.env.VIPPS_CLIENT_ID &&
      process.env.VIPPS_CLIENT_SECRET &&
      process.env.VIPPS_SUBSCRIPTION_KEY &&
      process.env.VIPPS_MSN,
  );
  if (vipps) {
    return false;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.includes("127.0.0.1:54321") && !url.includes("supabase.co");
}