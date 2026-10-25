-- ===================================================
-- FinBot PostgreSQL Initial Schema (Tonyy Production)
-- Automatically executed upon container first run
-- ===================================================

CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('EXPENSE', 'INCOME')),
    amount NUMERIC(15, 2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    class VARCHAR(10) NOT NULL CHECK (class IN ('Needs', 'Wants')),
    description TEXT,
    is_micro_leak BOOLEAN DEFAULT FALSE,
    raw_message TEXT,
    user_name VARCHAR(50) DEFAULT 'Tonyy',
    sender_phone VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);

CREATE TABLE IF NOT EXISTS user_rules (
    id SERIAL PRIMARY KEY,
    rule_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial rules if empty
INSERT INTO user_rules (rule_text) 
SELECT 'Pengeluaran bensin, servis motor, dan parkir dikelompokkan ke kategori Transportasi'
WHERE NOT EXISTS (SELECT 1 FROM user_rules WHERE rule_text LIKE '%Transportasi%');

INSERT INTO user_rules (rule_text) 
SELECT 'Kopi kekinian / cafe selalu dikelompokkan ke kategori Hiburan & Wants'
WHERE NOT EXISTS (SELECT 1 FROM user_rules WHERE rule_text LIKE '%Hiburan & Wants%');

INSERT INTO user_rules (rule_text) 
SELECT 'Pengeluaran langganan domain, VPS, cloud, alat lab masuk ke "Infrastruktur & Tech"'
WHERE NOT EXISTS (SELECT 1 FROM user_rules WHERE rule_text LIKE '%Infrastruktur & Tech%');

INSERT INTO user_rules (rule_text) 
SELECT 'Pengeluaran impulsif atau jajan receh non-esensial <= Rp30.000 tandai is_micro_leak = true'
WHERE NOT EXISTS (SELECT 1 FROM user_rules WHERE rule_text LIKE '%is_micro_leak%');
