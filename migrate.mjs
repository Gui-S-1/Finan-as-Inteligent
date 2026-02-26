/*  migrate.mjs — Run once to create Supabase tables
    Usage:  node migrate.mjs
*/
const SUPABASE_URL = 'https://dmandiuweyzpitlmkbxd.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY; // optional: pass as env

const SQL = `
-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bills
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receive', 'pay')),
  category TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments (partial payments on a bill)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Settings (budget etc.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Enable RLS but allow all for anonymous personal use
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='anon_all_transactions') THEN
    CREATE POLICY anon_all_transactions ON transactions FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bills' AND policyname='anon_all_bills') THEN
    CREATE POLICY anon_all_bills ON bills FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='anon_all_payments') THEN
    CREATE POLICY anon_all_payments ON payments FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='settings' AND policyname='anon_all_settings') THEN
    CREATE POLICY anon_all_settings ON settings FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

async function run() {
  // Try direct postgres connection via pg package
  try {
    const { default: pg } = await import('pg');
    const connStr = 'postgresql://postgres:%40Guilherme20155@db.dmandiuweyzpitlmkbxd.supabase.co:5432/postgres';
    const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('Connected to Supabase Postgres directly.');
    await client.query(SQL);
    console.log('Migration completed successfully!');
    await client.end();
  } catch (err) {
    console.error('Direct connection failed:', err.message);
    console.log('\\n--- COPY THE SQL BELOW INTO SUPABASE SQL EDITOR ---\\n');
    console.log(SQL);
    console.log('\\n--- END SQL ---');
    process.exit(1);
  }
}

run();
