import { oktFeilTekst } from "@/lib/okt/feil";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const idSkjema =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const filSkjema =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp|svg|pdf)$/;

function innholdstype(filnavn: string): string {
  if (filnavn.endsWith(".webp")) return "image/webp";
  if (filnavn.endsWith(".svg")) return "image/svg+xml";
  if (filnavn.endsWith(".pdf")) return "application/pdf";
  return "image/png";
}

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

    const bytes = new Uint8Array(await fil.data.arrayBuffer());
    const type = innholdstype(data);
    const headers: Record<string, string> = {
      "Content-Type": type,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
    };
    if (type === "image/svg+xml") {
      headers["Content-Security-Policy"] =
        "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    }
    return new Response(bytes, { headers });
  } catch (error) {
    console.error("oppgaveBilde", error);
    return new Response(oktFeilTekst(undefined), { status: 500 });
  }
}
