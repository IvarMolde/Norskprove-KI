import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import {
  redaktorOppgaveSchema,
  redaktorRadSchema,
  type RedaktorOppgave,
  type RedaktorRad,
} from "@/lib/oppgaver/innhold";
import { createClient } from "@/lib/supabase/server";

export type RedaktorResultat<T> =
  | { ok: true; data: T }
  | { ok: false; feil: string };

export async function hentRedaktorListe(): Promise<
  RedaktorResultat<RedaktorRad[]>
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("redaktor_liste");
    if (error) {
      console.error("hentRedaktorListe", error.code);
      return { ok: false, feil: oktFeilTekst(error.message) };
    }

    const parsed = z.array(redaktorRadSchema).safeParse(data);
    if (!parsed.success) {
      console.error("hentRedaktorListe form");
      return { ok: false, feil: oktFeilTekst(undefined) };
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentRedaktorListe", error);
    return { ok: false, feil: oktFeilTekst(undefined) };
  }
}

export async function hentRedaktorOppgave(
  id: string,
): Promise<RedaktorResultat<RedaktorOppgave>> {
  try {
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) {
      return { ok: false, feil: oktFeilTekst("oppgave_ikke_funnet") };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("redaktor_hent", {
      p_id: parsedId.data,
    });
    if (error) {
      console.error("hentRedaktorOppgave", error.code);
      return { ok: false, feil: oktFeilTekst(error.message) };
    }

    const parsed = redaktorOppgaveSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentRedaktorOppgave form");
      return { ok: false, feil: oktFeilTekst(undefined) };
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentRedaktorOppgave", error);
    return { ok: false, feil: oktFeilTekst(undefined) };
  }
}
