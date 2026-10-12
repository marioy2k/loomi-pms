CREATE TABLE `company_modules` (
	`id` integer PRIMARY KEY NOT NULL,
	`disabled` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `module_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	`enabled` text NOT NULL,
	`version` integer NOT NULL
);
