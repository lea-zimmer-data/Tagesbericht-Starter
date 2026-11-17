-- Row-Level-Security für die Mandantentrennung (R-4.2), handgeschrieben.
-- Der Kontext kommt aus app.current_org, gesetzt pro Transaktion mit
-- set_config('app.current_org', <org_id>, true). Ohne Kontext liefert
-- current_setting(..., true) NULL oder (nach einer Transaktion auf derselben
-- Verbindung) '' -> nullif macht daraus NULL, die Bedingung ist nie wahr.
-- FORCE gilt auch für die Eigentümerin (Migrationsrolle).

ALTER TABLE benutzer ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE benutzer FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY benutzer_mandant ON benutzer
  USING (org_id = nullif(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.current_org', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE einladung ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE einladung FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY einladung_mandant ON einladung
  USING (org_id = nullif(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.current_org', true), '')::uuid);
--> statement-breakpoint

-- Anwendungsrolle (eingerichtet durch npm run db:rollen): nur lesen, anlegen,
-- ändern. Kein DELETE (R-5.5), keine Rechte auf organisation.
GRANT SELECT, INSERT, UPDATE ON benutzer, einladung TO tagesbericht_app;
