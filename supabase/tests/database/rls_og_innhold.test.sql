begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'elev1@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'elev2@example.test',
    '',
    now(),
    now(),
    now()
  );

select is(
  (select count(*) from public.brukerprofil where id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'registrering oppretter profil for første bruker'
);

select is(
  (select count(*) from public.brukerprofil where id = '10000000-0000-0000-0000-000000000002'),
  1::bigint,
  'registrering oppretter profil for andre bruker'
);

insert into public.bilder (
  id,
  url,
  beskrivelse,
  kilde,
  status,
  opprettet_av
)
values (
  '20000000-0000-0000-0000-000000000001',
  'tester/opplastet.webp',
  'Et opplastet testbilde',
  'opplastet',
  'godkjent',
  '10000000-0000-0000-0000-000000000001'
);

select is(
  (select status from public.bilder where id = '20000000-0000-0000-0000-000000000001'),
  'venter_godkjenning',
  'opplastet bilde kan ikke omgå godkjenningskøen'
);

insert into public.bilder (
  id,
  url,
  beskrivelse,
  kilde,
  status
)
values (
  '20000000-0000-0000-0000-000000000002',
  'tester/ki.webp',
  'Et KI-generert testbilde',
  'ki_generert',
  'avvist'
);

select is(
  (select status from public.bilder where id = '20000000-0000-0000-0000-000000000002'),
  'godkjent',
  'KI-generert bilde godkjennes ved opprettelse'
);

select throws_ok(
  $sql$
    insert into public.oppgaver (
      type, ferdighet, nivå, kilde, status, kvalitetssjekket, innhold
    )
    values (
      'fyll_inn', 'lesing', 'A1', 'autentisk', 'kladd', false, '{}'::jsonb
    )
  $sql$,
  '23514',
  null,
  'tomt oppgaveinnhold avvises'
);

select throws_ok(
  $sql$
    insert into public.oppgaver (
      type, ferdighet, nivå, kilde, status, kvalitetssjekket, innhold
    )
    values (
      'fyll_inn',
      'lesing',
      'A1',
      'autentisk',
      'publisert',
      false,
      '{"instruksjon":"Test"}'::jsonb
    )
  $sql$,
  '23514',
  null,
  'ukvalitetssjekket oppgave kan ikke publiseres'
);

select throws_ok(
  $sql$
    insert into public.oppgaver (
      type,
      ferdighet,
      nivå,
      kilde,
      status,
      kvalitetssjekket,
      innhold,
      bilde_id
    )
    values (
      'velg_bilde',
      'lesing',
      'A1',
      'autentisk',
      'publisert',
      true,
      '{"instruksjon":"Velg bilde"}'::jsonb,
      '20000000-0000-0000-0000-000000000001'
    )
  $sql$,
  '23514',
  'En publisert oppgave kan bare bruke et godkjent bilde',
  'publisert oppgave kan ikke bruke bilde som venter'
);

insert into public.oppgaver (
  id,
  type,
  ferdighet,
  nivå,
  kilde,
  status,
  kvalitetssjekket,
  innhold
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    'fyll_inn',
    'lesing',
    'A1',
    'autentisk',
    'kladd',
    false,
    '{"instruksjon":"Kladd"}'::jsonb
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'fyll_inn',
    'lesing',
    'A1',
    'autentisk',
    'publisert',
    true,
    '{"instruksjon":"Publisert"}'::jsonb
  );

set local role anon;
select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);

select is(
  (select count(*) from public.oppgaver),
  0::bigint,
  'anonym bruker kan ikke lese oppgaver'
);

select is(
  (select count(*) from public.bilder),
  0::bigint,
  'anonym bruker kan ikke lese bilder'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select results_eq(
  'select status from public.oppgaver order by status',
  array['publisert']::text[],
  'elev kan bare lese publiserte oppgaver'
);

select is(
  (select count(*) from public.brukerprofil),
  1::bigint,
  'elev kan bare lese egen profil'
);

select throws_ok(
  $sql$
    insert into public.oppgaver (
      type, ferdighet, nivå, kilde, status, kvalitetssjekket, innhold
    )
    values (
      'fyll_inn',
      'lesing',
      'A1',
      'autentisk',
      'kladd',
      false,
      '{"instruksjon":"Ulovlig"}'::jsonb
    )
  $sql$,
  '42501',
  null,
  'elev kan ikke opprette oppgaver'
);

reset role;
select * from finish();
rollback;
