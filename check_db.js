const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dmxosdgvmzvkeivknczv.supabase.co',
  'sb_publishable_DvB7pWkS_bmR55F19yWgMg_tPhD_p6S'
);

async function check() {
  const { data, error } = await supabase.from('articles').select('id, category');
  if (error) {
    console.error(error);
  } else if (data) {
    const cats = {};
    for (let d of data) {
      cats[d.category] = (cats[d.category] || 0) + 1;
    }
    console.log('Kategórie v databáze a pocty:', cats);
  }
}

check();
