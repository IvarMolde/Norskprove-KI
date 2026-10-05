import { oktFeilTekst } from "@/lib/okt/feil";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const idSkjema =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const filSkjema =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp)$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!idSkjema.test(id)) {
      return new Response(oktFeilTekst("bilde_mangler"), { status: 404 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_oppgavebilde", {
      p_id: id,
    });

    if (error || typeof data !== "string" || !filSkjema.test(data)) {
      if (error) {
        console.error("oppgaveBilde", error.code);
      }
      const tekst = oktFeilTekst(error?.message ?? "bilde_mangler");
      const status =
        error?.message.includes("ikke_innlogget") ? 403 : 404;
      return new Response(tekst, { status });
    }

    const admin = createAdminClient();
    if (!admin) {
      return new Response(oktFeilTekst("bilde_utilgjengelig"), { status: 503 });
    }

    const fil = await admin.storage.from("oppgave-bilder").download(data);
    if (fil.error || !fil.data) {
      console.error("oppgaveBilde fil");
      return new Response(oktFeilTekst("bilde_mangler"), { status: 404 });
    }

    const endelse = data.endsWith(".webp") ? "webp" : "png";
    const bytes = new Uint8Array(await fil.data.arrayBuffer());
    return new Response(bytes, {
      headers: {
        "Content-Type": endelse === "webp" ? "image/webp" : "image/png",
        "Cache-Control": "private, no-store",
        "Content-Length": String(bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("oppgaveBilde", error);
    return new Response(oktFeilTekst(undefined), { status: 500 });
  }
}
