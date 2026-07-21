PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_collector_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`collector_id` text NOT NULL,
	`source_id` text NOT NULL,
	`status` text NOT NULL,
	`mode` text DEFAULT 'dry-run' NOT NULL,
	`scheduled_for` text DEFAULT '1970-01-01T00:00:00.000Z' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`reports_seen` integer DEFAULT 0 NOT NULL,
	`reports_inserted` integer DEFAULT 0 NOT NULL,
	`duplicates_skipped` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`next_cursor` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer,
	`error_message` text,
	`next_retry_at` text,
	`network_accessed` integer DEFAULT false NOT NULL,
	`request_id` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `intelligence_sources`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "collector_runs_attempt_check" CHECK("__new_collector_runs"."attempt" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_collector_runs`("id", "collector_id", "source_id", "status", "mode", "scheduled_for", "attempt", "started_at", "completed_at", "reports_seen", "reports_inserted", "duplicates_skipped", "rejected_count", "next_cursor", "retry_count", "duration_ms", "error_message", "next_retry_at", "network_accessed", "request_id", "data_classification") SELECT "id", "collector_id", "source_id", "status", "mode", "started_at", 1, "started_at", "completed_at", "reports_seen", "reports_inserted", "duplicates_skipped", "rejected_count", "next_cursor", "retry_count", "duration_ms", "error_message", NULL, CASE WHEN "mode" = 'live' THEN true ELSE false END, "request_id", "data_classification" FROM `collector_runs`;--> statement-breakpoint
DROP TABLE `collector_runs`;--> statement-breakpoint
ALTER TABLE `__new_collector_runs` RENAME TO `collector_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `collector_runs_collector_time_idx` ON `collector_runs` (`collector_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `collector_runs_status_idx` ON `collector_runs` (`status`);--> statement-breakpoint
CREATE INDEX `collector_runs_retry_idx` ON `collector_runs` (`status`,`next_retry_at`);
