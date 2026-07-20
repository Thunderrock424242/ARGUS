DROP INDEX `auth_users_provider_login_unique`;--> statement-breakpoint
CREATE INDEX `auth_users_provider_login_idx` ON `auth_users` (`provider`,`login`);