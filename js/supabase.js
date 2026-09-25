(() => {
  const SUPABASE_URL = 'https://xgiuiirqyujgocskfhnw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LJe3DxmjDIrExIIp3Q6G6A_H6aY2ZBO';
  if (!window.supabase?.createClient) { console.error('Supabase JS não foi carregado.'); return; }
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken:true, persistSession:true, detectSessionInUrl:true, flowType:'implicit' } });
  window.mukwatelaAuthState = { lastEvent:null, recoverySession:null };
  window.supabaseClient.auth.onAuthStateChange((event, session) => {
    window.mukwatelaAuthState.lastEvent = event;
    if (event === 'PASSWORD_RECOVERY' && session) window.mukwatelaAuthState.recoverySession = session;
  });
})();