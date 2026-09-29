import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin/auth";
import { lydMetadataSchema } from "@/lib/admin/schemas";

const FILTYPER: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
};
const MAKS_FILSTORRELSE = 25 * 1024 * 1024;

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
        { melding: "Lydfilen har ugyldig format eller er større enn 25 MB." },
        { status: 400 },
      );
    }

    const metadata = lydMetadataSchema.safeParse({
      navn: formData.get("navn"),
      transkripsjon: String(formData.get("transkripsjon") ?? ""),
      kilde: formData.get("kilde"),
    });
    if (!metadata.success) {
      return NextResponse.json(
        { melding: "Kontroller navn og transkripsjon." },
        { status: 400 },
      );
    }

    const storagePath = `${admin.user.id}/${crypto.randomUUID()}.${filendelse}`;
    const { error: opplastingsfeil } = await admin.supabase.storage
      .from("admin-lyd")
      .upload(storagePath, fil, { contentType: fil.type, upsert: false });
    if (opplastingsfeil) {
      console.error("Kunne ikke laste opp lyd", {
        statusCode: opplastingsfeil.name,
      });
      return NextResponse.json(
        { melding: "Lydfilen kunne ikke lastes opp." },
        { status: 500 },
      );
    }

    const { error: databasefeil } = await admin.supabase
      .from("lydfiler")
      .insert({
        ...metadata.data,
        storage_path: storagePath,
        mime_type: fil.type,
        opprettet_av: admin.user.id,
      });
    if (databasefeil) {
      await admin.supabase.storage.from("admin-lyd").remove([storagePath]);
      console.error("Kunne ikke lagre lydmetadata", {
        code: databasefeil.code,
      });
      return NextResponse.json(
        { melding: "Lydfilen kunne ikke lagres." },
        { status: 500 },
      );
    }

    return NextResponse.json({ melding: "Lydfilen er lagret." });
  } catch (error) {
    console.error("Uventet feil ved lydopplasting", error);
    return NextResponse.json(
      { melding: "Noe gikk galt. Prøv igjen." },
      { status: 500 },
    );
  }
}
