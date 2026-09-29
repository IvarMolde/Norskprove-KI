import { z } from "zod";
import { Opptaksstudio } from "@/components/admin/opptaksstudio";
import { requireAdmin } from "@/lib/admin/auth";
import { lydRadSchema } from "@/lib/admin/schemas";

export default async function Opptaksstudioside() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("lydfiler")
    .select("*")
    .order("opprettet_dato", { ascending: false });

  if (error) {
    console.error("Kunne ikke hente lydfiler", { code: error.code });
    return <p className="error-message">Lydfilene kunne ikke lastes.</p>;
  }

  const validerteLydfiler = z.array(lydRadSchema).safeParse(data);
  if (!validerteLydfiler.success) {
    console.error("Ugyldige lyddata fra databasen");
    return <p className="error-message">Lydarkivet har ugyldige data.</p>;
  }

  const lydfiler = await Promise.all(
    validerteLydfiler.data.map(async (lyd) => {
      const { data: signert } = await supabase.storage
        .from("admin-lyd")
        .createSignedUrl(lyd.storage_path, 3600);
      return { ...lyd, signertUrl: signert?.signedUrl ?? "" };
    }),
  );

  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Lydproduksjon</p>
          <h2>Opptaksstudio</h2>
        </div>
        <p>Ta opp eller last opp lyd, og legg ved transkripsjon.</p>
      </div>
      <Opptaksstudio />

      <div className="audio-list">
        {lydfiler.map((lyd) => (
          <article className="audio-card" key={lyd.id}>
            <div>
              <span className="status">{lyd.kilde}</span>
              <h3>{lyd.navn}</h3>
              <p>{lyd.transkripsjon || "Ingen transkripsjon"}</p>
            </div>
            {lyd.signertUrl && <audio controls preload="none" src={lyd.signertUrl} />}
          </article>
        ))}
      </div>
    </section>
  );
}
