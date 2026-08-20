CREATE TABLE "bill_sponsors" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer,
	"people_id" integer,
	"name" text,
	"party" text,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"bill_id" integer PRIMARY KEY NOT NULL,
	"bill_number" text,
	"title" text,
	"status" text,
	"chamber" text,
	"change_hash" text,
	"last_action" text,
	"last_action_date" text,
	"url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legislators" (
	"people_id" integer PRIMARY KEY NOT NULL,
	"name" text,
	"party" text,
	"role" text,
	"district" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_bill_id_bills_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("bill_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_people_id_legislators_people_id_fk" FOREIGN KEY ("people_id") REFERENCES "public"."legislators"("people_id") ON DELETE no action ON UPDATE no action;