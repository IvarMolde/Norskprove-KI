"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { lokalBekreftelseTillatt } from "@/lib/betaling/lokal";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const planIdSchema = z.enum(["plan_499", "plan_699", "plan_899"]);
const uuidSchema = z.string().uuid();

export async function kjopPlan(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const plan = planIdSchema.safeParse(formData.get("planId"));
    if (!plan.success) {
      return { feil: oktFeilTekst("ugyldig_plan") };
    }

    if (!lokalBekreftelseTillatt()) {
      console.error("kjopPlan betaling_utilgjengelig");
      return { feil: oktFeilTekst("betaling_utilgjengelig") };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { feil: oktFeilTekst("ikke_innlogget") };
    }

    const start = await supabase.rpc("start_betaling", {
      p_plan_id: plan.data,
    });

    if (start.error) {
      console.error("kjopPlan start", start.error.code);
      return { feil: oktFeilTekst(start.error.message) };
    }

    const id = uuidSchema.safeParse(start.data);
    if (!id.success) {
      return { feil: oktFeilTekst(undefined) };
    }

    const admin = createAdminClient();
    if (!admin) {
      console.error("kjopPlan mangler_tjenestenokkel");
      return { feil: oktFeilTekst("betaling_utilgjengelig") };
    }

    const bekreft = await admin.rpc("bekreft_betaling", {
      p_betaling_id: id.data,
    });

    if (bekreft.error) {
      console.error("kjopPlan bekreft", bekreft.error.code);
      return { feil: oktFeilTekst(bekreft.error.message) };
    }

    redirect("/betaling?kjopt=1");
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("kjopPlan", error);
    return { feil: oktFeilTekst(undefined) };
  }
}