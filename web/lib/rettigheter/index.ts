import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";

const RETTIGHETER = [
  "pause_gjenoppta",
  "skriftlig_ki_vurdering",
  "muntlig_ki_vurdering",
  "adaptiv_prove",
] as const;

const rettighetSchema = z.enum(RETTIGHETER);
const periodeSchema = z.enum(["totalt", "maned"]);

export type Rettighet = z.infer<typeof rettighetSchema>;

export type OktGrense = {
  grense: number;
  periode: z.infer<typeof periodeSchema>;
  brukte: number;
  kanStarte: boolean;
};

function manedStartUtc(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

/**
 * Sider spør denne funksjonen, aldri om plan-id.
 * Plan-koblingen blir værende i modulen.
 */
export async function harRettighet(rettighet: Rettighet): Promise<boolean> {
  try {
    const sjekket = rettighetSchema.parse(rettighet);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { data: profil, error: profilFeil } = await supabase
      .from("brukerprofil")
      .select("abonnement_plan_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profilFeil || !profil) {
      if (profilFeil) {
        console.error("harRettighet profil", profilFeil.code);
      }
      return false;
    }

    const { data, error } = await supabase
      .from("plan_rettigheter")
      .select("rettighet")
      .eq("plan_id", profil.abonnement_plan_id)
      .eq("rettighet", sjekket)
      .maybeSingle();

    if (error) {
      console.error("harRettighet", error.code);
      return false;
    }

    return data !== null;
  } catch (error) {
    console.error("harRettighet", error);
    return false;
  }
}

/**
 * Grense og forbruk. Plan-id sendes ikke ut av modulen.
 * Databasen er den endelige sperren i start_leseokt.
 */
export async function hentOktGrense(): Promise<OktGrense | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: profil, error: profilFeil } = await supabase
      .from("brukerprofil")
      .select("abonnement_plan_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profilFeil || !profil) {
      if (profilFeil) {
        console.error("hentOktGrense profil", profilFeil.code);
      }
      return null;
    }

    const { data: plan, error: planFeil } = await supabase
      .from("abonnement_plan")
      .select("okter_grense, okter_periode")
      .eq("id", profil.abonnement_plan_id)
      .maybeSingle();

    if (planFeil || !plan) {
      if (planFeil) {
        console.error("hentOktGrense plan", planFeil.code);
      }
      return null;
    }

    const periode = periodeSchema.safeParse(plan.okter_periode);
    const grense = z.number().int().nonnegative().safeParse(plan.okter_grense);

    if (!periode.success || !grense.success) {
      return null;
    }

    let sporring = supabase
      .from("okt_tilstand")
      .select("id", { count: "exact", head: true })
      .eq("bruker_id", user.id)
      .eq("status", "fullfort");

    if (periode.data === "maned") {
      sporring = sporring.gte("startet", manedStartUtc());
    }

    const { count, error } = await sporring;

    if (error || count === null) {
      if (error) {
        console.error("hentOktGrense telling", error.code);
      }
      return null;
    }

    return {
      grense: grense.data,
      periode: periode.data,
      brukte: count,
      kanStarte: count < grense.data,
    };
  } catch (error) {
    console.error("hentOktGrense", error);
    return null;
  }
}

export function oktGrenseTekst(): string {
  return oktFeilTekst("okt_grense");
}
