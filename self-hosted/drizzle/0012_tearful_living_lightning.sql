CREATE TABLE `company_licence` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL,
	`actor` text NOT NULL
);
