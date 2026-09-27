CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`alt_text` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_store` (
	`namespace` text NOT NULL,
	`key` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`expires_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_store_namespace_key` ON `oauth_store` (`namespace`,`key`);--> statement-breakpoint
CREATE TABLE `post_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`platform` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`external_id` text,
	`external_url` text,
	`error_message` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_delivery_post_platform` ON `post_deliveries` (`post_id`,`platform`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`link_url` text,
	`media_id` text,
	`scheduled_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`account_id` text NOT NULL,
	`handle` text NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'connected' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_connections_user_platform` ON `social_connections` (`user_id`,`platform`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_connections_platform_account` ON `social_connections` (`platform`,`account_id`);