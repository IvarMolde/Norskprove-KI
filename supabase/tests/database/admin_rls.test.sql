begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

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
    '11000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin-rls@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'elev-rls@example.test',
    '',
    now(),
    now(),
    now()
  );

insert into public.admin_brukere (bruker_id, rolle)
values ('11000000-0000-0000-0000-000000000001', 'admin');

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
values (
  '31000000-0000-0000-0000-000000000001',
  'fyll_inn',
  'lesing',
  'A1',
  'autentisk',
  'kladd',
  false,
  '{"instruksjon":"Admin-kladd"}'::jsonb
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.er_admin(),
  false,
  'elev blir ikke behandlet som administrator'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.er_admin(),
  true,
  'aktiv administrator gjenkjennes'
);

select is(
  (select count(*) from public.oppgaver where status = 'kladd'),
  1::bigint,
  'administrator kan lese kladder'
);

select lives_ok(
  $sql$
    insert into public.oppgaver (
      id, type, ferdighet, nivå, kilde, status, kvalitetssjekket, innhold
    )
    values (
      '31000000-0000-0000-0000-000000000002',
      'fyll_inn',
      'lesing',
      'A1',
      'autentisk',
      'kladd',
      false,
      '{"instruksjon":"Ny admin-kladd"}'::jsonb
    )
  $sql$,
  'administrator kan opprette kladder'
);

select lives_ok(
  $sql$
    update public.oppgaver
    set tema = 'oppdatert av administrator'
    where id = '31000000-0000-0000-0000-000000000001'
  $sql$,
  'administrator kan redigere kladder'
);

select lives_ok(
  $sql$
    insert into public.bilder (
      id, url, beskrivelse, kilde, opprettet_av
    )
    values (
      '21000000-0000-0000-0000-000000000001',
      'admin-test/bilde.webp',
      'Midlertidig adminbilde',
      'opplastet',
      '11000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'administrator kan opprette bildemetadata'
);

select lives_ok(
  $sql$
    update public.bilder
    set
      status = 'godkjent',
      godkjent_av = '11000000-0000-0000-0000-000000000001',
      godkjent_dato = now()
    where id = '21000000-0000-0000-0000-000000000001'
  $sql$,
  'administrator kan godkjenne bilde'
);

select lives_ok(
  $sql$
    insert into public.lydfiler (
      id, storage_path, navn, kilde, mime_type, opprettet_av
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'admin-test/lyd.webm',
      'Midlertidig lyd',
      'opptak',
      'audio/webm',
      '11000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'administrator kan opprette lydmetadata'
);

select lives_ok(
  $sql$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'admin-bilder',
      'admin-test/bilde.webp',
      '11000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'administrator kan opprette objekt i privat adminbøtte'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'admin-bilder'),
  1::bigint,
  'administrator kan lese objekt i privat adminbøtte'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.er_admin(),
  false,
  'elev mangler administratorrolle'
);

select is(
  (select count(*) from public.oppgaver),
  0::bigint,
  'elev kan ikke lese admin-kladdene'
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
      '{"instruksjon":"Ulovlig elevkladd"}'::jsonb
    )
  $sql$,
  '42501',
  null,
  'elev kan ikke opprette admininnhold'
);

select is(
  (select count(*) from public.bilder where status = 'venter_godkjenning'),
  0::bigint,
  'elev kan ikke lese bilde som venter på godkjenning'
);

select is(
  (select count(*) from public.lydfiler),
  0::bigint,
  'elev kan ikke lese lydmetadata'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'admin-bilder'),
  0::bigint,
  'elev kan ikke lese privat adminobjekt'
);

select throws_ok(
  $sql$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'admin-bilder',
      'elev-test/ulovlig.webp',
      '11000000-0000-0000-0000-000000000002'
    )
  $sql$,
  '42501',
  null,
  'elev kan ikke opprette objekt i privat adminbøtte'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*) from public.oppgaver),
  0::bigint,
  'anonym bruker kan ikke lese admin-kladdene'
);

select is(
  (select count(*) from public.lydfiler),
  0::bigint,
  'anonym bruker kan ikke lese lydmetadata'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'admin-bilder'),
  0::bigint,
  'anonym bruker kan ikke lese privat adminobjekt'
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
      '{"instruksjon":"Ulovlig anonym kladd"}'::jsonb
    )
  $sql$,
  '42501',
  null,
  'anonym bruker kan ikke opprette admininnhold'
);

reset role;
select * from finish();
rollback;
