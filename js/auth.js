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
    const { data, error } = await client().auth.getUser();
    if (error) {
      console.error('Supabase auth:', error);
      return null;
    }
    return data.user ? { user: data.user } : null;
  }

  async function getAppRole(userId) {
    if (!userId) return 'customer';

    const roleResult = await client()
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (!roleResult.error && roleResult.data?.role) {
      return roleResult.data.role;
    }

    return 'customer';
  }

  async function getProfile(userId) {
    const { data, error } = await client()
      .from('profiles')
      .select('id, full_name, phone, company, address, avatar_url, created_at, updated_at')
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

  function consumeAuthReturn() {
    const raw = sessionStorage.getItem('mukwatela-auth-return');
    sessionStorage.removeItem('mukwatela-auth-return');
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
    try {
      const safeUrl = new URL(raw, window.location.origin);
      const blocked = ['/auth.html', '/register.html', '/recuperar-password.html'].includes(safeUrl.pathname);
      if (safeUrl.origin !== window.location.origin || blocked) return null;
      return safeUrl.pathname + safeUrl.search + safeUrl.hash;
    } catch (_) {
      return null;
    }
  }

  async function redirectByRole(session, { allowPendingCheckout = false } = {}) {
    if (!session?.user?.id) {
      window.location.href = 'auth.html';
      return true;
    }

    const role = await getAppRole(session.user.id);
    const authReturn = consumeAuthReturn();

    if (role === 'admin') {
      sessionStorage.removeItem('mukwatela-selected-service-id');
      sessionStorage.removeItem('mukwatela-selected-service');
      window.location.href = 'admin.html';
      return true;
    }

    if (authReturn) {
      window.location.href = authReturn;
      return true;
    }

    if (allowPendingCheckout && sessionStorage.getItem('mukwatela-selected-service-id')) {
      window.location.href = 'checkout.html';
      return true;
    }

    window.location.href = 'dashboard.html';
    return true;
  }

  async function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const session = await getSession();
    if (session) {
      await redirectByRole(session, { allowPendingCheckout: true });
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setLoading(form, true);

      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;

      const { data, error } = await client().auth.signInWithPassword({ email, password });

      if (error) {
        message(
          error.message === 'Email not confirmed'
            ? 'Confirme o seu email antes de entrar.'
            : 'Email ou palavra-passe incorretos.',
          'error'
        );
        setLoading(form, false);
        return;
      }

      if (data.session) {
        await redirectByRole(data.session, { allowPendingCheckout: true });
      }
    });

    document.getElementById('forgot-password-btn')?.addEventListener('click', async () => {
      const email = form.elements.email.value.trim();
      if (!email) {
        message('Digite o seu email primeiro para receber o link de recuperação.', 'error');
        return;
      }

      const button = document.getElementById('forgot-password-btn');
      if (button) button.disabled = true;

      const recoveryUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        ? new URL('recuperar-password.html', window.location.href).href
        : 'https://sitemukwatela.vercel.app/recuperar-password.html';

      const { error } = await client().auth.resetPasswordForEmail(email, {
        redirectTo: recoveryUrl
      });

      if (error) {
        console.error('resetPasswordForEmail:', error);
      }

      message(
        error
          ? 'Não foi possível enviar o email de recuperação: ' + (error.message || 'erro desconhecido.')
          : 'Enviámos um link de recuperação para o seu email. Abra o link no mesmo navegador onde solicitou a recuperação.',
        error ? 'error' : 'success'
      );

      if (button) button.disabled = false;
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

      const firstName = name.split(/\s+/).filter(Boolean)[0] || name;

      const { data, error } = await client().auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            first_name: firstName,
            phone,
            company,
            address: '',
            brand_name: 'Mukwatela',
            company_name: 'Mukwatela',
            terms_accepted: 'true'
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
        await redirectByRole(data.session);
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

    const role = await getAppRole(session.user.id);
    if (role === 'admin') {
      window.location.href = 'admin.html';
      return;
    }

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
      document.getElementById('user-role')?.replaceChildren(document.createTextNode('Cliente'));
    } catch (error) {
      console.error(error);
      const node = document.getElementById('user-name');
      if (node) node.textContent = session.user.email || 'Cliente';
    }
  }

  async function initProfile() {
    const session = await requireSession();
    if (!session) return;

    const role = await getAppRole(session.user.id);
    if (role === 'admin') {
      window.location.href = 'admin.html';
      return;
    }

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

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    const authState = window.mukwatelaAuthState || {
      lastEvent: null,
      recoverySession: null
    };

    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
    );

    const queryParams = new URLSearchParams(window.location.search);

    const hashError = hashParams.get('error_description') || hashParams.get('error');
    if (hashError) {
      message(
        'O link de recuperação é inválido ou expirou. Solicite um novo email de recuperação.',
        'error'
      );
      return;
    }

    let recoverySession = authState.recoverySession || null;

    // O cliente Supabase pode ainda estar a processar o link recebido.
    // Escutamos o evento diretamente e aguardamos alguns segundos antes
    // de informar o utilizador que existe um problema.
    if (!recoverySession) {
      recoverySession = await new Promise((resolve) => {
        let finished = false;

        const finish = (session) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          subscription?.data?.subscription?.unsubscribe?.();
          resolve(session || null);
        };

        const subscription = client().auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' && session) {
            finish(session);
          }
          if (event === 'INITIAL_SESSION' && session && (queryParams.has('code') || hashParams.get('type') === 'recovery')) {
            finish(session);
          }
        });

        const timeout = setTimeout(async () => {
          try {
            const { data } = await client().auth.getSession();
            finish(data?.session || null);
          } catch {
            finish(null);
          }
        }, 5000);
      });
    }

    if (!recoverySession) {
      const { data } = await client().auth.getSession();
      recoverySession = data?.session || null;
    }

    if (!recoverySession) {
      message(
        'Este link não abriu a sessão de recuperação. Abra o link no mesmo navegador onde pediu a recuperação e, se continuar sem funcionar, peça um novo link.',
        'error'
      );
      return;
    }

    if (submitButton) submitButton.disabled = false;
    message('Link de recuperação validado. Escolha a sua nova palavra-passe.', 'success');

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

      if (error) {
        console.error('updateUser password:', error);
        message(
          'Não foi possível atualizar a palavra-passe: ' +
            (error.message || 'sessão de recuperação inválida ou expirada.') +
            ' Solicite um novo link se necessário.',
          'error'
        );
        setLoading(form, false);
        return;
      }

      message('Palavra-passe atualizada com sucesso. Já pode entrar.', 'success');
      form.reset();

      // Remove tokens/fragmentos do URL depois de concluir o processo.
      window.history.replaceState({}, document.title, 'recuperar-password.html');

      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 1200);
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
