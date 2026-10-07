import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";

export default function Personvern() {
  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Personvern</h1>
      <p className="text-base">Utkast. Denne teksten er ikke ferdig.</p>
      <p>
        Norskprøve-KI er en øvingsapp for norskprøven. Vi har ikke skrevet
        organisasjonsnummer, adresse eller e-post her. De kommer før vi
        åpner for alle.
      </p>
      <h2 className="text-xl font-semibold">Hva vi lagrer</h2>
      <ul className="list-disc pl-6">
        <li>E-post og passord. Passordet ligger hos innloggingen.</li>
        <li>Profilen din: plan, om du har sagt at du er 18 år, og nivå.</li>
        <li>Svarene dine og øktene dine.</li>
        <li>Nivågruppen fra en adaptiv prøve i lesing eller lytting.</li>
        <li>Vurdering av tekst, når du har den rettigheten.</li>
        <li>Bestilling av plan: hvilken plan, beløp og status.</li>
      </ul>
      <h2 className="text-xl font-semibold">Hvor det ligger</h2>
      <p>
        Når vi åpner for alle, skal data ligge i EU/EØS, i Irland. På denne
        maskinen er data bare til utvikling. Det er ikke den ferdige
        tjenesten.
      </p>
      <h2 className="text-xl font-semibold">Hvorfor</h2>
      <p>
        Vi lagrer dette fordi du bruker appen. Grunnlaget er avtalen om
        øvingen. Vi har ikke et samtykkebanner. Vi måler ikke besøk.
      </p>
      <p>
        Vi bruker bare informasjonskapsler som trengs for at du skal holde
        deg innlogget.
      </p>
      <h2 className="text-xl font-semibold">Hvor lenge</h2>
      <p>Skriftlige svar blir liggende så lenge kontoen er aktiv.</p>
      <p>Lyd slettes etter 30 dager.</p>
      <p>
        En lærer kan høre muntlige opptak. Nye opptak merkes til en lærer
        har åpnet dem. Læreren kan skrive en kommentar om nivået. Eleven
        kan lese den.
      </p>
      <h2 className="text-xl font-semibold">Alder</h2>
      <p>
        Du må være 18 år. Når du registrerer deg, sier du det selv. Vi
        lagrer det som egenerklæring.
      </p>
      <h2 className="text-xl font-semibold">Dine rettigheter</h2>
      <p>Du kan slette kontoen din selv. Se under.</p>
        <p>
          Du kan se det vi har lagret, og velge nivå. Der ser du svarene
          dine og vurderingsteksten.
        </p>
      <p>
        <Link className="underline" href="/mine-data">
          Mine data
        </Link>
      </p>
      <p>Du kan klage til Datatilsynet.</p>
      <h2 className="text-xl font-semibold">Slette konto</h2>
      <p>
        Når du er innlogget, kan du slette kontoen din. Da slettes svar,
        økter, vurdering og bestillinger. Oppgaver i banken blir liggende.
      </p>
      <p>
        <Link className="underline" href="/konto">
          Slett konto
        </Link>
      </p>
      <p>
        Avtaler med leverandørene er ikke signert. De skal være på plass
        før vi åpner for alle.
      </p>
      <p>
        <Link className="underline" href="/databehandlere">
          Databehandleravtaler
        </Link>
      </p>
      <p>
        <Link className="underline" href="/prove">
          Info om prøvene
        </Link>
      </p>
      <p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </p>
    </Ramme>
  );
}
