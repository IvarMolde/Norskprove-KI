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
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return new Response(oktFeilTekst("innlevering_mangler"), { status: 404 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_muntlig_lydadresse", {
      p_svar_id: id,
    });

    if (error || typeof data !== "string" || !adresseSkjema.test(data)) {
      if (error) {
        console.error("larerLyd", error.code);
      }
      const tekst = oktFeilTekst(error?.message ?? "innlevering_mangler");
      const status = error?.message.includes("ikke_larer")
        || error?.message.includes("ikke_innlogget")
        ? 403
        : 404;
      return new Response(tekst, { status });
    }

    const admin = createAdminClient();
    if (!admin) {
      return new Response(oktFeilTekst("vurdering_utilgjengelig"), { status: 503 });
    }

    const objekt = data.slice("muntlig-opptak/".length);
    const fil = await admin.storage.from("muntlig-opptak").download(objekt);
    if (fil.error || !fil.data) {
      console.error("larerLyd fil");
      return new Response(oktFeilTekst("innlevering_mangler"), { status: 404 });
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
    console.error("larerLyd", error);
    return new Response(oktFeilTekst(undefined), { status: 500 });
  }
}
