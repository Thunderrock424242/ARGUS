CREATE TABLE `auth_rate_limits` (
	`key_hash` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`key_hash`, `window_started_at`),
	CONSTRAINT "auth_rate_limits_count_check" CHECK("auth_rate_limits"."count" >= 1)
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limits_expiry_idx` ON `auth_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_used_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_unique` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry_idx` ON `auth_sessions` (`expires_at`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `auth_user_roles` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`granted_at` text NOT NULL,
	`granted_by` text NOT NULL,
	PRIMARY KEY(`user_id`, `role`),
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_user_roles_role_check" CHECK("auth_user_roles"."role" in ('viewer', 'analyst', 'reviewer', 'source-manager', 'administrator'))
);
--> statement-breakpoint
CREATE INDEX `auth_user_roles_role_idx` ON `auth_user_roles` (`role`,`user_id`);--> statement-breakpoint
CREATE TABLE `auth_users` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`login` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_authenticated_at` text NOT NULL,
	CONSTRAINT "auth_users_provider_check" CHECK("auth_users"."provider" = 'github'),
	CONSTRAINT "auth_users_status_check" CHECK("auth_users"."status" in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_provider_subject_unique` ON `auth_users` (`provider`,`provider_subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_provider_login_unique` ON `auth_users` (`provider`,`login`);--> statement-breakpoint
CREATE INDEX `auth_users_status_idx` ON `auth_users` (`status`);