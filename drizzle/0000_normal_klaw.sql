CREATE TABLE `analyst_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`action` text NOT NULL,
	`state_before` text,
	`state_after` text,
	`notes` text,
	`reviewer_id` text,
	`reviewer_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `intelligence_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `analyst_reviews_event_time_idx` ON `analyst_reviews` (`event_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `analyst_reviews_action_idx` ON `analyst_reviews` (`action`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`summary` text NOT NULL,
	`before` text,
	`after` text,
	`reason` text,
	`correlation_id` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_target_idx` ON `audit_logs` (`target_type`,`target_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_type`,`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_correlation_idx` ON `audit_logs` (`correlation_id`);--> statement-breakpoint
CREATE TABLE `claim_report_evidence` (
	`claim_id` text NOT NULL,
	`report_id` text NOT NULL,
	`relationship` text NOT NULL,
	PRIMARY KEY(`claim_id`, `report_id`, `relationship`),
	FOREIGN KEY (`claim_id`) REFERENCES `intelligence_claims`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`report_id`) REFERENCES `source_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `claim_report_evidence_report_idx` ON `claim_report_evidence` (`report_id`);--> statement-breakpoint
CREATE TABLE `collector_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`collector_id` text NOT NULL,
	`source_id` text NOT NULL,
	`status` text NOT NULL,
	`mode` text DEFAULT 'dry-run' NOT NULL,
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
	`request_id` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `intelligence_sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `collector_runs_collector_time_idx` ON `collector_runs` (`collector_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `collector_runs_status_idx` ON `collector_runs` (`status`);--> statement-breakpoint
CREATE TABLE `confidence_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`score` integer NOT NULL,
	`label` text NOT NULL,
	`positive_factors` text NOT NULL,
	`negative_factors` text NOT NULL,
	`calculated_at` text NOT NULL,
	`model_version` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `intelligence_events`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "confidence_assessments_score_check" CHECK("confidence_assessments"."score" between 0 and 99)
);
--> statement-breakpoint
CREATE INDEX `confidence_assessments_event_time_idx` ON `confidence_assessments` (`event_id`,`calculated_at`);--> statement-breakpoint
CREATE TABLE `event_report_links` (
	`event_id` text NOT NULL,
	`report_id` text NOT NULL,
	`relationship` text DEFAULT 'supporting' NOT NULL,
	`correlation_score` integer,
	`linked_at` text NOT NULL,
	PRIMARY KEY(`event_id`, `report_id`),
	FOREIGN KEY (`event_id`) REFERENCES `intelligence_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`report_id`) REFERENCES `source_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_report_links_report_idx` ON `event_report_links` (`report_id`);--> statement-breakpoint
CREATE TABLE `intelligence_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`classification_label` text DEFAULT 'DEMONSTRATION DATA' NOT NULL,
	`generated_by` text NOT NULL,
	`generated_at` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`content` text NOT NULL,
	`event_ids` text NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intelligence_briefs_slug_unique` ON `intelligence_briefs` (`slug`);--> statement-breakpoint
CREATE INDEX `intelligence_briefs_generated_idx` ON `intelligence_briefs` (`generated_at`);--> statement-breakpoint
CREATE TABLE `intelligence_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`text` text NOT NULL,
	`confidence` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `intelligence_events`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "intelligence_claims_confidence_check" CHECK("intelligence_claims"."confidence" between 0 and 99)
);
--> statement-breakpoint
CREATE INDEX `intelligence_claims_event_idx` ON `intelligence_claims` (`event_id`);--> statement-breakpoint
CREATE INDEX `intelligence_claims_status_idx` ON `intelligence_claims` (`status`);--> statement-breakpoint
CREATE TABLE `intelligence_events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`severity` integer NOT NULL,
	`automated_confidence` integer NOT NULL,
	`confidence_label` text NOT NULL,
	`verification_state` text NOT NULL,
	`country_code` text,
	`country_name` text,
	`region` text,
	`location_name` text,
	`latitude` real,
	`longitude` real,
	`first_detected_at` text NOT NULL,
	`last_updated_at` text NOT NULL,
	`tags` text NOT NULL,
	`related_event_ids` text NOT NULL,
	`entity_ids` text NOT NULL,
	`analyst_notes` text,
	`aether_assessment` text,
	`reviewed_at` text,
	`reviewer_name` text,
	`pinned` integer DEFAULT false NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "intelligence_events_severity_check" CHECK("intelligence_events"."severity" between 1 and 5),
	CONSTRAINT "intelligence_events_confidence_check" CHECK("intelligence_events"."automated_confidence" between 0 and 99)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intelligence_events_slug_unique` ON `intelligence_events` (`slug`);--> statement-breakpoint
CREATE INDEX `intelligence_events_status_idx` ON `intelligence_events` (`status`);--> statement-breakpoint
CREATE INDEX `intelligence_events_category_idx` ON `intelligence_events` (`category`);--> statement-breakpoint
CREATE INDEX `intelligence_events_region_idx` ON `intelligence_events` (`region`);--> statement-breakpoint
CREATE INDEX `intelligence_events_review_idx` ON `intelligence_events` (`verification_state`,`severity`);--> statement-breakpoint
CREATE INDEX `intelligence_events_updated_idx` ON `intelligence_events` (`last_updated_at`);--> statement-breakpoint
CREATE TABLE `intelligence_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`organization` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`country_code` text,
	`region` text,
	`categories` text NOT NULL,
	`reliability_score` integer NOT NULL,
	`independence_group` text NOT NULL,
	`limitations` text NOT NULL,
	`attribution_requirements` text NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`schedule` text NOT NULL,
	`rate_limit_per_minute` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`last_checked_at` text,
	`last_successful_collection_at` text,
	`recent_failure_count` integer DEFAULT 0 NOT NULL,
	`reports_collected` integer DEFAULT 0 NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "intelligence_sources_reliability_check" CHECK("intelligence_sources"."reliability_score" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intelligence_sources_url_unique` ON `intelligence_sources` (`url`);--> statement-breakpoint
CREATE INDEX `intelligence_sources_enabled_idx` ON `intelligence_sources` (`enabled`);--> statement-breakpoint
CREATE INDEX `intelligence_sources_independence_idx` ON `intelligence_sources` (`independence_group`);--> statement-breakpoint
CREATE TABLE `review_queue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`report_id` text,
	`queue_type` text NOT NULL,
	`priority` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assigned_to` text,
	`created_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `intelligence_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`report_id`) REFERENCES `source_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_queue_priority_check" CHECK("review_queue_items"."priority" between 1 and 5)
);
--> statement-breakpoint
CREATE INDEX `review_queue_open_priority_idx` ON `review_queue_items` (`status`,`priority`,`created_at`);--> statement-breakpoint
CREATE TABLE `source_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text,
	`url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`body_text` text,
	`author` text,
	`language` text DEFAULT 'en' NOT NULL,
	`published_at` text NOT NULL,
	`collected_at` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`country_code` text,
	`content_hash` text NOT NULL,
	`processing_status` text NOT NULL,
	`raw_payload` text NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `intelligence_sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_reports_source_external_unique` ON `source_reports` (`source_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `source_reports_hash_idx` ON `source_reports` (`content_hash`);--> statement-breakpoint
CREATE INDEX `source_reports_normalized_url_idx` ON `source_reports` (`normalized_url`);--> statement-breakpoint
CREATE INDEX `source_reports_status_collected_idx` ON `source_reports` (`processing_status`,`collected_at`);--> statement-breakpoint
CREATE INDEX `source_reports_published_idx` ON `source_reports` (`published_at`);--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`match_rules` text NOT NULL,
	`priority` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`notification_settings` text NOT NULL,
	`last_match_at` text,
	`match_count` integer DEFAULT 0 NOT NULL,
	`matched_event_ids` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL
);
