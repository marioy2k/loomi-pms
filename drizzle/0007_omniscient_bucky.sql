CREATE TABLE `pos_closings` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`date` text NOT NULL,
	`created` text NOT NULL,
	`currency` text NOT NULL,
	`opening` integer NOT NULL,
	`expected` integer NOT NULL,
	`counted` integer NOT NULL,
	`summary` text NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pos_closings_property_date` ON `pos_closings` (`property_id`,`date`);--> statement-breakpoint
CREATE TABLE `pos_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`date` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`status` text NOT NULL,
	`items` text NOT NULL,
	`total` integer NOT NULL,
	`currency` text NOT NULL,
	`customer` text DEFAULT '' NOT NULL,
	`table_label` text DEFAULT '' NOT NULL,
	`booking` text DEFAULT '' NOT NULL,
	`method` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`checkout_id` text DEFAULT '' NOT NULL,
	`payment_id` text DEFAULT '' NOT NULL,
	`refund_id` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pos_orders_property_date` ON `pos_orders` (`property_id`,`date`);--> statement-breakpoint
CREATE TABLE `pos_products` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL
);
