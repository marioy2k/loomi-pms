CREATE TABLE `ledger_meta` (
	`id` integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`created` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`booking` text NOT NULL,
	`guest` text NOT NULL,
	`description` text NOT NULL,
	`actor` text NOT NULL
);
