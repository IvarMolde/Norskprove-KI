import { z } from "zod";
import {
  leseoktSchema,
  poengsumSchema,
  type Poengsum,
} from "@/lib/oppgaver/lesing";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";

type Leseokt = z.infer<typeof leseoktSchema>;

export type OktResultat<T> =
  | { ok: true; data: T }
  | { ok: false; feil: string };

function somFeil(message: string | undefined): OktResultat<never> {
  return { ok: false, feil: oktFeilTekst(message) };
}

async function hentLeseoktId(
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
      .eq("ferdighet", "lesing")
      .eq("status", status)
      .order("startet", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.error("hentLeseoktId", error.code);
      }
      return null;
    }

    const id = z.string().uuid().safeParse(data.id);
    return id.success ? id.data : null;
  } catch (error) {
    console.error("hentLeseoktId", error);
    return null;
  }
}

export function hentAktivLeseoktId(): Promise<string | null> {
  return hentLeseoktId("pagaende");
}

export function hentPausetLeseoktId(): Promise<string | null> {
  return hentLeseoktId("avbrutt_lagret");
}

export async function hentLeseokt(
  oktId: string,
): Promise<OktResultat<Leseokt>> {
  try {
    const id = z.string().uuid().safeParse(oktId);
    if (!id.success) {
      return somFeil("okt_ikke_funnet");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_leseokt", {
      p_okt_id: id.data,
    });

    if (error) {
      console.error("hentLeseokt", error.code);
      return somFeil(error.message);
    }

    const parsed = leseoktSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentLeseokt form", parsed.error.flatten());
      return somFeil(undefined);
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentLeseokt", error);
    return somFeil(undefined);
  }
}

export async function hentPoengsum(
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
      console.error("hentPoengsum", error.code);
      return somFeil(error.message);
    }

    const parsed = poengsumSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentPoengsum form", parsed.error.flatten());
      return somFeil(undefined);
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentPoengsum", error);
    return somFeil(undefined);
  }
}
