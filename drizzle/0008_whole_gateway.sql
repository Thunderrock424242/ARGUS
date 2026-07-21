PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ingestion_submissions` (
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
	`confidence` integer DEFAULT 25 NOT NULL,
	`confidence_updated_at` text,
	`confidence_updated_by_id` text,
	`confidence_updated_by_name` text,
	`confidence_update_reason` text,
	`provenance` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ingestion_submissions_status_check" CHECK("__new_ingestion_submissions"."status" in ('needs-review', 'duplicate', 'approved', 'rejected', 'failed')),
	CONSTRAINT "ingestion_submissions_attempts_check" CHECK("__new_ingestion_submissions"."attempts" >= 1),
	CONSTRAINT "ingestion_submissions_confidence_check" CHECK("__new_ingestion_submissions"."confidence" between 0 and 99),
	CONSTRAINT "ingestion_submissions_version_check" CHECK("__new_ingestion_submissions"."version" >= 1),
	CONSTRAINT "ingestion_submissions_coordinates_check" CHECK(("__new_ingestion_submissions"."latitude" is null and "__new_ingestion_submissions"."longitude" is null) or ("__new_ingestion_submissions"."latitude" between -90 and 90 and "__new_ingestion_submissions"."longitude" between -180 and 180))
);
--> statement-breakpoint
INSERT INTO `__new_ingestion_submissions`("id", "source_id", "external_id", "idempotency_key", "content_hash", "url", "normalized_url", "title", "description", "body_text", "author", "language", "published_at", "latitude", "longitude", "country_code", "category", "status", "duplicate_of_report_id", "attempts", "last_error", "next_retry_at", "submitted_at", "updated_at", "reviewed_at", "reviewed_by_id", "reviewed_by_name", "review_reason", "confidence", "confidence_updated_at", "confidence_updated_by_id", "confidence_updated_by_name", "confidence_update_reason", "provenance", "data_classification", "demo_data_label", "version") SELECT "id", "source_id", "external_id", "idempotency_key", "content_hash", "url", "normalized_url", "title", "description", "body_text", "author", "language", "published_at", "latitude", "longitude", "country_code", "category", "status", "duplicate_of_report_id", "attempts", "last_error", "next_retry_at", "submitted_at", "updated_at", "reviewed_at", "reviewed_by_id", "reviewed_by_name", "review_reason", CASE WHEN "status" = 'approved' THEN 60 ELSE 25 END, CASE WHEN "status" = 'approved' THEN "reviewed_at" ELSE NULL END, CASE WHEN "status" = 'approved' THEN "reviewed_by_id" ELSE NULL END, CASE WHEN "status" = 'approved' THEN "reviewed_by_name" ELSE NULL END, CASE WHEN "status" = 'approved' THEN "review_reason" ELSE NULL END, "provenance", "data_classification", "demo_data_label", "version" FROM `ingestion_submissions`;--> statement-breakpoint
DROP TABLE `ingestion_submissions`;--> statement-breakpoint
ALTER TABLE `__new_ingestion_submissions` RENAME TO `ingestion_submissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_submissions_idempotency_unique` ON `ingestion_submissions` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_submissions_source_external_unique` ON `ingestion_submissions` (`source_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `ingestion_submissions_status_updated_idx` ON `ingestion_submissions` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `ingestion_submissions_content_hash_idx` ON `ingestion_submissions` (`content_hash`);--> statement-breakpoint
CREATE INDEX `ingestion_submissions_source_idx` ON `ingestion_submissions` (`source_id`,`submitted_at`);
