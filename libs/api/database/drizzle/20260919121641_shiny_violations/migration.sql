CREATE TABLE "hiking_downward"."audit_event" (
	"id" text PRIMARY KEY,
	"event_type" text NOT NULL,
	"actor_user_id" text,
	"target_user_id" text,
	"resource_type" text,
	"resource_id" text,
	"path" text,
	"request_id" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_event_type_created_at_idx" ON "hiking_downward"."audit_event" ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "audit_event_actor_user_id_idx" ON "hiking_downward"."audit_event" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_event_target_user_id_idx" ON "hiking_downward"."audit_event" ("target_user_id");--> statement-breakpoint
CREATE INDEX "audit_event_resource_idx" ON "hiking_downward"."audit_event" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_event_request_id_idx" ON "hiking_downward"."audit_event" ("request_id");