export type Databehandler = {
  navn: string;
  hva: string;
  hvor: string;
  iBruk: boolean;
};

/** Alle har status ikke signert. Ikke legg inn en signert status her. */
export const databehandlere: Databehandler[] = [
  {
    navn: "Supabase",
    hva: "Database og innlogging. E-post, passord, profil, svar, økter, vurdering og bestillinger.",
    hvor: "Planen er Irland, i EU/EØS. På denne maskinen er data bare til utvikling.",
    iBruk: true,
  },
  {
    navn: "Vercel",
    hva: "Nettsiden, når prosjektet er satt opp.",
    hvor: "Skal være i EU/EØS. Prosjektet er ikke satt opp.",
    iBruk: false,
  },
  {
    navn: "Google",
    hva: "Tekst, lyd og bilder, hvis vi slår det på senere.",
    hvor: "Ikke valgt. Vi bruker dem ikke nå.",
    iBruk: false,
  },
  {
    navn: "Stripe",
    hva: "Kortbetaling senere. Kortnummer skal ikke ligge hos oss.",
    hvor: "Ikke valgt. Vi bruker dem ikke nå.",
    iBruk: false,
  },
  {
    navn: "Vipps",
    hva: "Betaling senere.",
    hvor: "Ikke valgt. Vi bruker dem ikke nå.",
    iBruk: false,
  },
];
