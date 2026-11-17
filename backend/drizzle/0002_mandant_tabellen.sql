CREATE TYPE "public"."rolle" AS ENUM('mitarbeiter', 'bauleitung');--> statement-breakpoint
CREATE TABLE "benutzer" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"rolle" "rolle" NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"letzter_login" timestamp with time zone,
	CONSTRAINT "benutzer_org_id_email_unique" UNIQUE("org_id","email")
);
--> statement-breakpoint
CREATE TABLE "einladung" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"rolle" "rolle" NOT NULL,
	"token_hash" text NOT NULL,
	"gueltig_bis" timestamp with time zone NOT NULL,
	"eingeloest_am" timestamp with time zone,
	CONSTRAINT "einladung_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "organisation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"anschrift" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "benutzer" ADD CONSTRAINT "benutzer_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einladung" ADD CONSTRAINT "einladung_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;