CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"alt_text" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_store" (
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"expires_at" bigint,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"external_id" text,
	"external_url" text,
	"error_message" text,
	"attempts" bigint DEFAULT 0 NOT NULL,
	"published_at" bigint,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"link_url" text,
	"media_id" text,
	"scheduled_at" bigint,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"account_id" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_oauth_store_namespace_key" ON "oauth_store" USING btree ("namespace","key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_delivery_post_platform" ON "post_deliveries" USING btree ("post_id","platform");--> statement-breakpoint
CREATE INDEX "idx_delivery_platform_status" ON "post_deliveries" USING btree ("platform","status");--> statement-breakpoint
CREATE INDEX "idx_posts_user_status_schedule" ON "posts" USING btree ("user_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_posts_status_schedule" ON "posts" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_connections_user_platform" ON "social_connections" USING btree ("user_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_connections_platform_account" ON "social_connections" USING btree ("platform","account_id");