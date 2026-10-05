import { z } from "zod";
import { poengsumSchema, type Poengsum } from "@/lib/oppgaver/lesing";
import { lytteoktSchema, type Lytteokt } from "@/lib/oppgaver/lytting";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";

export type OktResultat<T> =
  | { ok: true; data: T }
  | { ok: false; feil: string };

function somFeil(message: string | undefined): OktResultat<never> {
  return { ok: false, feil: oktFeilTekst(message) };
}

export async function hentAktivLytteoktId(): Promise<string | null> {
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
      .eq("ferdighet", "lytting")
      .eq("status", "pagaende")
      .order("startet", { ascending: false })
      .limit(10);

    if (error || !data) {
      if (error) {
        console.error("hentAktivLytteoktId", error.code);
      }
      return null;
    }

    const ids = data
      .map((rad) => z.string().uuid().safeParse(rad.id))
      .filter((rad) => rad.success)
      .map((rad) => rad.data);

    if (ids.length === 0) {
      return null;
    }

    const { data: prove, error: proveFeil } = await supabase
      .from("prove_sesjon")
      .select("okt_id")
      .in("okt_id", ids);

    if (proveFeil) {
      console.error("hentAktivLytteoktId prove", proveFeil.code);
      return null;
    }

    const adaptive = new Set((prove ?? []).map((rad) => rad.okt_id));
    return ids.find((id) => !adaptive.has(id)) ?? null;
  } catch (error) {
    console.error("hentAktivLytteoktId", error);
    return null;
  }
}

export async function hentLytteokt(
  oktId: string,
): Promise<OktResultat<Lytteokt>> {
  try {
    const id = z.string().uuid().safeParse(oktId);
    if (!id.success) {
      return somFeil("okt_ikke_funnet");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_lytteokt", {
      p_okt_id: id.data,
    });

    if (error) {
      console.error("hentLytteokt", error.code);
      return somFeil(error.message);
    }

    const parsed = lytteoktSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentLytteokt form");
      return somFeil(undefined);
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentLytteokt", error);
    return somFeil(undefined);
  }
}

export async function hentLyttePoengsum(
  oktId: string,
): Promise<OktResultat<Poengsum>> {
  try {
    const id = z.string().uuid().safeParse(oktId);
    if (!id.success) {
      return somFeil("okt_ikke_funnet");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("poengsum_okt", {
      p_okt_id: id.data,
    });

    if (error) {
      console.error("hentLyttePoengsum", error.code);
      return somFeil(error.message);
    }

    const parsed = poengsumSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentLyttePoengsum form");
      return somFeil(undefined);
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentLyttePoengsum", error);
    return somFeil(undefined);
  }
}
