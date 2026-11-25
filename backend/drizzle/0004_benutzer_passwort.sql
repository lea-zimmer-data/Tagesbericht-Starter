ALTER TABLE "benutzer" DROP CONSTRAINT "benutzer_org_id_email_unique";--> statement-breakpoint
ALTER TABLE "benutzer" ADD COLUMN "passwort_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "benutzer_email_unique" ON "benutzer" USING btree (lower("email"));