CREATE TABLE exchange_rates(id INTEGER PRIMARY KEY AUTOINCREMENT,created TEXT NOT NULL,effective_from TEXT NOT NULL,data TEXT NOT NULL,actor TEXT NOT NULL);
CREATE INDEX exchange_rates_effective ON exchange_rates(effective_from,id);
ALTER TABLE transactions ADD COLUMN fx_id INTEGER;
ALTER TABLE accounting_records ADD COLUMN fx_id INTEGER;
ALTER TABLE pos_orders ADD COLUMN fx_id INTEGER;
ALTER TABLE swimming_vouchers ADD COLUMN fx_id INTEGER;
CREATE TRIGGER transactions_fx AFTER INSERT ON transactions WHEN NEW.kind<>'Opening balance' BEGIN
 UPDATE transactions SET fx_id=CASE
 WHEN EXISTS(SELECT 1 FROM accounting_records WHERE id=NEW.record_id) THEN (SELECT fx_id FROM accounting_records WHERE id=NEW.record_id)
 WHEN EXISTS(SELECT 1 FROM property,json_each(property.data,'$.bookings') WHERE property.id=NEW.property_id AND json_extract(value,'$.id')=NEW.booking) THEN (SELECT json_extract(value,'$.exchangeRate.id') FROM property,json_each(property.data,'$.bookings') WHERE property.id=NEW.property_id AND json_extract(value,'$.id')=NEW.booking)
 ELSE (SELECT id FROM exchange_rates WHERE effective_from<=NEW.date AND created<=NEW.created ORDER BY effective_from DESC,id DESC LIMIT 1) END WHERE id=NEW.id AND fx_id IS NULL;
END;
CREATE TRIGGER accounting_records_fx AFTER INSERT ON accounting_records BEGIN
 UPDATE accounting_records SET fx_id=CASE
 WHEN EXISTS(SELECT 1 FROM pos_orders WHERE id=substr(NEW.id,11,36)) THEN (SELECT fx_id FROM pos_orders WHERE id=substr(NEW.id,11,36))
 WHEN EXISTS(SELECT 1 FROM swimming_vouchers WHERE id=substr(NEW.id,12,36)) THEN (SELECT fx_id FROM swimming_vouchers WHERE id=substr(NEW.id,12,36))
 WHEN EXISTS(SELECT 1 FROM accounting_records WHERE id=CASE WHEN NEW.id LIKE 'pos-refund-%' THEN substr(NEW.id,12) WHEN NEW.id LIKE 'pass-refund-%' THEN substr(NEW.id,13) ELSE '' END) THEN (SELECT fx_id FROM accounting_records WHERE id=CASE WHEN NEW.id LIKE 'pos-refund-%' THEN substr(NEW.id,12) WHEN NEW.id LIKE 'pass-refund-%' THEN substr(NEW.id,13) ELSE '' END)
 ELSE (SELECT id FROM exchange_rates WHERE effective_from<=NEW.date AND created<=NEW.created ORDER BY effective_from DESC,id DESC LIMIT 1) END WHERE id=NEW.id AND fx_id IS NULL;
END;
CREATE TRIGGER pos_orders_fx AFTER INSERT ON pos_orders BEGIN
 UPDATE pos_orders SET fx_id=(SELECT id FROM exchange_rates WHERE effective_from<=NEW.date AND created<=NEW.created ORDER BY effective_from DESC,id DESC LIMIT 1) WHERE id=NEW.id AND fx_id IS NULL;
END;
CREATE TRIGGER swimming_vouchers_fx AFTER INSERT ON swimming_vouchers BEGIN
 UPDATE swimming_vouchers SET fx_id=(SELECT id FROM exchange_rates WHERE effective_from<=date(NEW.created,'-3 hours') AND created<=NEW.created ORDER BY effective_from DESC,id DESC LIMIT 1) WHERE id=NEW.id AND fx_id IS NULL;
END;
