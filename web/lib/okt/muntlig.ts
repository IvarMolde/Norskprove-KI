import { z } from "zod";
import { muntligOktSchema, type MuntligOkt } from "@/lib/oppgaver/muntlig";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";

export type OktResultat<T> =
  | { ok: true; data: T }
  | { ok: false; feil: string };

function somFeil(message: string | undefined): OktResultat<never> {
  return { ok: false, feil: oktFeilTekst(message) };
}

export async function hentSisteFullfortMuntligOktId(): Promise<string | null> {
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
      .eq("ferdighet", "muntlig")
      .eq("status", "fullfort")
      .order("startet", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.error("hentSisteFullfortMuntligOktId", error.code);
      }
      return null;
    }

    const id = z.string().uuid().safeParse(data.id);
    return id.success ? id.data : null;
  } catch (error) {
    console.error("hentSisteFullfortMuntligOktId", error);
    return null;
  }
}

export async function hentAktivMuntligOktId(): Promise<string | null> {
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
      .eq("ferdighet", "muntlig")
      .eq("status", "pagaende")
      .order("startet", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.error("hentAktivMuntligOktId", error.code);
      }
      return null;
    }

    const id = z.string().uuid().safeParse(data.id);
    return id.success ? id.data : null;
  } catch (error) {
    console.error("hentAktivMuntligOktId", error);
    return null;
  }
}

export async function hentMuntligOkt(
  oktId: string,
): Promise<OktResultat<MuntligOkt>> {
  try {
    const id = z.string().uuid().safeParse(oktId);
    if (!id.success) {
      return somFeil("okt_ikke_funnet");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_muntlig_okt", {
      p_okt_id: id.data,
    });

    if (error) {
      console.error("hentMuntligOkt", error.code);
      return somFeil(error.message);
    }

    const parsed = muntligOktSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentMuntligOkt form");
      return somFeil(undefined);
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentMuntligOkt", error);
    return somFeil(undefined);
  }
}
