CREATE TABLE `orbital_source_snapshots` (
	`source_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`source_version` text,
	`source_timestamp` text,
	`record_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` text NOT NULL,
	`last_successful_at` text,
	`next_refresh_at` text NOT NULL,
	`error_message` text,
	`updated_at` text NOT NULL,
	CONSTRAINT "orbital_source_snapshots_count_check" CHECK("orbital_source_snapshots"."record_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `orbital_source_snapshots_status_idx` ON `orbital_source_snapshots` (`status`,`next_refresh_at`);