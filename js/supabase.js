(() => {
  const SUPABASE_URL = 'https://jbnwatatstxudepllacg.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_FUqwiOH1VWVbTdStKGEiCA_36_72lX8';

  if (!window.supabase?.createClient) {
    console.error('Supabase JS não foi carregado.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'implicit'
      }
    }
  );

  // Captura eventos de recuperação imediatamente, antes de auth.js
  // ser executado. Isto evita perder o evento PASSWORD_RECOVERY
  // durante a inicialização automática do Supabase Auth.
  window.mukwatelaAuthState = {
    lastEvent: null,
    recoverySession: null
  };

  window.supabaseClient.auth.onAuthStateChange((event, session) => {
    window.mukwatelaAuthState.lastEvent = event;
    if (event === 'PASSWORD_RECOVERY' && session) {
      window.mukwatelaAuthState.recoverySession = session;
    }
  });
})();
