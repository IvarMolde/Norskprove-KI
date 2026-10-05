import { oktFeilTekst } from "@/lib/okt/feil";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const typer: Record<string, string> = {
  wav: "audio/wav",
  webm: "audio/webm",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
};

const adresseSkjema =
  /^muntlig-opptak\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|wav|mp3|ogg)$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ oktId: string; oppgaveId: string }> },
) {
  try {
    const { oktId, oppgaveId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(oktId) || !/^[0-9a-f-]{36}$/i.test(oppgaveId)) {
      return new Response(oktFeilTekst("okt_ikke_funnet"), { status: 404 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_egen_muntlig_lyd", {
      p_okt_id: oktId,
      p_oppgave_id: oppgaveId,
    });

    if (error || typeof data !== "string" || !adresseSkjema.test(data)) {
      if (error) {
        console.error("egenLyd", error.code);
      }
      const tekst = oktFeilTekst(error?.message ?? "mangler_lyd");
      const status = error?.message.includes("ikke_innlogget") ? 403 : 404;
      return new Response(tekst, { status });
    }

    const admin = createAdminClient();
    if (!admin) {
      return new Response(oktFeilTekst("vurdering_utilgjengelig"), { status: 503 });
    }

    const objekt = data.slice("muntlig-opptak/".length);
    const fil = await admin.storage.from("muntlig-opptak").download(objekt);
    if (fil.error || !fil.data) {
      console.error("egenLyd fil");
      return new Response(oktFeilTekst("mangler_lyd"), { status: 404 });
    }

    const endelse = data.slice(data.lastIndexOf(".") + 1);
    const bytes = new Uint8Array(await fil.data.arrayBuffer());
    return new Response(bytes, {
      headers: {
        "Content-Type": typer[endelse] ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (error) {
    console.error("egenLyd", error);
    return new Response(oktFeilTekst(undefined), { status: 500 });
  }
}
