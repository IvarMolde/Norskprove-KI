import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin/auth";
import { bildeMetadataSchema } from "@/lib/admin/schemas";

const FILTYPER: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAKS_FILSTORRELSE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ melding: "Ingen tilgang." }, { status: 403 });
    }

    const formData = await request.formData();
    const fil = formData.get("fil");
    const filendelse = fil instanceof File ? FILTYPER[fil.type] : undefined;
    if (
      !(fil instanceof File) ||
      !filendelse ||
      fil.size === 0 ||
      fil.size > MAKS_FILSTORRELSE
    ) {
      return NextResponse.json(
        { melding: "Velg et JPG-, PNG- eller WebP-bilde på maks 10 MB." },
        { status: 400 },
      );
    }

    const metadata = bildeMetadataSchema.safeParse({
      beskrivelse: formData.get("beskrivelse"),
      tema: String(formData.get("tema") ?? ""),
      fotograf_navn: String(formData.get("fotograf_navn") ?? ""),
      kilde_plattform: String(formData.get("kilde_plattform") ?? ""),
      kilde_url: String(formData.get("kilde_url") ?? ""),
      lisens: String(formData.get("lisens") ?? ""),
      kreditering_pakrevd: formData.get("kreditering_pakrevd") === "true",
    });
    if (!metadata.success) {
      return NextResponse.json(
        { melding: "Kontroller metadatafeltene." },
        { status: 400 },
      );
    }

    const storagePath = `${admin.user.id}/${crypto.randomUUID()}.${filendelse}`;
    const { error: opplastingsfeil } = await admin.supabase.storage
      .from("admin-bilder")
      .upload(storagePath, fil, { contentType: fil.type, upsert: false });
    if (opplastingsfeil) {
      console.error("Kunne ikke laste opp bilde", {
        statusCode: opplastingsfeil.name,
      });
      return NextResponse.json(
        { melding: "Bildet kunne ikke lastes opp." },
        { status: 500 },
      );
    }

    const { error: databasefeil } = await admin.supabase.from("bilder").insert({
      ...metadata.data,
      url: storagePath,
      kilde: "opplastet",
      status: "venter_godkjenning",
      opprettet_av: admin.user.id,
    });
    if (databasefeil) {
      await admin.supabase.storage.from("admin-bilder").remove([storagePath]);
      console.error("Kunne ikke lagre bildemetadata", {
        code: databasefeil.code,
      });
      return NextResponse.json(
        { melding: "Bildet kunne ikke lagres." },
        { status: 500 },
      );
    }

    return NextResponse.json({ melding: "Bildet er lastet opp." });
  } catch (error) {
    console.error("Uventet feil ved bildeopplasting", error);
    return NextResponse.json(
      { melding: "Noe gikk galt. Prøv igjen." },
      { status: 500 },
    );
  }
}
