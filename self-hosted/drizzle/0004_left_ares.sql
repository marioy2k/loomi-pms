ALTER TABLE `transactions` ADD `property_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_transactions_property_created` ON `transactions` (`property_id`,`created`);