CREATE TABLE `swimming_settings` (
	`property_id` integer PRIMARY KEY NOT NULL,
	`adult_price` integer NOT NULL,
	`child_price` integer NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `swimming_vouchers` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`code` text NOT NULL,
	`created` text NOT NULL,
	`valid_date` text NOT NULL,
	`guest` text NOT NULL,
	`adults` integer NOT NULL,
	`children` integer NOT NULL,
	`adult_price` integer NOT NULL,
	`child_price` integer NOT NULL,
	`total` integer NOT NULL,
	`currency` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`payment_id` text DEFAULT '' NOT NULL,
	`method` text DEFAULT '' NOT NULL,
	`redeemed_at` text DEFAULT '' NOT NULL,
	`redeemed_by` text DEFAULT '' NOT NULL,
	`refund_id` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_swimming_vouchers_property_date` ON `swimming_vouchers` (`property_id`,`valid_date`);