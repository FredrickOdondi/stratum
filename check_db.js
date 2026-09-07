import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data: connectors, error: err1 } = await supabase.from('connector_credentials').select('*');
  if (err1) console.error('Error fetching connectors:', err1);
  console.log('Connectors in DB:', connectors);

  const { data: files, error: err2 } = await supabase.storage.from('csv_uploads').list('', { limit: 100 });
  if (err2) console.error('Error listing root folders:', err2);
  console.log('Root folders in bucket:', files);
}

check();
