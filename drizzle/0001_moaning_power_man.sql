CREATE TABLE `alert_history` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`priority` text NOT NULL,
	`state` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`voice_message` text NOT NULL,
	`event_id` text,
	`relationship_id` text,
	`created_at` text NOT NULL,
	`acknowledged_at` text,
	`dismissed_at` text,
	`deduplication_key` text NOT NULL,
	`cooldown_seconds` integer NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `intelligence_events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`relationship_id`) REFERENCES `intelligence_relationships`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `alert_history_state_idx` ON `alert_history` (`state`,`priority`,`created_at`);--> statement-breakpoint
CREATE INDEX `alert_history_dedup_idx` ON `alert_history` (`deduplication_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `conflict_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`countries` text NOT NULL,
	`regions` text NOT NULL,
	`start_date` text NOT NULL,
	`current_phase` text NOT NULL,
	`profile` text NOT NULL,
	`updated_at` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conflict_profiles_slug_unique` ON `conflict_profiles` (`slug`);--> statement-breakpoint
CREATE INDEX `conflict_profiles_updated_idx` ON `conflict_profiles` (`updated_at`);--> statement-breakpoint
CREATE TABLE `impact_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`trigger_categories` text NOT NULL,
	`required_entity_types` text,
	`required_keywords` text,
	`target_node_types` text NOT NULL,
	`target_node_ids` text,
	`relationship_type` text NOT NULL,
	`time_window_hours` integer NOT NULL,
	`maximum_distance_km` real,
	`base_relationship_confidence` integer NOT NULL,
	`base_exposure_confidence` integer,
	`base_causal_confidence` integer,
	`conditions` text NOT NULL,
	`explanation_template` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "impact_rules_time_window_check" CHECK("impact_rules"."time_window_hours" between 1 and 8760),
	CONSTRAINT "impact_rules_relationship_confidence_check" CHECK("impact_rules"."base_relationship_confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX `impact_rules_enabled_idx` ON `impact_rules` (`enabled`);--> statement-breakpoint
CREATE TABLE `intelligence_graph_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`subtitle` text,
	`description` text NOT NULL,
	`event_id` text,
	`country_code` text,
	`region` text,
	`latitude` real,
	`longitude` real,
	`tags` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `intelligence_events`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "graph_nodes_latitude_check" CHECK("intelligence_graph_nodes"."latitude" is null or "intelligence_graph_nodes"."latitude" between -90 and 90),
	CONSTRAINT "graph_nodes_longitude_check" CHECK("intelligence_graph_nodes"."longitude" is null or "intelligence_graph_nodes"."longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE INDEX `graph_nodes_type_idx` ON `intelligence_graph_nodes` (`type`);--> statement-breakpoint
CREATE INDEX `graph_nodes_event_idx` ON `intelligence_graph_nodes` (`event_id`);--> statement-breakpoint
CREATE INDEX `graph_nodes_region_idx` ON `intelligence_graph_nodes` (`region`);--> statement-breakpoint
CREATE TABLE `intelligence_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`source_node_id` text NOT NULL,
	`source_node_type` text NOT NULL,
	`target_node_id` text NOT NULL,
	`target_node_type` text NOT NULL,
	`relationship_type` text NOT NULL,
	`relationship_confidence` integer NOT NULL,
	`exposure_confidence` integer,
	`causal_confidence` integer,
	`market_anomaly_score` integer,
	`supporting_report_ids` text NOT NULL,
	`contradicting_report_ids` text NOT NULL,
	`explanation` text NOT NULL,
	`detection_method` text NOT NULL,
	`created_at` text NOT NULL,
	`last_recalculated_at` text NOT NULL,
	`analyst_state` text NOT NULL,
	`analyst_notes` text,
	`model_version` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	FOREIGN KEY (`source_node_id`) REFERENCES `intelligence_graph_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `intelligence_graph_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "relationships_distinct_nodes_check" CHECK("intelligence_relationships"."source_node_id" <> "intelligence_relationships"."target_node_id"),
	CONSTRAINT "relationships_confidence_check" CHECK("intelligence_relationships"."relationship_confidence" between 0 and 100),
	CONSTRAINT "relationships_exposure_check" CHECK("intelligence_relationships"."exposure_confidence" is null or "intelligence_relationships"."exposure_confidence" between 0 and 100),
	CONSTRAINT "relationships_causal_check" CHECK("intelligence_relationships"."causal_confidence" is null or "intelligence_relationships"."causal_confidence" between 0 and 100),
	CONSTRAINT "relationships_anomaly_check" CHECK("intelligence_relationships"."market_anomaly_score" is null or "intelligence_relationships"."market_anomaly_score" between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX `relationships_source_idx` ON `intelligence_relationships` (`source_node_id`,`relationship_type`);--> statement-breakpoint
CREATE INDEX `relationships_target_idx` ON `intelligence_relationships` (`target_node_id`,`relationship_type`);--> statement-breakpoint
CREATE INDEX `relationships_review_idx` ON `intelligence_relationships` (`analyst_state`,`relationship_confidence`);--> statement-breakpoint
CREATE TABLE `intelligence_state_history` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` text NOT NULL,
	`type` text NOT NULL,
	`event_id` text,
	`relationship_id` text,
	`market_assessment_id` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`before` text,
	`after` text,
	`report_ids` text NOT NULL,
	`actor` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `intelligence_events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`relationship_id`) REFERENCES `intelligence_relationships`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`market_assessment_id`) REFERENCES `market_impact_assessments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `state_history_time_idx` ON `intelligence_state_history` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `state_history_event_idx` ON `intelligence_state_history` (`event_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `market_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`exchange` text,
	`currency` text NOT NULL,
	`country_code` text,
	`sector` text,
	`industry` text,
	`exposure_tags` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_assets_symbol_unique` ON `market_assets` (`symbol`);--> statement-breakpoint
CREATE INDEX `market_assets_type_idx` ON `market_assets` (`type`);--> statement-breakpoint
CREATE TABLE `market_impact_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`exposure_confidence` integer NOT NULL,
	`relationship_confidence` integer NOT NULL,
	`market_anomaly_score` integer NOT NULL,
	`causal_confidence` integer NOT NULL,
	`measurements` text NOT NULL,
	`supporting_report_ids` text NOT NULL,
	`contradicting_report_ids` text NOT NULL,
	`explanation` text NOT NULL,
	`analyst_state` text NOT NULL,
	`calculated_at` text NOT NULL,
	`model_version` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `intelligence_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `market_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "market_impacts_scores_check" CHECK("market_impact_assessments"."exposure_confidence" between 0 and 100 and "market_impact_assessments"."relationship_confidence" between 0 and 100 and "market_impact_assessments"."market_anomaly_score" between 0 and 100 and "market_impact_assessments"."causal_confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_impacts_event_asset_unique` ON `market_impact_assessments` (`event_id`,`asset_id`);--> statement-breakpoint
CREATE INDEX `market_impacts_review_idx` ON `market_impact_assessments` (`analyst_state`,`market_anomaly_score`);--> statement-breakpoint
CREATE TABLE `monitoring_layouts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`widgets` text NOT NULL,
	`updated_at` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monitoring_layouts_owner_name_unique` ON `monitoring_layouts` (`owner_id`,`name`);--> statement-breakpoint
CREATE TABLE `public_camera_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`operator` text NOT NULL,
	`source_url` text NOT NULL,
	`embed_url` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`location` text NOT NULL,
	`country` text NOT NULL,
	`category` text NOT NULL,
	`usage_information` text NOT NULL,
	`attribution_requirements` text NOT NULL,
	`embed_permission` text NOT NULL,
	`last_successful_check` text,
	`availability` text NOT NULL,
	`relationships` text NOT NULL,
	`refresh_interval_seconds` integer NOT NULL,
	`access_restrictions` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	`demo_data_label` text NOT NULL,
	CONSTRAINT "camera_sources_coordinates_check" CHECK("public_camera_sources"."latitude" between -90 and 90 and "public_camera_sources"."longitude" between -180 and 180),
	CONSTRAINT "camera_sources_refresh_check" CHECK("public_camera_sources"."refresh_interval_seconds" between 30 and 86400)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `camera_sources_url_unique` ON `public_camera_sources` (`source_url`);--> statement-breakpoint
CREATE INDEX `camera_sources_availability_idx` ON `public_camera_sources` (`availability`,`category`);--> statement-breakpoint
CREATE TABLE `relationship_history` (
	`id` text PRIMARY KEY NOT NULL,
	`relationship_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`relationship_confidence` integer NOT NULL,
	`exposure_confidence` integer,
	`causal_confidence` integer,
	`market_anomaly_score` integer,
	`analyst_state` text NOT NULL,
	`explanation` text NOT NULL,
	`supporting_report_ids` text NOT NULL,
	`contradicting_report_ids` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`actor` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	FOREIGN KEY (`relationship_id`) REFERENCES `intelligence_relationships`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "relationship_history_confidence_check" CHECK("relationship_history"."relationship_confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX `relationship_history_lookup_idx` ON `relationship_history` (`relationship_id`,`occurred_at`);