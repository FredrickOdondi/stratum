const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('claims').select('*').limit(5);
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
