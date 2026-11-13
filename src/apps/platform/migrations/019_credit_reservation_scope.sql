ALTER TABLE credit_reservations ADD COLUMN product TEXT;
ALTER TABLE credit_reservations ADD COLUMN project_id TEXT;

CREATE INDEX idx_credit_reservations_project_scope
    ON credit_reservations(user_id, product, project_id, status);
