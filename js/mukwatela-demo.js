(function () {
  const STORAGE_KEYS = {
    app: 'mukwatela-demo-app',
    auth: 'mukwatela-demo-auth',
    demoUsers: 'mukwatela-demo-users',
    services: 'mukwatela-demo-services',
    orders: 'mukwatela-demo-orders',
    notifications: 'mukwatela-demo-notifications',
    cards: 'mukwatela-demo-cards',
    content: 'mukwatela-demo-content',
    admin: 'mukwatela-demo-admin'
  };

  const demoServices = [
    {
      id: 'svc-graphics',
      name: 'Serviços Gráficos',
      category: 'Impressão',
      description: 'Impressão, timbragem, fotocópias, plastificação e carimbos para uso profissional.',
      price: 120,
      image: 'assets/WhatsApp Image 2026-09-13 at 23.30.31.jpeg',
      features: ['Impressão', 'Timbragem', 'Carimbos'],
      type: 'quantity'
    },
    {
      id: 'svc-personalization',
      name: 'Personalização',
      category: 'Identidade',
      description: 'Personalização a laser, pass PVC e materiais personalizados com acabamento preciso.',
      price: 180,
      image: 'assets/WhatsApp Image 2026-09-13 at 23.30.32.jpeg',
      features: ['Personalização', 'Acabamento', 'Material'],
      type: 'format'
    },
    {
      id: 'svc-technology',
      name: 'Tecnologia',
      category: 'Digital',
      description: 'Manutenção de computadores, digitalização e suporte tecnológico para o dia a dia.',
      price: 220,
      image: 'assets/WhatsApp Image 2026-09-13 at 23.30.33.jpeg',
      features: ['Suporte', 'Digitalização', 'Manutenção'],
      type: 'service'
    },
    {
      id: 'svc-business',
      name: 'Serviços Empresariais',
      category: 'Empresa',
      description: 'Criação de empresas, formações e apoio para a estruturação do negócio.',
      price: 320,
      image: 'assets/WhatsApp Image 2026-09-13 at 23.30.34.jpeg',
      features: ['Criação', 'Apoio', 'Formação'],
      type: 'business'
    }
  ];

  const baseUsers = [
    { id: 'demo-client', name: 'Cliente Demo', company: 'Mukwatela Demo', email: 'cliente@demo.com', phone: '912345678', password: '123456', role: 'client', address: 'Rua da Demo, 12, Luanda' },
    { id: 'demo-admin', name: 'Administrador', company: 'Mukwatela', email: 'admin@mukwatela.demo', phone: '912345679', password: 'admin123', role: 'admin', address: 'Sede Mukwatela' }
  ];

  const seedOrders = [
    { id: 'MK-2026-00121', customer: 'Cliente Demo', service: 'Serviços Gráficos', date: '2026-09-10', value: '€120.00', payment: 'Cartão bancário', status: 'Pago', method: 'Cartão bancário' },
    { id: 'MK-2026-00122', customer: 'Joana Silva', service: 'Personalização', date: '2026-09-12', value: '€180.00', payment: 'Cartão guardado', status: 'Em processamento', method: 'Cartão guardado' },
    { id: 'MK-2026-00123', customer: 'Marta Costa', service: 'Tecnologia', date: '2026-09-14', value: '€220.00', payment: 'Multipay', status: 'Em produção', method: 'Outro método' },
    { id: 'MK-2026-00124', customer: 'Cliente Demo', service: 'Serviços Empresariais', date: '2026-09-22', value: '€320.00', payment: 'Cartão bancário', status: 'Pago', method: 'Cartão bancário' }
  ];

  const seedNotifications = [
    'Pagamento realizado com sucesso.',
    'O seu pedido #MK-2026-00124 foi recebido.',
    'O seu pedido está em processamento.',
    'O seu serviço foi concluído.'
  ];

  const seedCards = [
    { id: 'card-1', brand: 'VISA', last4: '4821', expiry: '09/29', primary: true },
    { id: 'card-2', brand: 'MASTERCARD', last4: '1138', expiry: '11/27', primary: false }
  ];

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getState() {
    const state = readStorage(STORAGE_KEYS.app, {
      users: baseUsers,
      services: demoServices,
      orders: seedOrders,
      notifications: seedNotifications,
      cards: seedCards,
      activeUser: null,
      lastOrder: null
    });

    if (!state.users) state.users = baseUsers;
    if (!state.services) state.services = demoServices;
    if (!state.orders) state.orders = seedOrders;
    if (!state.notifications) state.notifications = seedNotifications;
    if (!state.cards) state.cards = seedCards;
    if (!state.activeUser) state.activeUser = null;
    if (!state.lastOrder) state.lastOrder = null;

    writeStorage(STORAGE_KEYS.app, state);
    return state;
  }

  function setState(nextState) {
    writeStorage(STORAGE_KEYS.app, nextState);
  }

  function showToast(message, tone = 'success') {
    let toast = document.getElementById('demo-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'demo-toast';
      toast.className = `demo-toast demo-toast-${tone}`;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timeoutId);
    showToast.timeoutId = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  function isLoggedIn() {
    const state = getState();
    return Boolean(state.activeUser);
  }

  function getCurrentUser() {
    const state = getState();
    return state.activeUser ? state.users.find((user) => user.email === state.activeUser.email) || state.activeUser : null;
  }

  function loginUser(email, password) {
    const state = getState();
    const user = state.users.find((item) => item.email.toLowerCase() === String(email).toLowerCase() && item.password === String(password));
    if (!user) {
      showToast('Credenciais inválidas.', 'error');
      return false;
    }
    state.activeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    setState(state);
    showToast('Login efetuado com sucesso.', 'success');
    return true;
  }

  function logoutUser() {
    const state = getState();
    state.activeUser = null;
    setState(state);
    window.location.href = 'auth.html';
  }

  function registerUser(formData) {
    const state = getState();
    const exists = state.users.some((user) => user.email.toLowerCase() === formData.email.toLowerCase());
    if (exists) {
      showToast('Este email já está registado.', 'error');
      return false;
    }

    const newUser = {
      id: `user-${Date.now()}`,
      name: formData.name,
      company: formData.company || '',
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      role: 'client',
      address: 'Morada não definida'
    };

    state.users.push(newUser);
    state.activeUser = { id: newUser.id, name: newUser.name, email: newUser.email, role: 'client' };
    setState(state);
    showToast('Conta criada com sucesso.', 'success');
    return true;
  }

  function getDemoServices() {
    return getState().services || demoServices;
  }

  function openCheckout(serviceId) {
    const service = getDemoServices().find((item) => item.id === serviceId);
    if (!service) return;
    sessionStorage.setItem('mukwatela-selected-service', JSON.stringify(service));
    window.location.href = 'checkout.html';
  }

  function initAuthPages() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const demoLoginBtn = document.getElementById('demo-login-btn');
    const forgotBtn = document.getElementById('forgot-password-btn');

    loginForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const payload = new FormData(loginForm);
      const email = payload.get('email');
      const password = payload.get('password');
      if (loginUser(email, password)) {
        window.location.href = 'dashboard.html';
      }
    });

    registerForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const payload = new FormData(registerForm);
      const formData = {
        name: payload.get('name'),
        company: payload.get('company'),
        email: payload.get('email'),
        phone: payload.get('phone'),
        password: payload.get('password'),
        confirmPassword: payload.get('confirmPassword')
      };

      if (formData.password !== formData.confirmPassword) {
        showToast('As palavras-passe não coincidem.', 'error');
        return;
      }

      if (registerUser(formData)) {
        window.location.href = 'dashboard.html';
      }
    });

    demoLoginBtn?.addEventListener('click', () => {
      const success = loginUser('cliente@demo.com', '123456');
      if (success) window.location.href = 'dashboard.html';
    });

    forgotBtn?.addEventListener('click', () => {
      showToast('Recuperação simulada. Integração de backend futura aqui.', 'info');
    });
  }

  function renderServiceCatalog() {
    const list = document.getElementById('services-list');
    if (!list) return;
    const services = getDemoServices();
    list.innerHTML = services.map((service) => `
      <article class="service-card-item catalog-item" data-animate="fade-up">
        <div class="service-visual">
          <img src="${service.image}" alt="${service.name}" loading="lazy" />
        </div>
        <div class="service-copy">
          <span class="service-number">${service.category}</span>
          <h3>${service.name}</h3>
          <p>${service.description}</p>
          <ul class="service-info-list">
            ${service.features.map((item) => `<li>${item}</li>`).join('')}
          </ul>
          <div class="price-row">
            <strong>${service.price ? `€${service.price}` : 'Solicitar orçamento'}</strong>
          </div>
          <div class="catalog-actions">
            <button type="button" class="btn btn-primary" data-buy-service="${service.id}">Comprar serviço</button>
            <button type="button" class="btn btn-secondary" data-request-quote="${service.id}">Solicitar orçamento</button>
          </div>
        </div>
      </article>
    `).join('');

    document.querySelectorAll('[data-buy-service]').forEach((button) => {
      button.addEventListener('click', () => openCheckout(button.getAttribute('data-buy-service')));
    });

    document.querySelectorAll('[data-request-quote]').forEach((button) => {
      button.addEventListener('click', () => {
        showToast('Orçamento solicitado. A API de email/WhatsApp será integrada futuramente.', 'info');
      });
    });
  }

  function renderDashboard() {
    const user = getCurrentUser();
    const userName = document.getElementById('user-name');
    if (userName) userName.textContent = user ? user.name : 'Cliente';

    const avatar = document.getElementById('user-avatar');
    if (avatar && user) avatar.textContent = user.name.charAt(0).toUpperCase();

    const state = getState();
    const serviceCount = state.orders.filter((order) => order.customer === (user ? user.name : 'Cliente Demo')).length;
    document.getElementById('sum-services')?.replaceChildren(document.createTextNode(String(serviceCount || 1)));
    document.getElementById('sum-orders')?.replaceChildren(document.createTextNode(String(Math.max(2, serviceCount))));
    document.getElementById('sum-payments')?.replaceChildren(document.createTextNode(String(Math.max(1, serviceCount))));
    document.getElementById('sum-budgets')?.replaceChildren(document.createTextNode(String(Math.max(1, serviceCount - 1))));

    const activity = [
      'Pedido de impressão',
      'Pagamento efetuado',
      'Orçamento solicitado',
      'Serviço concluído'
    ];
    const activityList = document.getElementById('recent-activity');
    if (activityList) {
      activityList.innerHTML = activity.map((item) => `<li>${item}</li>`).join('');
    }

    const notifications = document.getElementById('dashboard-notifications');
    if (notifications) {
      notifications.innerHTML = state.notifications.slice(0, 3).map((notification) => `<li>${notification}</li>`).join('');
    }

    const count = document.getElementById('notifications-count');
    if (count) count.textContent = String(state.notifications.length);
  }

  function renderOrdersTable() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;
    const state = getState();
    tableBody.innerHTML = state.orders.map((order) => `
      <tr>
        <td>${order.id}</td>
        <td>${order.service}</td>
        <td>${order.date}</td>
        <td>${order.value}</td>
        <td>${order.payment}</td>
        <td><span class="status-pill status-${order.status.toLowerCase().replace(/\s+/g, '-')}">${order.status}</span></td>
        <td><button type="button" class="link-button" data-order-detail="${order.id}">Ver detalhes</button></td>
      </tr>
    `).join('');
  }

  function renderSavedCards() {
    const cardsList = document.getElementById('saved-cards-list');
    if (!cardsList) return;
    const state = getState();
    cardsList.innerHTML = state.cards.map((card) => `
      <article class="saved-card">
        <div>
          <span class="brand-tags">${card.brand}</span>
          <strong>•••• •••• •••• ${card.last4}</strong>
          <p>Validade: ${card.expiry}</p>
        </div>
        <div class="card-actions">
          <button type="button" class="btn btn-secondary" data-primary-card="${card.id}" ${card.primary ? 'disabled' : ''}>${card.primary ? 'Cartão principal' : 'Definir como principal'}</button>
          <button type="button" class="btn btn-link" data-remove-card="${card.id}">Remover</button>
        </div>
      </article>
    `).join('');

    document.querySelectorAll('[data-primary-card]').forEach((button) => {
      button.addEventListener('click', () => {
        const state = getState();
        state.cards = state.cards.map((card) => ({ ...card, primary: card.id === button.getAttribute('data-primary-card') }));
        setState(state);
        renderSavedCards();
        showToast('Cartão principal atualizado.', 'success');
      });
    });

    document.querySelectorAll('[data-remove-card]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-remove-card');
        const state = getState();
        state.cards = state.cards.filter((card) => card.id !== id);
        setState(state);
        renderSavedCards();
      });
    });

    const modal = document.getElementById('card-modal');
    const openModal = () => {
      modal?.classList.add('is-open');
      modal?.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      document.getElementById('new-card-name')?.focus();
    };
    const closeModal = () => {
      modal?.classList.remove('is-open');
      modal?.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    };
    const addCardButton = document.getElementById('add-card-btn');
    const closeCardButton = document.getElementById('card-modal-close');
    const addCardForm = document.getElementById('add-card-form');
    if (addCardButton) addCardButton.onclick = openModal;
    if (closeCardButton) closeCardButton.onclick = closeModal;
    if (modal) modal.onclick = (event) => {
      if (event.target === modal) closeModal();
    };
    if (addCardForm) addCardForm.onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const number = String(form.get('number')).replace(/\D/g, '');
      const state = getState();
      const makePrimary = form.get('primary') === 'on' || state.cards.length === 0;
      if (makePrimary) state.cards = state.cards.map((card) => ({ ...card, primary: false }));
      state.cards.push({
        id: `card-${Date.now()}`,
        brand: number.startsWith('5') ? 'MASTERCARD' : 'VISA',
        last4: number.slice(-4),
        expiry: String(form.get('expiry')).trim(),
        primary: makePrimary
      });
      setState(state);
      event.currentTarget.reset();
      closeModal();
      renderSavedCards();
      showToast('Cartão guardado com sucesso.', 'success');
    };
  }

  function renderNotificationsPage() {
    const list = document.getElementById('all-notifications');
    if (!list) return;
    const state = getState();
    list.innerHTML = state.notifications.map((notification) => `<li>${notification}</li>`).join('');
  }

  function renderProfilePage() {
    const profileForm = document.getElementById('profile-form');
    const user = getCurrentUser();
    if (!user) return;

    const state = getState();
    const fullUser = state.users.find((entry) => entry.email === user.email) || user;
    document.getElementById('profile-name').value = fullUser.name || '';
    document.getElementById('profile-company').value = fullUser.company || '';
    document.getElementById('profile-email').value = fullUser.email || '';
    document.getElementById('profile-phone').value = fullUser.phone || '';
    document.getElementById('profile-address').value = fullUser.address || '';

    profileForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const state = getState();
      const userIndex = state.users.findIndex((entry) => entry.email === user.email);
      if (userIndex >= 0) {
        const form = new FormData(profileForm);
        state.users[userIndex].name = form.get('name');
        state.users[userIndex].company = form.get('company');
        state.users[userIndex].email = form.get('email');
        state.users[userIndex].phone = form.get('phone');
        state.users[userIndex].address = form.get('address');
        state.activeUser = { id: state.users[userIndex].id, name: state.users[userIndex].name, email: state.users[userIndex].email, role: 'client' };
        setState(state);
        showToast('Perfil atualizado.', 'success');
      }
    });
  }

  function renderAdminDashboard() {
    const state = getState();
    const adminCustomers = state.users.filter((user) => user.role === 'client').length;
    const totalOrders = state.orders.length;
    const totalPayments = state.orders.filter((order) => order.status === 'Pago').length;
    const revenue = state.orders.reduce((sum, order) => {
      const value = Number(String(order.value).replace(/[€ ,]/g, '')) || 0;
      return sum + value;
    }, 0);

    document.getElementById('admin-customers')?.replaceChildren(document.createTextNode(String(adminCustomers)));
    document.getElementById('admin-orders')?.replaceChildren(document.createTextNode(String(totalOrders)));
    document.getElementById('admin-payments')?.replaceChildren(document.createTextNode(String(totalPayments)));
    document.getElementById('admin-revenue')?.replaceChildren(document.createTextNode(`€${revenue.toFixed(0)}`));
    document.getElementById('admin-pending')?.replaceChildren(document.createTextNode(String(Math.max(1, totalOrders - totalPayments))));
    document.getElementById('admin-services-active')?.replaceChildren(document.createTextNode(String(state.services.length)));

    const orderTable = document.getElementById('admin-order-table');
    if (orderTable) {
      orderTable.innerHTML = state.orders.slice(0, 4).map((order) => `
        <tr>
          <td>${order.customer}</td>
          <td>${order.service}</td>
          <td>${order.date}</td>
          <td>${order.value}</td>
          <td><span class="status-pill status-${order.status.toLowerCase().replace(/\s+/g, '-')}">${order.status}</span></td>
          <td><button type="button" class="link-button">Ver pedido</button></td>
        </tr>
      `).join('');
    }

    const clientsTable = document.getElementById('admin-clients-table');
    if (clientsTable) {
      clientsTable.innerHTML = state.users.filter((user) => user.role === 'client').slice(0, 3).map((user) => `
        <tr>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>${user.phone}</td>
          <td>2026-09-01</td>
          <td>2</td>
          <td><span class="status-pill status-activo">Ativo</span></td>
          <td><button type="button" class="link-button">Ver cliente</button></td>
        </tr>
      `).join('');
    }

    const allOrdersTable = document.getElementById('admin-all-orders');
    if (allOrdersTable) {
      allOrdersTable.innerHTML = state.orders.map((order) => `
        <tr>
          <td>${order.id}</td>
          <td>${order.customer}</td>
          <td>${order.service}</td>
          <td>${order.value}</td>
          <td>${order.date}</td>
          <td>${order.method}</td>
          <td><span class="status-pill status-${order.status.toLowerCase().replace(/\s+/g, '-')}">${order.status}</span></td>
          <td><button type="button" class="link-button">Ver pedido</button></td>
        </tr>
      `).join('');
    }

    const adminServicesList = document.getElementById('admin-services-list');
    if (adminServicesList) {
      adminServicesList.innerHTML = state.services.map((service) => `
        <article class="admin-service-item">
          <div class="admin-service-thumb"><img src="${service.image}" alt="${service.name}" /></div>
          <div class="admin-service-body">
            <h3>${service.name}</h3>
            <p>${service.description}</p>
            <div class="admin-service-meta">
              <span>${service.category}</span>
              <strong>€${service.price}</strong>
            </div>
            <div class="inline-action-row small-row">
              <button class="btn btn-secondary" type="button">Editar</button>
              <button class="btn btn-primary" type="button">Ocultar</button>
              <button class="btn btn-link" type="button">Eliminar</button>
            </div>
          </div>
        </article>
      `).join('');
    }

    const imagesGrid = document.getElementById('admin-images-grid');
    if (imagesGrid) {
      imagesGrid.innerHTML = state.services.map((service) => `
        <div class="admin-image-item">
          <img src="${service.image}" alt="${service.name}" />
          <div class="inline-action-row small-row">
            <button class="btn btn-secondary" type="button">Alterar</button>
            <button class="btn btn-link" type="button">Remover</button>
          </div>
        </div>
      `).join('');
    }

    const pagesList = document.getElementById('admin-pages-list');
    if (pagesList) {
      pagesList.innerHTML = ['Home', 'Sobre', 'Serviços', 'Portfólio', 'Contactos'].map((page) => `
        <div class="page-row">
          <span>${page}</span>
          <div>
            <button class="btn btn-secondary" type="button">Editar</button>
            <button class="btn btn-primary" type="button">Visualizar</button>
            <button class="btn btn-link" type="button">Ativar</button>
          </div>
        </div>
      `).join('');
    }

    document.querySelectorAll('.admin-tab').forEach((button) => {
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-admin-section');
        document.querySelectorAll('.admin-section').forEach((panel) => {
          panel.classList.toggle('is-visible', panel.dataset.adminPanel === section);
        });
        document.querySelectorAll('.admin-tab').forEach((item) => item.classList.toggle('is-active', item === button));
      });
    });

    document.querySelectorAll('.pill-filter').forEach((filter) => {
      filter.addEventListener('click', () => {
        const selected = filter.getAttribute('data-status-filter');
        document.querySelectorAll('.pill-filter').forEach((item) => item.classList.toggle('is-active', item === filter));
        const rows = Array.from(document.querySelectorAll('#admin-all-orders tr'));
        rows.forEach((row) => {
          const statusCell = row.querySelector('td:nth-child(7)');
          const visible = selected === 'all' || (statusCell && statusCell.textContent.trim() === selected);
          row.style.display = visible ? '' : 'none';
        });
      });
    });
  }

  function renderCheckoutPage() {
    const container = document.getElementById('checkout-service-summary');
    if (!container) return;
    const service = JSON.parse(sessionStorage.getItem('mukwatela-selected-service') || 'null');
    if (!service) {
      container.innerHTML = '<p>Selecione um serviço para continuar.</p>';
      return;
    }

    const amount = Number(service.price || 0);
    const quantity = 1;
    const subtotal = amount * quantity;
    const total = subtotal;

    container.innerHTML = `
      <div class="checkout-service-box">
        <img src="${service.image}" alt="${service.name}" />
        <div>
          <h3>${service.name}</h3>
          <p>${service.description}</p>
        </div>
      </div>
      <div class="checkout-price-list">
        <div><span>Quantidade</span><strong>${quantity}</strong></div>
        <div><span>Preço</span><strong>€${amount}</strong></div>
        <div><span>Subtotal</span><strong>€${subtotal}</strong></div>
        <div class="total-line"><span>Total</span><strong>€${total}</strong></div>
      </div>
    `;

    const dynamicFields = document.getElementById('dynamic-service-fields');
    if (dynamicFields) {
      dynamicFields.innerHTML = `
        <div class="field-row field-two">
          <div>
            <label for="service-quantity">Quantidade</label>
            <input id="service-quantity" type="number" min="1" value="1" />
          </div>
          <div>
            <label for="service-format">Formato</label>
            <select id="service-format"><option value="Padrão">Padrão</option><option value="Médio">Médio</option><option value="Grande">Grande</option></select>
          </div>
        </div>
        <div class="field-row field-two">
          <div>
            <label for="service-material">Material</label>
            <input id="service-material" type="text" value="Papel premium" />
          </div>
          <div>
            <label for="service-dimensions">Dimensões</label>
            <input id="service-dimensions" type="text" value="A4" />
          </div>
        </div>
        <div class="field-row">
          <label for="service-observations">Observações</label>
          <textarea id="service-observations" rows="4" placeholder="Detalhes relevantes do projeto."></textarea>
        </div>
        <div class="field-row">
          <label for="service-deadline">Prazo pretendido</label>
          <input id="service-deadline" type="text" value="7 dias úteis" />
        </div>
      `;
    }

    const checkoutForm = document.getElementById('checkout-form');
    checkoutForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const orderId = `MK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
      const state = getState();
      const user = getCurrentUser();
      state.orders.unshift({
        id: orderId,
        customer: user ? user.name : 'Cliente Demo',
        service: service.name,
        date: new Date().toISOString().slice(0, 10),
        value: `€${total}.00`,
        payment: 'Cartão bancário',
        status: 'Pago',
        method: 'Cartão bancário'
      });
      state.lastOrder = orderId;
      state.notifications.unshift(`Pagamento realizado com sucesso.`, `O seu pedido #${orderId} foi recebido.`, ...state.notifications);
      setState(state);
      window.location.href = 'pedido-confirmado.html';
    });
  }

  function renderConfirmationPage() {
    const summary = document.getElementById('success-summary');
    if (!summary) return;
    const state = getState();
    const orderId = state.lastOrder || 'MK-2026-00124';
    const service = JSON.parse(sessionStorage.getItem('mukwatela-selected-service') || '{"name":"Serviços Gráficos","price":120}') || { name: 'Serviços Gráficos', price: 120 };
    summary.innerHTML = `
      <div class="summary-row"><span>Número do pedido</span><strong>${orderId}</strong></div>
      <div class="summary-row"><span>Serviço</span><strong>${service.name}</strong></div>
      <div class="summary-row"><span>Data</span><strong>${new Date().toISOString().slice(0, 10)}</strong></div>
      <div class="summary-row"><span>Valor</span><strong>€${service.price || 0}</strong></div>
      <div class="summary-row"><span>Método de pagamento</span><strong>Cartão bancário</strong></div>
      <div class="summary-row"><span>Estado</span><strong>Pagamento confirmado</strong></div>
    `;
  }

  function initClientGuard() {
    const isAuthPage = document.body.dataset.page === 'auth' || document.body.dataset.page === 'register';
    const isAdminPage = document.body.dataset.page === 'admin';
    const isDashboardPage = document.body.dataset.page === 'dashboard' || document.body.dataset.page === 'compras' || document.body.dataset.page === 'cartoes' || document.body.dataset.page === 'notifications' || document.body.dataset.page === 'profile';

    if (!isAuthPage && !isAdminPage && isDashboardPage && !isLoggedIn()) {
      window.location.href = 'auth.html';
      return;
    }

    if (isAdminPage) {
      const adminUser = getCurrentUser();
      if (!adminUser || adminUser.role !== 'admin') {
        window.location.href = 'auth.html';
      }
    }
  }

  function initAuthDemo() {
    initAuthPages();
    renderServiceCatalog();
    renderDashboard();
    renderOrdersTable();
    renderSavedCards();
    renderNotificationsPage();
    renderProfilePage();
    renderAdminDashboard();
    renderCheckoutPage();
    renderConfirmationPage();
    initClientGuard();

    document.querySelectorAll('[data-logout]').forEach((button) => {
      button.addEventListener('click', logoutUser);
    });

    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role === 'admin') {
      document.querySelectorAll('[data-admin-panel]').forEach((panel) => panel.classList.add('is-visible'));
    }
  }

  document.addEventListener('DOMContentLoaded', initAuthDemo);
})();
