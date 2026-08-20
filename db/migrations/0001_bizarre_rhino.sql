CREATE TABLE "vote_detail" (
	"id" serial PRIMARY KEY NOT NULL,
	"roll_call_id" integer,
	"people_id" integer,
	"name" text,
	"party" text,
	"vote" text
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"roll_call_id" integer PRIMARY KEY NOT NULL,
	"bill_id" integer,
	"date" text,
	"chamber" text,
	"yea" integer,
	"nay" integer,
	"nv" integer,
	"absent" integer,
	"passed" boolean
);
--> statement-breakpoint
ALTER TABLE "vote_detail" ADD CONSTRAINT "vote_detail_roll_call_id_votes_roll_call_id_fk" FOREIGN KEY ("roll_call_id") REFERENCES "public"."votes"("roll_call_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_detail" ADD CONSTRAINT "vote_detail_people_id_legislators_people_id_fk" FOREIGN KEY ("people_id") REFERENCES "public"."legislators"("people_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_bill_id_bills_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("bill_id") ON DELETE no action ON UPDATE no action;