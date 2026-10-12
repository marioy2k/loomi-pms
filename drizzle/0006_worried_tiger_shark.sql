CREATE TABLE `accounting_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`event` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	`reference` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `accounting_records` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`date` text NOT NULL,
	`created` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`description` text NOT NULL,
	`party` text DEFAULT '' NOT NULL,
	`booking` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accounting_records_property_date` ON `accounting_records` (`property_id`,`date`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `record_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `category` text DEFAULT 'Uncategorized' NOT NULL;