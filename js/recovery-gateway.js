(() => {
  const message = (text, type = 'info') => {
    const el = document.getElementById('gateway-message');
    if (!el) return;
    el.textContent = text;
    el.dataset.type = type;
    el.hidden = false;
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const button = document.getElementById('continue-recovery');
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type') || 'recovery';

    if (!tokenHash || type !== 'recovery') {
      button.disabled = true;
      message('Este link de recuperação não é válido. Solicite um novo email de recuperação.', 'error');
      return;
    }

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'A validar...';

      const { data, error } = await window.supabaseClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery'
      });

      if (error || !data?.session) {
        console.error(error);
        message(
          'Não foi possível validar este link. Ele pode ter expirado ou já ter sido utilizado. Solicite um novo email de recuperação.',
          'error'
        );
        button.disabled = false;
        button.textContent = 'Tentar novamente';
        return;
      }

      window.history.replaceState({}, document.title, 'recuperar-password.html');
      window.location.replace('recuperar-password.html');
    });
  });
})();
