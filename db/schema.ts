import { sqliteTable,text,integer,index } from 'drizzle-orm/sqlite-core';
export const property=sqliteTable('property',{id:integer('id').primaryKey(),data:text('data').notNull()});
export const staff=sqliteTable('staff',{propertyIds:text('property_ids').notNull().default('[]'),email:text('email').primaryKey(),name:text('name').notNull(),role:text('role').notNull(),permissions:text('permissions').notNull(),active:integer('active').notNull().default(1)});
export const transactions=sqliteTable('transactions',{recordId:text('record_id').notNull().default(''),category:text('category').notNull().default('Uncategorized'),id:text('id').primaryKey(),propertyId:integer('property_id').notNull().default(1),date:text('date').notNull(),created:text('created').notNull(),kind:text('kind').notNull(),method:text('method').notNull().default('Unspecified'),amount:integer('amount').notNull(),currency:text('currency').notNull(),booking:text('booking').notNull(),guest:text('guest').notNull(),description:text('description').notNull(),actor:text('actor').notNull()},table=>[index('idx_transactions_property_created').on(table.propertyId,table.created)]);
export const ledgerMeta=sqliteTable('ledger_meta',{id:integer('id').primaryKey()});

export const accountingRecords=sqliteTable('accounting_records',{
 id:text('id').primaryKey(),propertyId:integer('property_id').notNull(),date:text('date').notNull(),created:text('created').notNull(),
 kind:text('kind').notNull(),category:text('category').notNull(),amount:integer('amount').notNull(),currency:text('currency').notNull(),
 description:text('description').notNull(),party:text('party').notNull().default(''),booking:text('booking').notNull().default(''),actor:text('actor').notNull()
},table=>[index('idx_accounting_records_property_date').on(table.propertyId,table.date)]);
export const accountingAudit=sqliteTable('accounting_audit',{id:text('id').primaryKey(),propertyId:integer('property_id').notNull(),event:text('event').notNull(),actor:text('actor').notNull(),created:text('created').notNull(),reference:text('reference').notNull()});
