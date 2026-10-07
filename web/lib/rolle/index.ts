import { createClient } from "@/lib/supabase/server";

export type RedaktorTilgang = "utlogget" | "elev" | "redaktor";

/**
 * Rollen er ikke en planrettighet. Sider spør denne funksjonen.
 */
export async function redaktorTilgang(): Promise<RedaktorTilgang> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return "utlogget";
    }

    const { data, error } = await supabase.rpc("er_redaktor");
    if (error) {
      console.error("er_redaktor", error.code);
      return "elev";
    }

    return data === true ? "redaktor" : "elev";
  } catch (error) {
    console.error("redaktorTilgang", error);
    return "elev";
  }
}

export async function erRedaktor(): Promise<boolean> {
  return (await redaktorTilgang()) === "redaktor";
}

export async function erLarer(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { data, error } = await supabase.rpc("er_larer");
    if (error) {
      console.error("er_larer", error.code);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error("erLarer", error);
    return false;
  }
}
