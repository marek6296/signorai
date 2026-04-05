const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dmxosdgvmzvkeivknczv.supabase.co',
  'sb_publishable_DvB7pWkS_bmR55F19yWgMg_tPhD_p6S' // using the standard key since service key is not available
);

async function clean() {
  console.log("Začínam čistenie databázy...");

  const categoriesToKeep = ['AI', 'Tech', 'Biznis', 'Veda', 'Návody & Tipy', 'Návody & tipy'];

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, category');

  if (error) {
    console.error("Chyba pri načítaní článkov:", error);
    return;
  }

  const toDelete = articles.filter(a => !categoriesToKeep.includes(a.category));
  console.log(`Našlo sa ${toDelete.length} článkov na vymazanie (kategórie mimo AI/Tech).`);

  if (toDelete.length > 0) {
    const ids = toDelete.map(a => a.id);
    const { error: delError } = await supabase
      .from('articles')
      .delete()
      .in('id', ids);

    if (delError) {
      console.error("Chyba pri mazaní článkov:", delError);
    } else {
      console.log(`Úspešne vymazaných ${toDelete.length} článkov.`);
    }
  }

  // Same for suggestions if the table exists
  const { data: suggestions, error: sugErr } = await supabase
    .from('suggestions')
    .select('id, category');

  if (!sugErr && suggestions) {
    const sugToDelete = suggestions.filter(a => !categoriesToKeep.includes(a.category));
    console.log(`Našlo sa ${sugToDelete.length} návrhov na vymazanie.`);
    if (sugToDelete.length > 0) {
      const sugIds = sugToDelete.map(a => a.id);
      await supabase.from('suggestions').delete().in('id', sugIds);
      console.log(`Úspešne vymazaných ${sugToDelete.length} návrhov.`);
    }
  }
}

clean();
