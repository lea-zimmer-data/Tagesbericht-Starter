-- Handgeschrieben. Zwei Teile:
-- 1. Anmeldefunktion: Das Login muss einen Benutzer über die E-Mail finden,
--    bevor app.current_org bekannt ist. Statt RLS für tagesbericht_app zu
--    lockern, gibt es genau eine Funktion mit SECURITY DEFINER. Sie gehört der
--    Rolle tagesbericht_anmeldung (NOLOGIN, eingerichtet durch npm run db:rollen),
--    die nur diese Spalten lesen darf und nur dafür eine eigene Policy hat.
--    Die Funktion liefert höchstens eine Zeile zu einer exakt angegebenen
--    E-Mail, keine Namen, keine Listen, keine Mustersuche.
-- 2. organisation: Die Anwendung darf nur die eigene Organisation lesen.

GRANT SELECT (id, org_id, email, passwort_hash, aktiv) ON benutzer TO tagesbericht_anmeldung;
--> statement-breakpoint
CREATE POLICY benutzer_anmeldung ON benutzer
  FOR SELECT TO tagesbericht_anmeldung
  USING (true);
--> statement-breakpoint
CREATE FUNCTION anmeldung_benutzer(p_email text)
RETURNS TABLE (id uuid, org_id uuid, passwort_hash text, aktiv boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT b.id, b.org_id, b.passwort_hash, b.aktiv
  FROM public.benutzer b
  WHERE lower(b.email) = lower(p_email)
  LIMIT 1;
$$;
--> statement-breakpoint
-- Rechte vor dem Eigentümerwechsel setzen: Danach darf die Migrationsrolle
-- sie nicht mehr ändern. Die ACL geht mit auf die neue Eigentümerin über.
REVOKE ALL ON FUNCTION anmeldung_benutzer(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION anmeldung_benutzer(text) TO tagesbericht_app;
--> statement-breakpoint
-- ALTER ... OWNER verlangt CREATE auf dem Schema für die neue Eigentümerin.
-- Das Recht gilt nur für diesen Schritt und wird sofort wieder entzogen.
GRANT CREATE ON SCHEMA public TO tagesbericht_anmeldung;
--> statement-breakpoint
ALTER FUNCTION anmeldung_benutzer(text) OWNER TO tagesbericht_anmeldung;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM tagesbericht_anmeldung;
--> statement-breakpoint

-- organisation hat keine org_id; die Policy vergleicht id mit app.current_org.
-- ENABLE ohne FORCE: Die Eigentümerin (Migrationsrolle) legt Organisationen an
-- (npm run seed, Tests). Für tagesbericht_app gilt RLS, weil sie nicht
-- Eigentümerin ist. Nur SELECT: organisation bleibt für die Anwendung
-- schreibgeschützt.
ALTER TABLE organisation ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organisation_eigene ON organisation
  FOR SELECT
  USING (id = nullif(current_setting('app.current_org', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT ON organisation TO tagesbericht_app;
