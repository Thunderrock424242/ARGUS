CREATE TABLE `ingestion_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`attempt` integer NOT NULL,
	`state` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`error_code` text,
	`error_message` text,
	`request_id` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `ingestion_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ingestion_attempts_attempt_check" CHECK("ingestion_attempts"."attempt" >= 1),
	CONSTRAINT "ingestion_attempts_state_check" CHECK("ingestion_attempts"."state" in ('accepted', 'failed', 'retried'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_attempts_submission_attempt_unique` ON `ingestion_attempts` (`submission_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `ingestion_attempts_state_time_idx` ON `ingestion_attempts` (`state`,`completed_at`);--> statement-breakpoint
CREATE TABLE `ingestion_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text,
	`idempotency_key` text NOT NULL,
	`content_hash` text NOT NULL,
	`url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`body_text` text,
	`author` text,
	`language` text DEFAULT 'en' NOT NULL,
	`published_at` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`country_code` text,
	`category` text,
	`status` text DEFAULT 'needs-review' NOT NULL,
	`duplicate_of_report_id` text,
	`attempts` integer DEFAULT 1 NOT NULL,
	`last_error` text,
	`next_retry_at` text,
	`submitted_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by_id` text,
	`reviewed_by_name` text,
	`review_reason` text,
	`provenance` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ingestion_submissions_status_check" CHECK("ingestion_submissions"."status" in ('needs-review', 'duplicate', 'approved', 'rejected', 'failed')),
	CONSTRAINT "ingestion_submissions_attempts_check" CHECK("ingestion_submissions"."attempts" >= 1),
	CONSTRAINT "ingestion_submissions_version_check" CHECK("ingestion_submissions"."version" >= 1),
	CONSTRAINT "ingestion_submissions_coordinates_check" CHECK(("ingestion_submissions"."latitude" is null and "ingestion_submissions"."longitude" is null) or ("ingestion_submissions"."latitude" between -90 and 90 and "ingestion_submissions"."longitude" between -180 and 180))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_submissions_idempotency_unique` ON `ingestion_submissions` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_submissions_source_external_unique` ON `ingestion_submissions` (`source_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `ingestion_submissions_status_updated_idx` ON `ingestion_submissions` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `ingestion_submissions_content_hash_idx` ON `ingestion_submissions` (`content_hash`);--> statement-breakpoint
CREATE INDEX `ingestion_submissions_source_idx` ON `ingestion_submissions` (`source_id`,`submitted_at`);