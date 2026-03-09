-- Add source and status columns to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS source text DEFAULT 'pos';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS status text DEFAULT 'fulfilled';

-- Enable RLS on all tables
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_days ENABLE ROW LEVEL SECURITY;

-- sales: anon can read and insert, but not update or delete
CREATE POLICY "anon can read sales" ON sales FOR SELECT TO anon USING (true);
CREATE POLICY "anon can insert sales" ON sales FOR INSERT TO anon WITH CHECK (true);

-- menu_items: anon can read only
CREATE POLICY "anon can read menu_items" ON menu_items FOR SELECT TO anon USING (true);

-- closed_days: anon can read only
CREATE POLICY "anon can read closed_days" ON closed_days FOR SELECT TO anon USING (true);
