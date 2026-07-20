DROP INDEX `intelligence_read_models_collection_updated_idx`;--> statement-breakpoint
ALTER TABLE `intelligence_read_models` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `intelligence_read_models_collection_updated_idx` ON `intelligence_read_models` (`collection`,`sort_order`,`updated_at`);