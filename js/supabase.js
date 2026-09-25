(() => {
  const SUPABASE_URL = 'https://jbnwatatstxudepllacg.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_FUqwiOH1VWVbTdStKGEiCA_36_72lX8';

  if (!window.supabase?.createClient) {
    console.error('Supabase JS não foi carregado.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
})();
