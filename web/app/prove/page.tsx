import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";

export default function ProveInfo() {
  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Info om prøvene</h1>
      <p>
        Den offisielle norskprøven har fire nivåer: A1, A2, B1 og B2.
      </p>
      <p>
        Denne appen er øving. Den er ikke den offisielle prøven, og den
        gir ikke et offisielt resultat.
      </p>
      <p>Du kan øve på lesing, lytting, skriving og muntlig.</p>
      <p>På muntlig kan du fortelle, eller beskrive et bilde.</p>
      <p>
        Komplett kan ta en adaptiv prøve i lesing eller lytting. Den gir
        en nivågruppe til øving. Den er ikke offisiell.
      </p>
      <p>
        Vurdering av tekst og muntlig er ikke med i alle planer. Se{" "}
        <Link className="underline" href="/betaling">
          betaling
        </Link>
        .
      </p>
      <p>Du må være 18 år for å lage en konto.</p>
      <p>
        <Link className="underline" href="/personvern">
          Personvern
        </Link>
      </p>
      <p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </p>
      <p>
        <Link className="underline" href="/ov/lesing">
          Øv på lesing
        </Link>
      </p>
    </Ramme>
  );
}
