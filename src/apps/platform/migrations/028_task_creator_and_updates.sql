-- 028_task_creator_and_updates.sql
ALTER TABLE commercial_tasks ADD COLUMN created_by TEXT REFERENCES platform_users(id);
