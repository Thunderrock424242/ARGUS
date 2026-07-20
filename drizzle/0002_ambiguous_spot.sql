CREATE TABLE `intelligence_read_models` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text NOT NULL,
	`record_id` text NOT NULL,
	`slug` text,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`data_classification` text DEFAULT 'demonstration' NOT NULL,
	CONSTRAINT "intelligence_read_models_version_check" CHECK("intelligence_read_models"."version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intelligence_read_models_collection_record_unique` ON `intelligence_read_models` (`collection`,`record_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `intelligence_read_models_collection_slug_unique` ON `intelligence_read_models` (`collection`,`slug`);--> statement-breakpoint
CREATE INDEX `intelligence_read_models_collection_updated_idx` ON `intelligence_read_models` (`collection`,`updated_at`);