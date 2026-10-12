CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`property_id` integer DEFAULT 0 NOT NULL,
	`event` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	`reference` text NOT NULL,
	`details` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_property_created` ON `activity_log` (`property_id`,`created`);--> statement-breakpoint
CREATE TABLE `operations` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` integer NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_operations_property_kind` ON `operations` (`property_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_operations_policy` ON `operations` (`property_id`) WHERE "operations"."kind"='policy';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_operations_open_shift` ON `operations` (`property_id`) WHERE "operations"."kind"='shift' AND json_extract("operations"."data",'$.status')='Open';
--> statement-breakpoint
CREATE TRIGGER maintenance_insert_guard BEFORE INSERT ON operations WHEN NEW.kind='maintenance' AND json_extract(NEW.data,'$.block')=1 AND json_extract(NEW.data,'$.status')<>'Resolved' BEGIN
 SELECT RAISE(ABORT,'Maintenance dates overlap a reservation') WHERE EXISTS(SELECT 1 FROM property p,json_each(p.data,'$.bookings') b WHERE p.id=NEW.property_id AND json_extract(b.value,'$.status') NOT IN ('Cancelled','Checked out') AND json_extract(b.value,'$.room')=json_extract(NEW.data,'$.room') AND json_extract(b.value,'$.arrival')<json_extract(NEW.data,'$.to') AND json_extract(b.value,'$.departure')>json_extract(NEW.data,'$.from'));
END;
--> statement-breakpoint
CREATE TRIGGER maintenance_update_guard BEFORE UPDATE ON operations WHEN NEW.kind='maintenance' AND json_extract(NEW.data,'$.block')=1 AND json_extract(NEW.data,'$.status')<>'Resolved' BEGIN
 SELECT RAISE(ABORT,'Maintenance dates overlap a reservation') WHERE EXISTS(SELECT 1 FROM property p,json_each(p.data,'$.bookings') b WHERE p.id=NEW.property_id AND json_extract(b.value,'$.status') NOT IN ('Cancelled','Checked out') AND json_extract(b.value,'$.room')=json_extract(NEW.data,'$.room') AND json_extract(b.value,'$.arrival')<json_extract(NEW.data,'$.to') AND json_extract(b.value,'$.departure')>json_extract(NEW.data,'$.from'));
END;
--> statement-breakpoint
CREATE TRIGGER booking_maintenance_guard BEFORE UPDATE ON property BEGIN
 SELECT RAISE(ABORT,'Accommodation is blocked for maintenance') WHERE EXISTS(SELECT 1 FROM json_each(NEW.data,'$.bookings') b JOIN operations m ON m.property_id=NEW.id AND m.kind='maintenance' WHERE json_extract(b.value,'$.status') NOT IN ('Cancelled','Checked out') AND json_extract(m.data,'$.status')<>'Resolved' AND json_extract(m.data,'$.block')=1 AND json_extract(b.value,'$.room')=json_extract(m.data,'$.room') AND json_extract(b.value,'$.arrival')<json_extract(m.data,'$.to') AND json_extract(b.value,'$.departure')>json_extract(m.data,'$.from'));
END;

--> statement-breakpoint
CREATE TRIGGER audit_operations_insert AFTER INSERT ON operations BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'operations.insert',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_operations_update AFTER UPDATE ON operations BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'operations.update',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_inventory_movements_insert AFTER INSERT ON inventory_movements BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'inventory_movements.insert',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_inventory_movements_update AFTER UPDATE ON inventory_movements BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'inventory_movements.update',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_inventory_requests_insert AFTER INSERT ON inventory_requests BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'inventory_requests.insert',NEW.requester,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_inventory_requests_update AFTER UPDATE ON inventory_requests BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'inventory_requests.update',NEW.requester,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_pos_orders_insert AFTER INSERT ON pos_orders BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'pos_orders.insert',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_pos_orders_update AFTER UPDATE ON pos_orders BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'pos_orders.update',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_transactions_insert AFTER INSERT ON transactions BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'transactions.insert',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_transactions_update AFTER UPDATE ON transactions BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'transactions.update',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_accounting_records_insert AFTER INSERT ON accounting_records BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'accounting_records.insert',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_accounting_records_update AFTER UPDATE ON accounting_records BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'accounting_records.update',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_swimming_vouchers_insert AFTER INSERT ON swimming_vouchers BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'swimming_vouchers.insert',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_swimming_vouchers_update AFTER UPDATE ON swimming_vouchers BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'swimming_vouchers.update',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;



--> statement-breakpoint
CREATE TRIGGER audit_module_audit_insert AFTER INSERT ON module_audit BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (0,'module_audit.insert',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_module_audit_update AFTER UPDATE ON module_audit BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (0,'module_audit.update',NEW.actor,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_inventory_items_insert AFTER INSERT ON inventory_items BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'inventory_items.insert','System',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_inventory_items_update AFTER UPDATE ON inventory_items BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'inventory_items.update','System',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_inventory_items_delete AFTER DELETE ON inventory_items BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (OLD.property_id,'inventory_items.delete','System',strftime('%Y-%m-%dT%H:%M:%fZ','now'),OLD.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_pos_products_insert AFTER INSERT ON pos_products BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'pos_products.insert','System',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_pos_products_update AFTER UPDATE ON pos_products BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.property_id,'pos_products.update','System',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_pos_products_delete AFTER DELETE ON pos_products BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (OLD.property_id,'pos_products.delete','System',strftime('%Y-%m-%dT%H:%M:%fZ','now'),OLD.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_property_insert AFTER INSERT ON property BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.id,'property.insert','System',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_property_update AFTER UPDATE ON property BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (NEW.id,'property.update','System',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.id,''); END;

--> statement-breakpoint
CREATE TRIGGER audit_property_delete AFTER DELETE ON property BEGIN INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES (OLD.id,'property.delete','System',strftime('%Y-%m-%dT%H:%M:%fZ','now'),OLD.id,''); END;
