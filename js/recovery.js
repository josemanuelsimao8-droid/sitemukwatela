(() => {
  const form = document.getElementById('recovery-form');
  const button = form?.querySelector('button[type="submit"]');
  const box = document.getElementById('auth-message');

  const show = (text, type='info') => {
    if (!box) return;
    box.textContent = text;
    box.dataset.type = type;
    box.hidden = false;
  };

  const start = async () => {
    if (!window.supabaseClient) {
      show('Não foi possível carregar o serviço de autenticação. Atualize a página e tente novamente.', 'error');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    try {
      if (code) {
        show('A validar o link de recuperação…');
        const { error } = await window.supabaseClient.auth.exchangeCodeForSession(code);
        if (error) throw error;
        window.history.replaceState({}, document.title, 'recuperar-password.html');
      }

      let { data } = await window.supabaseClient.auth.getSession();

      if (!data?.session) {
        await new Promise(resolve => setTimeout(resolve, 700));
        ({ data } = await window.supabaseClient.auth.getSession());
      }

      if (!data?.session) {
        const hash = window.location.hash || '';
        const hasError = /error=|error_code=|error_description=/i.test(hash + window.location.search);
        show(
          hasError
            ? 'Este link de recuperação expirou ou já foi utilizado. Solicite um novo email.'
            : 'Abra o link de recuperação recebido no seu email para continuar.',
          'error'
        );
        if (button) button.disabled = true;
        return;
      }

      show('Link validado. Agora escolha a sua nova palavra-passe.', 'success');
      if (button) button.disabled = false;
    } catch (error) {
      console.error(error);
      show('Este link não pôde ser validado. Solicite um novo email de recuperação e abra apenas o email mais recente.', 'error');
      if (button) button.disabled = true;
    }
  };

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = form.elements.password.value;
    const confirm = form.elements.confirmPassword.value;

    if (password !== confirm) {
      show('As palavras-passe não coincidem.', 'error');
      return;
    }
    if (password.length < 8) {
      show('A palavra-passe deve ter pelo menos 8 caracteres.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'A atualizar…';

    const { error } = await window.supabaseClient.auth.updateUser({ password });

    if (error) {
      console.error(error);
      show('Não foi possível atualizar a palavra-passe. Solicite um novo email de recuperação.', 'error');
      button.disabled = false;
      button.textContent = 'Atualizar palavra-passe';
      return;
    }

    await window.supabaseClient.auth.signOut();
    show('Palavra-passe atualizada com sucesso. Pode entrar novamente.', 'success');
    form.reset();
    setTimeout(() => { window.location.href = 'auth.html'; }, 1200);
  });

  start();
})();
