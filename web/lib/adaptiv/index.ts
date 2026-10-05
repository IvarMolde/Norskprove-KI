import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";

const faseSchema = z.enum([
  "forprove1",
  "forprove2_lett",
  "forprove2_vanskelig",
  "hovedprove_a1a2",
  "hovedprove_a2b1",
  "hovedprove_b1b2",
  "ferdig",
]);

const ferdighetSchema = z.enum(["lesing", "lytting"]);

const tilstandSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pagaende", "fullfort", "avbrutt_lagret"]),
  ferdighet: ferdighetSchema,
  fase: faseSchema,
  niva_gruppe: z.enum(["A1-A2", "A2-B1", "B1-B2"]).nullable(),
  oppgaver: z.array(z.string().uuid()),
});

export type AdaptivTilstand = z.infer<typeof tilstandSchema>;

export type AdaptivResultat<T> =
  | { ok: true; data: T }
  | { ok: false; feil: string };

function somFeil(message: string | undefined): AdaptivResultat<never> {
  return { ok: false, feil: oktFeilTekst(message) };
}

export function delTekst(fase: AdaptivTilstand["fase"]): string {
  if (fase === "forprove1") {
    return "Del 1";
  }
  if (fase === "forprove2_lett" || fase === "forprove2_vanskelig") {
    return "Del 2";
  }
  if (fase.startsWith("hovedprove")) {
    return "Del 3";
  }
  return "Ferdig";
}

const aktivStatusSchema = z.enum(["pagaende", "avbrutt_lagret"]);

const sisteNivaSchema = z.object({
  id: z.string().uuid(),
  niva_gruppe: z.enum(["A1-A2", "A2-B1", "B1-B2"]),
});

export type SisteAdaptivNiva = z.infer<typeof sisteNivaSchema>;

const adaptivSvarSchema = z.object({
  id: z.string().uuid(),
  tittel: z.string().min(1),
  del: z.enum(["Del 1", "Del 2", "Del 3"]),
  nummer: z.number().int().positive(),
  antall: z.number().int().positive(),
  riktig: z.boolean(),
});

export type AdaptivSvar = z.infer<typeof adaptivSvarSchema>;

export async function hentAdaptivGjennomgang(
  oktId: string,
): Promise<AdaptivResultat<AdaptivSvar[]>> {
  try {
    const id = z.string().uuid().safeParse(oktId);
    if (!id.success) {
      return somFeil("okt_ikke_funnet");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("adaptiv_gjennomgang", {
      p_okt_id: id.data,
    });

    if (error) {
      console.error("hentAdaptivGjennomgang", error.code);
      return somFeil(error.message);
    }

    const parsed = z.array(adaptivSvarSchema).safeParse(data ?? []);
    if (!parsed.success) {
      console.error("hentAdaptivGjennomgang form");
      return somFeil(undefined);
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentAdaptivGjennomgang", error);
    return somFeil(undefined);
  }
}

export async function hentSisteAdaptivNiva(
  ferdighet: "lesing" | "lytting",
): Promise<SisteAdaptivNiva | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("siste_adaptiv_niva", {
      p_ferdighet: ferdighet,
    });

    if (error) {
      console.error("hentSisteAdaptivNiva", error.code);
      return null;
    }

    if (data === null) {
      return null;
    }

    const parsed = sisteNivaSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentSisteAdaptivNiva form");
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error("hentSisteAdaptivNiva", error);
    return null;
  }
}

export async function hentAktivAdaptiv(
  ferdighet: "lesing" | "lytting",
): Promise<{ id: string; status: "pagaende" | "avbrutt_lagret" } | null> {
  try {
    const id = await hentAktivAdaptivId(ferdighet);
    if (!id) {
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("okt_tilstand")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.error("hentAktivAdaptiv", error.code);
      }
      return null;
    }

    const status = aktivStatusSchema.safeParse(data.status);
    if (!status.success) {
      return null;
    }

    return { id, status: status.data };
  } catch (error) {
    console.error("hentAktivAdaptiv", error);
    return null;
  }
}

export async function hentAktivAdaptivId(
  ferdighet: "lesing" | "lytting",
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("aktiv_adaptiv_prove", {
      p_ferdighet: ferdighet,
    });
    if (error) {
      console.error("hentAktivAdaptivId", error.code);
      return null;
    }
    if (data === null) {
      return null;
    }
    const id = z.string().uuid().safeParse(data);
    return id.success ? id.data : null;
  } catch (error) {
    console.error("hentAktivAdaptivId", error);
    return null;
  }
}

export async function hentAdaptivProve(
  oktId: string,
): Promise<AdaptivResultat<AdaptivTilstand>> {
  try {
    const id = z.string().uuid().safeParse(oktId);
    if (!id.success) {
      return somFeil("okt_ikke_funnet");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_adaptiv_prove", {
      p_okt_id: id.data,
    });
    if (error) {
      console.error("hentAdaptivProve", error.code);
      return somFeil(error.message);
    }
    const parsed = tilstandSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentAdaptivProve form");
      return somFeil(undefined);
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentAdaptivProve", error);
    return somFeil(undefined);
  }
}

export async function videreAdaptivFase(
  oktId: string,
): Promise<AdaptivResultat<AdaptivTilstand>> {
  try {
    const id = z.string().uuid().safeParse(oktId);
    if (!id.success) {
      return somFeil("okt_ikke_funnet");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("videre_adaptiv_fase", {
      p_okt_id: id.data,
    });
    if (error) {
      console.error("videreAdaptivFase", error.code);
      return somFeil(error.message);
    }
    const parsed = tilstandSchema.safeParse(data);
    if (!parsed.success) {
      console.error("videreAdaptivFase form");
      return somFeil(undefined);
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("videreAdaptivFase", error);
    return somFeil(undefined);
  }
}
