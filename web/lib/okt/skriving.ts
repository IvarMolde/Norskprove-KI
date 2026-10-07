import { z } from "zod";
import { skriveoktSchema, type Skriveokt } from "@/lib/oppgaver/skriving";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";

export type OktResultat<T> =
  | { ok: true; data: T }
  | { ok: false; feil: string };

function somFeil(message: string | undefined): OktResultat<never> {
  return { ok: false, feil: oktFeilTekst(message) };
}

async function hentSkriveoktId(
  status: "pagaende" | "avbrutt_lagret",
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from("okt_tilstand")
      .select("id")
      .eq("bruker_id", user.id)
      .eq("ferdighet", "skriving")
      .eq("status", status)
      .order("startet", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.error("hentSkriveoktId", error.code);
      }
      return null;
    }

    const id = z.string().uuid().safeParse(data.id);
    return id.success ? id.data : null;
  } catch (error) {
    console.error("hentSkriveoktId", error);
    return null;
  }
}

export function hentAktivSkriveoktId(): Promise<string | null> {
  return hentSkriveoktId("pagaende");
}

export function hentPausetSkriveoktId(): Promise<string | null> {
  return hentSkriveoktId("avbrutt_lagret");
}

export async function hentSkriveokt(
  oktId: string,
): Promise<OktResultat<Skriveokt>> {
  try {
    const id = z.string().uuid().safeParse(oktId);
    if (!id.success) {
      return somFeil("okt_ikke_funnet");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_skriveokt", {
      p_okt_id: id.data,
    });

    if (error) {
      console.error("hentSkriveokt", error.code);
      return somFeil(error.message);
    }

    const parsed = skriveoktSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentSkriveokt form");
      return somFeil(undefined);
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentSkriveokt", error);
    return somFeil(undefined);
  }
}
