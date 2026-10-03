-- Nidaa — active la sécurité au niveau des lignes (RLS) sur toutes les tables du schéma public, SANS aucune politique.
--
-- Pourquoi : chaque projet Supabase expose automatiquement le schéma public par une API REST (PostgREST), utilisable
-- avec la clé « anon », qui est publique par nature. Sans RLS, n'importe qui connaissant l'URL du projet pourrait
-- lire ou modifier les tables (comptes, jetons, journal…). Avec RLS activée et aucune politique, les rôles de cette
-- API (anon, authenticated) ne voient et ne modifient aucune ligne.
--
-- L'API Nidaa n'est pas concernée : elle se connecte directement à PostgreSQL avec le rôle propriétaire des tables
-- (postgres), auquel la RLS ne s'applique pas (pas de FORCE ROW LEVEL SECURITY). La clé « service role » contourne
-- aussi la RLS : elle doit rester côté serveur.
--
-- À exécuter dans Supabase → SQL Editor après CHAQUE migration qui crée une table (le script est relançable).
do $$
declare
  t record;
begin
  for t in select schemaname, tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
    raise notice 'RLS activée : %.%', t.schemaname, t.tablename;
  end loop;
end
$$;

-- Contrôle : la requête doit ne renvoyer aucune ligne.
select tablename as table_sans_rls from pg_tables where schemaname = 'public' and not rowsecurity;
