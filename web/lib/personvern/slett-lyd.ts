import { createAdminClient } from "@/lib/supabase/admin";

/** Fjerner lydadresser eldre enn 30 dager. Skriftlig tekst blir liggende. */
export async function slettGammelLyd(): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return;
    }

    const { error } = await admin.rpc("slett_gammel_lyd");
    if (error) {
      console.error("slettGammelLyd", error.code);
    }
  } catch (error) {
    console.error("slettGammelLyd", error);
  }
}
