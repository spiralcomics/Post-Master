CREATE INDEX `idx_delivery_platform_status` ON `post_deliveries` (`platform`,`status`);--> statement-breakpoint
CREATE INDEX `idx_posts_user_status_schedule` ON `posts` (`user_id`,`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_status_schedule` ON `posts` (`status`,`scheduled_at`);