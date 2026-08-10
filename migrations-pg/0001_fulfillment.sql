CREATE TABLE IF NOT EXISTS fulfillments (
    checkout_session_id TEXT PRIMARY KEY,
    payment_intent_id TEXT NOT NULL,
    charge_id TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    product_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    artifact_version TEXT NOT NULL,
    artifact_sha256 TEXT NOT NULL,
    artifact_r2_key TEXT NOT NULL,
    archive_bytes INTEGER NOT NULL,
    terms_version TEXT NOT NULL,
    currency TEXT NOT NULL,
    amount_subtotal INTEGER NOT NULL,
    amount_total INTEGER NOT NULL,
    livemode BOOLEAN NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (delivery_status IN ('pending', 'sending', 'sent')),
    delivery_attempts INTEGER NOT NULL DEFAULT 0,
    delivery_lease_until BIGINT,
    delivery_message_id TEXT,
    delivery_sent_at TEXT,
    last_delivery_error TEXT,
    redeem_expires_at BIGINT NOT NULL,
    download_count INTEGER NOT NULL DEFAULT 0,
    first_download_at TEXT,
    last_download_at TEXT,
    stripe_created_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fulfillments_customer_email_idx
    ON fulfillments(customer_email, stripe_created_at DESC);

CREATE INDEX IF NOT EXISTS fulfillments_delivery_status_idx
    ON fulfillments(delivery_status, delivery_lease_until);
