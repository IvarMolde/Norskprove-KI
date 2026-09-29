import { z } from "zod";
import { Bildeopplasting } from "@/components/admin/bildeopplasting";
import { requireAdmin } from "@/lib/admin/auth";
import { bildeRadSchema } from "@/lib/admin/schemas";
import { endreBildestatus } from "./actions";

export default async function Bildeside() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("bilder")
    .select("id,url,beskrivelse,tema,status,opprettet_dato")
    .order("opprettet_dato", { ascending: false });

  if (error) {
    console.error("Kunne ikke hente bilder", { code: error.code });
    return <p className="error-message">Bildebanken kunne ikke lastes.</p>;
  }

  const validerteBilder = z.array(bildeRadSchema).safeParse(data);
  if (!validerteBilder.success) {
    console.error("Ugyldige bildedata fra databasen");
    return <p className="error-message">Bildebanken har ugyldige data.</p>;
  }

  const bilder = await Promise.all(
    validerteBilder.data.map(async (bilde) => {
      const { data: signert } = await supabase.storage
        .from("admin-bilder")
        .createSignedUrl(bilde.url, 3600);
      return { ...bilde, signertUrl: signert?.signedUrl ?? "" };
    }),
  );

  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Mediebank</p>
          <h2>Bildebank</h2>
        </div>
        <p>Opplastede bilder må godkjennes før de kan brukes i oppgaver.</p>
      </div>
      <Bildeopplasting />

      <div className="media-grid">
        {bilder.map((bilde) => (
          <article className="media-card" key={bilde.id}>
            {bilde.signertUrl ? (
              // Signerte URL-er er kortvarige og kommer fra vår private bøtte.
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={bilde.beskrivelse} src={bilde.signertUrl} />
            ) : (
              <div className="media-placeholder">Forhåndsvisning mangler</div>
            )}
            <div className="media-card-content">
              <span className={`status status-${bilde.status}`}>
                {bilde.status.replaceAll("_", " ")}
              </span>
              <h3>{bilde.beskrivelse}</h3>
              <p>{bilde.tema || "Uten tema"}</p>
              {bilde.status === "venter_godkjenning" && (
                <div className="inline-actions">
                  <form action={endreBildestatus.bind(null, bilde.id, "godkjent")}>
                    <button className="primary-button" type="submit">
                      Godkjenn
                    </button>
                  </form>
                  <form action={endreBildestatus.bind(null, bilde.id, "avvist")}>
                    <button className="secondary-button" type="submit">
                      Avvis
                    </button>
                  </form>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
