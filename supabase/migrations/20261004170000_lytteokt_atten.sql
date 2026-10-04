-- ============================================================
-- Fase 4: lyttebanken fylles til 18 oppgaver
-- ============================================================
-- Samme form som de fire første. Lydfilene ligger i web/public/lyd.
-- Teksten er den samme som blir sagt.

insert into public.oppgaver (
  id, type, ferdighet, "nivå", tema, kilde, status,
  kvalitetssjekket, innhold, lyd_url, transkripsjon, opprettet_dato
) values
(
  '11111111-1111-4111-8111-111111111605',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "På kafé",
    "tekst": "Sara drikker te på kafé. Kaken koster førti kroner.",
    "pastander": [
      {"id": "lyd-kafe-1", "tekst": "Sara drikker kaffe.", "korrekt": false},
      {"id": "lyd-kafe-2", "tekst": "Kaken koster førti kroner.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/kafe.mp3',
  'Sara drikker te på kafé. Kaken koster førti kroner.',
  '2026-10-04 12:04:00+00'
),
(
  '11111111-1111-4111-8111-111111111606',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Med toget",
    "tekst": "De tar toget til Bergen. Toget går klokka ti.",
    "pastander": [
      {"id": "lyd-tog-1", "tekst": "De tar buss til Bergen.", "korrekt": false},
      {"id": "lyd-tog-2", "tekst": "Toget går klokka ti.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/tog.mp3',
  'De tar toget til Bergen. Toget går klokka ti.',
  '2026-10-04 12:05:00+00'
),
(
  '11111111-1111-4111-8111-111111111607',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Hos legen",
    "tekst": "Ali er hos legen i dag. Legen sier at han skal hvile.",
    "pastander": [
      {"id": "lyd-lege-1", "tekst": "Ali er på skolen i dag.", "korrekt": false},
      {"id": "lyd-lege-2", "tekst": "Ali skal hvile.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/lege.mp3',
  'Ali er hos legen i dag. Legen sier at han skal hvile.',
  '2026-10-04 12:06:00+00'
),
(
  '11111111-1111-4111-8111-111111111608',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "På biblioteket",
    "tekst": "Nora låner to bøker. Biblioteket er åpent til fire.",
    "pastander": [
      {"id": "lyd-bibliotek-1", "tekst": "Nora låner to bøker.", "korrekt": true},
      {"id": "lyd-bibliotek-2", "tekst": "Biblioteket er stengt.", "korrekt": false}
    ]
  }$json$::jsonb,
  '/lyd/bibliotek.mp3',
  'Nora låner to bøker. Biblioteket er åpent til fire.',
  '2026-10-04 12:07:00+00'
),
(
  '11111111-1111-4111-8111-111111111609',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Til middag",
    "tekst": "Familien spiser fisk til middag. De drikker vann.",
    "pastander": [
      {"id": "lyd-middag-1", "tekst": "De spiser kjøtt til middag.", "korrekt": false},
      {"id": "lyd-middag-2", "tekst": "De drikker vann.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/middag.mp3',
  'Familien spiser fisk til middag. De drikker vann.',
  '2026-10-04 12:08:00+00'
),
(
  '11111111-1111-4111-8111-111111111610',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "I parken",
    "tekst": "Barna leker i parken. Det er varmt ute.",
    "pastander": [
      {"id": "lyd-park-1", "tekst": "Barna leker i parken.", "korrekt": true},
      {"id": "lyd-park-2", "tekst": "Det snør ute.", "korrekt": false}
    ]
  }$json$::jsonb,
  '/lyd/park.mp3',
  'Barna leker i parken. Det er varmt ute.',
  '2026-10-04 12:09:00+00'
),
(
  '11111111-1111-4111-8111-111111111611',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "På jobb",
    "tekst": "Erik jobber i en butikk. Han begynner klokka åtte.",
    "pastander": [
      {"id": "lyd-jobb-1", "tekst": "Erik jobber på et sykehus.", "korrekt": false},
      {"id": "lyd-jobb-2", "tekst": "Han begynner klokka åtte.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/jobb.mp3',
  'Erik jobber i en butikk. Han begynner klokka åtte.',
  '2026-10-04 12:10:00+00'
),
(
  '11111111-1111-4111-8111-111111111612',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Til skolen",
    "tekst": "Mia sykler til skolen. Skolen ligger nær hjemmet.",
    "pastander": [
      {"id": "lyd-sykkel-1", "tekst": "Mia kjører bil til skolen.", "korrekt": false},
      {"id": "lyd-sykkel-2", "tekst": "Skolen ligger nær hjemmet.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/sykkel.mp3',
  'Mia sykler til skolen. Skolen ligger nær hjemmet.',
  '2026-10-04 12:11:00+00'
),
(
  '11111111-1111-4111-8111-111111111613',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "På posten",
    "tekst": "Jonas henter en pakke på posten. Pakken er til moren.",
    "pastander": [
      {"id": "lyd-post-1", "tekst": "Jonas henter en pakke.", "korrekt": true},
      {"id": "lyd-post-2", "tekst": "Pakken er til faren.", "korrekt": false}
    ]
  }$json$::jsonb,
  '/lyd/post.mp3',
  'Jonas henter en pakke på posten. Pakken er til moren.',
  '2026-10-04 12:12:00+00'
),
(
  '11111111-1111-4111-8111-111111111614',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "En venn",
    "tekst": "Ingrid møter en venn på kafé. De snakker norsk.",
    "pastander": [
      {"id": "lyd-venn-1", "tekst": "Ingrid er alene på kafé.", "korrekt": false},
      {"id": "lyd-venn-2", "tekst": "De snakker norsk.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/venn.mp3',
  'Ingrid møter en venn på kafé. De snakker norsk.',
  '2026-10-04 12:13:00+00'
),
(
  '11111111-1111-4111-8111-111111111615',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Hunden",
    "tekst": "Familien har en hund. Hunden heter Tess.",
    "pastander": [
      {"id": "lyd-hund-1", "tekst": "Familien har en katt.", "korrekt": false},
      {"id": "lyd-hund-2", "tekst": "Hunden heter Tess.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/hund.mp3',
  'Familien har en hund. Hunden heter Tess.',
  '2026-10-04 12:14:00+00'
),
(
  '11111111-1111-4111-8111-111111111616',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Hjemme",
    "tekst": "De bor i en liten leilighet. Leiligheten har to rom.",
    "pastander": [
      {"id": "lyd-hjem-1", "tekst": "De bor i et stort hus.", "korrekt": false},
      {"id": "lyd-hjem-2", "tekst": "Leiligheten har to rom.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/hjem.mp3',
  'De bor i en liten leilighet. Leiligheten har to rom.',
  '2026-10-04 12:15:00+00'
),
(
  '11111111-1111-4111-8111-111111111617',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Fotball",
    "tekst": "Guttene spiller fotball på lørdag. Kampen er i parken.",
    "pastander": [
      {"id": "lyd-fotball-1", "tekst": "Guttene spiller fotball.", "korrekt": true},
      {"id": "lyd-fotball-2", "tekst": "Kampen er på skolen.", "korrekt": false}
    ]
  }$json$::jsonb,
  '/lyd/fotball.mp3',
  'Guttene spiller fotball på lørdag. Kampen er i parken.',
  '2026-10-04 12:16:00+00'
),
(
  '11111111-1111-4111-8111-111111111618',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Suppe",
    "tekst": "Hun lager suppe på kjøkkenet. Suppen er varm.",
    "pastander": [
      {"id": "lyd-suppe-1", "tekst": "Hun lager kake på kjøkkenet.", "korrekt": false},
      {"id": "lyd-suppe-2", "tekst": "Suppen er varm.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/suppe.mp3',
  'Hun lager suppe på kjøkkenet. Suppen er varm.',
  '2026-10-04 12:17:00+00'
)
on conflict (id) do nothing;
