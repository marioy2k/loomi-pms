ALTER TABLE pos_products ADD COLUMN prices TEXT NOT NULL DEFAULT '{}';
UPDATE pos_products SET prices=json_object(COALESCE((SELECT json_extract(data,'$.currency') FROM property WHERE id=pos_products.property_id),'USD'),price);
ALTER TABLE swimming_settings ADD COLUMN prices TEXT NOT NULL DEFAULT '{}';
UPDATE swimming_settings SET prices=json_object(COALESCE((SELECT json_extract(data,'$.currency') FROM property WHERE id=swimming_settings.property_id),'USD'),json_object('adult',adult_price,'child',child_price));
UPDATE operations SET data=json_set(data,'$.currency',COALESCE((SELECT json_extract(data,'$.currency') FROM property WHERE id=operations.property_id),'USD')) WHERE kind IN ('maintenance','purchase','shift') AND json_extract(data,'$.currency') IS NULL;
DROP INDEX IF EXISTS idx_operations_open_shift;
CREATE UNIQUE INDEX idx_operations_open_shift ON operations(property_id,json_extract(data,'$.currency')) WHERE kind='shift' AND json_extract(data,'$.status')='Open';
