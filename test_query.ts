import { supabase } from './src/lib/supabase';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const { data, error } = await supabase.from('engagements').select('id, intake_answers(field, value), documents(id, name, mime_type)').limit(1);
  console.log(JSON.stringify({ data, error }, null, 2));
}
test();
