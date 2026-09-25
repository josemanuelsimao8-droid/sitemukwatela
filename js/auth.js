(() => {
  const client = () => window.supabaseClient;

  function message(text, type = 'info') {
    const node = document.getElementById('auth-message');
    if (!node) return;
    node.textContent = text;
    node.dataset.type = type;
    node.hidden = false;
  }

  function setLoading(form, loading) {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = loading;
    button.dataset.originalText ||= button.textContent;
    button.textContent = loading ? 'Aguarde...' : button.dataset.originalText;
  }

  async function getSession() {
    const { data, error } = await client().auth.getSession();
    if (error) {
      console.error(error);
      return null;
    }
    return data.session;
  }

  async function getProfile(userId) {
    const { data, error } = await client()
      .from('profiles')
      .select('id, full_name, phone, company, address, avatar_url, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function requireSession() {
    const session = await getSession();
    if (!session) {
      window.location.href = 'auth.html';
      return null;
    }
    return session;
  }

  async function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const session = await getSession();
    if (session) {
      window.location.href = 'dashboard.html';
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setLoading(form, true);

      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;

      const { data, error } = await client().auth.signInWithPassword({ email, password });

      if (error) {
        message(error.message === 'Email not confirmed'
          ? 'Confirme o seu email antes de entrar.'
          : 'Email ou palavra-passe incorretos.', 'error');
        setLoading(form, false);
        return;
      }

      if (data.session) {
        window.location.href = 'dashboard.html';
      }
    });

    document.getElementById('forgot-password-btn')?.addEventListener('click', async () => {
      const email = form.elements.email.value.trim();
      if (!email) {
        message('Digite o seu email primeiro para receber o link de recuperação.', 'error');
        return;
      }

      const { error } = await client().auth.resetPasswordForEmail(email, {
        redirectTo: new URL('recuperar-password.html', window.location.href).href
      });

      message(error
        ? 'Não foi possível enviar o email de recuperação.'
        : 'Enviámos um link de recuperação para o seu email.', error ? 'error' : 'success');
    });
  }

  async function initRegister() {
    const form = document.getElementById('register-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setLoading(form, true);

      const name = form.elements.name.value.trim();
      const company = form.elements.company.value.trim();
      const email = form.elements.email.value.trim();
      const phone = form.elements.phone.value.trim();
      const password = form.elements.password.value;
      const confirmPassword = form.elements.confirmPassword.value;

      if (password !== confirmPassword) {
        message('As palavras-passe não coincidem.', 'error');
        setLoading(form, false);
        return;
      }

      if (password.length < 6) {
        message('A palavra-passe deve ter pelo menos 6 caracteres.', 'error');
        setLoading(form, false);
        return;
      }

      const { data, error } = await client().auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone,
            company,
            address: ''
          },
          emailRedirectTo: new URL('auth.html', window.location.href).href
        }
      });

      if (error) {
        message(error.message || 'Não foi possível criar a conta.', 'error');
        setLoading(form, false);
        return;
      }

      if (data.session) {
        window.location.href = 'dashboard.html';
        return;
      }

      message('Conta criada. Verifique o seu email para confirmar o acesso.', 'success');
      form.reset();
      setLoading(form, false);
    });
  }

  async function initDashboard() {
    const session = await requireSession();
    if (!session) return;

    try {
      const profile = await getProfile(session.user.id);
      if (!profile) {
        message('O seu perfil ainda está a ser criado. Atualize a página em alguns segundos.', 'error');
        return;
      }

      const name = profile.full_name || session.user.email?.split('@')[0] || 'Cliente';
      const firstLetter = name.trim().charAt(0).toUpperCase() || 'C';

      document.getElementById('user-name')?.replaceChildren(document.createTextNode(name));
      document.getElementById('user-avatar')?.replaceChildren(document.createTextNode(firstLetter));
      document.getElementById('user-email')?.replaceChildren(document.createTextNode(session.user.email || ''));
      document.getElementById('user-role')?.replaceChildren(document.createTextNode(profile.role === 'admin' ? 'Administrador' : 'Cliente'));
    } catch (error) {
      console.error(error);
      const node = document.getElementById('user-name');
      if (node) node.textContent = session.user.email || 'Cliente';
    }
  }

  async function initProfile() {
    const session = await requireSession();
    if (!session) return;

    const form = document.getElementById('profile-form');
    if (!form) return;

    try {
      const profile = await getProfile(session.user.id);

      if (!profile) {
        message('Perfil não encontrado.', 'error');
        return;
      }

      form.elements.name.value = profile.full_name || '';
      form.elements.company.value = profile.company || '';
      form.elements.email.value = session.user.email || '';
      form.elements.email.readOnly = true;
      form.elements.phone.value = profile.phone || '';
      form.elements.address.value = profile.address || '';

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setLoading(form, true);

        const { error } = await client()
          .from('profiles')
          .update({
            full_name: form.elements.name.value.trim(),
            company: form.elements.company.value.trim(),
            phone: form.elements.phone.value.trim(),
            address: form.elements.address.value.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', session.user.id);

        message(
          error ? 'Não foi possível guardar as alterações.' : 'Perfil atualizado com sucesso.',
          error ? 'error' : 'success'
        );

        setLoading(form, false);
      });
    } catch (error) {
      console.error(error);
      message('Não foi possível carregar o seu perfil.', 'error');
    }
  }

  async function initRecovery() {
    const form = document.getElementById('recovery-form');
    if (!form) return;

    const { data: sessionData } = await client().auth.getSession();
    if (!sessionData?.session) {
      message('Abra o link de recuperação enviado para o seu email para continuar.', 'error');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setLoading(form, true);

      const password = form.elements.password.value;
      const confirmPassword = form.elements.confirmPassword.value;

      if (password !== confirmPassword) {
        message('As palavras-passe não coincidem.', 'error');
        setLoading(form, false);
        return;
      }

      if (password.length < 6) {
        message('A palavra-passe deve ter pelo menos 6 caracteres.', 'error');
        setLoading(form, false);
        return;
      }

      const { error } = await client().auth.updateUser({ password });

      message(
        error ? 'Não foi possível atualizar a palavra-passe.' : 'Palavra-passe atualizada com sucesso. Já pode entrar.',
        error ? 'error' : 'success'
      );

      if (!error) {
        form.reset();
        setTimeout(() => {
          window.location.href = 'auth.html';
        }, 1200);
      } else {
        setLoading(form, false);
      }
    });
  }

  async function initLogout() {
    document.querySelectorAll('[data-logout]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        await client().auth.signOut();
        window.location.href = 'auth.html';
      });
    });
  }

  async function init() {
    if (!client()) return;

    const page = document.body.dataset.page;
    if (page === 'auth') await initLogin();
    if (page === 'register') await initRegister();
    if (page === 'dashboard') await initDashboard();
    if (page === 'profile') await initProfile();
    if (page === 'recovery') await initRecovery();
    await initLogout();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
