CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`minimum` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_items_property` ON `inventory_items` (`property_id`);--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`item_id` text NOT NULL,
	`item_name` text NOT NULL,
	`unit` text NOT NULL,
	`kind` text NOT NULL,
	`quantity` integer NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	`actor_name` text NOT NULL,
	`recipient` text DEFAULT '' NOT NULL,
	`recipient_name` text DEFAULT '' NOT NULL,
	`request_id` text DEFAULT '' NOT NULL,
	`note` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_movements_property_created` ON `inventory_movements` (`property_id`,`created`);--> statement-breakpoint
CREATE TABLE `inventory_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`item_id` text NOT NULL,
	`item_name` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` integer NOT NULL,
	`returned` integer DEFAULT 0 NOT NULL,
	`purpose` text NOT NULL,
	`requester` text NOT NULL,
	`requester_name` text NOT NULL,
	`created` text NOT NULL,
	`status` text NOT NULL,
	`approver` text DEFAULT '' NOT NULL,
	`approver_name` text DEFAULT '' NOT NULL,
	`decided_at` text DEFAULT '' NOT NULL,
	`decision_note` text DEFAULT '' NOT NULL,
	`decision_id` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_requests_property_created` ON `inventory_requests` (`property_id`,`created`);