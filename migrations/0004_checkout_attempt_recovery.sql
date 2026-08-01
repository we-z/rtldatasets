ALTER TABLE fulfillments ADD COLUMN checkout_attempt_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS fulfillments_checkout_attempt_idx
    ON fulfillments(checkout_attempt_id)
    WHERE checkout_attempt_id IS NOT NULL;
