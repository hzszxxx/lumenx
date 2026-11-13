ALTER TABLE platform_submissions ADD COLUMN product TEXT;
ALTER TABLE platform_submissions ADD COLUMN resolved_media_ref TEXT;
ALTER TABLE platform_submissions ADD COLUMN source_kind TEXT;
ALTER TABLE platform_submissions ADD COLUMN contract_version TEXT;
ALTER TABLE platform_submissions ADD COLUMN resolved_at TEXT;

ALTER TABLE task_deliveries ADD COLUMN product TEXT;
ALTER TABLE task_deliveries ADD COLUMN resolved_media_ref TEXT;
ALTER TABLE task_deliveries ADD COLUMN source_kind TEXT;
ALTER TABLE task_deliveries ADD COLUMN contract_version TEXT;
ALTER TABLE task_deliveries ADD COLUMN resolved_at TEXT;
