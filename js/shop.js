(() => {
  const client = () => window.supabaseClient;

  async function getSession() {
    const result = await client().auth.getUser();
    if (result.error) {
      console.error('Supabase auth:', result.error);
      return null;
    }
    return result.data?.user ? { user: result.data.user } : null;
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

  async function requireCustomer() {
    const session = await getSession();
    if (!session) {
      window.location.href = 'auth.html';
      return null;
    }

    const role = await getAppRole(session.user.id);
    if (role === 'admin') {
      window.location.href = 'admin.html';
      return null;
    }

    return session;
  }

  function showMessage(text, type) {
    const node = document.getElementById('shop-message') || document.getElementById('auth-message');
    if (!node) return;
    node.textContent = text;
    node.dataset.type = type || 'info';
    node.hidden = false;
  }

  function money(value, currency) {
    if (value === null || value === undefined || value === '') return 'Valor em ' + String(currency || 'AOA') + ' — sob orçamento';
    return String(currency || 'AOA') + ' ' +
      Number(value).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function selectService(service) {
    sessionStorage.setItem('mukwatela-selected-service-id', service.id);
    sessionStorage.setItem('mukwatela-selected-service', JSON.stringify(service));
  }

  async function fetchService(id) {
    const result = await client().from('services')
      .select('id,name,slug,category,description,image_url,features,unit_price,currency,is_active,sort_order,item_type,sku,unit_label,stock_quantity,is_featured')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function initServices() {
    const list = document.getElementById('services-list');
    if (!list) return;

    let query = client().from('services')
      .select('id,name,slug,category,description,image_url,features,unit_price,currency,is_active,sort_order,item_type,sku,unit_label,stock_quantity,is_featured')
      .eq('is_active', true)
      .eq('item_type', 'service');

    const result = await query.order('sort_order', { ascending: true });
    if (result.error) {
      console.error(result.error);
      list.innerHTML = '<p>Não foi possível carregar os serviços neste momento.</p>';
      return;
    }

    const services = result.data || [];
    const searchNode = document.getElementById('catalog-search');
    const categoryNode = document.getElementById('catalog-category');
    const sortNode = document.getElementById('catalog-sort');

    if (categoryNode) {
      const categories = [...new Set(services.map((x) => x.category).filter(Boolean))].sort();
      categoryNode.innerHTML = '<option value="">Todas as categorias</option>' +
        categories.map((x) => '<option value="' + String(x).replace(/"/g,'&quot;') + '">' + x + '</option>').join('');
    }

    const currentSession = await getSession();
    const currentRole = currentSession ? await getAppRole(currentSession.user.id) : 'guest';

    const moneyLocal = (value, currency) => value === null || value === undefined || value === ''
      ? 'Sob orçamento'
      : String(currency || 'AOA') + ' ' + Number(value).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function render() {
      const term = String(searchNode?.value || '').trim().toLowerCase();
      const category = categoryNode?.value || '';
      let data = services.filter((service) => {
        const haystack = [service.name, service.slug, service.category, service.description, service.sku].join(' ').toLowerCase();
        return (!term || haystack.includes(term)) && (!category || service.category === category);
      });

      if (sortNode?.value === 'price_asc') data.sort((a,b) => Number(a.unit_price ?? Infinity) - Number(b.unit_price ?? Infinity));
      if (sortNode?.value === 'price_desc') data.sort((a,b) => Number(b.unit_price ?? -1) - Number(a.unit_price ?? -1));
      if (sortNode?.value === 'name') data.sort((a,b) => String(a.name).localeCompare(String(b.name), 'pt'));

      if (!data.length) {
        list.innerHTML = '<div class="operations-empty">Nenhum serviço corresponde aos filtros.</div>';
        return;
      }

      list.innerHTML = data.map((service) => {
        const features = Array.isArray(service.features)
          ? service.features.map((item) => '<span>' + item + '</span>').join('')
          : '';
        const stock = service.item_type === 'material' && service.stock_quantity != null
          ? '<small class="catalog-stock">' + Number(service.stock_quantity).toLocaleString('pt-PT') + ' ' + (service.unit_label || 'unidade') + ' disponíveis</small>'
          : '';
        const action = currentRole === 'admin'
          ? '<a class="btn btn-primary" href="admin.html">Gerir no painel</a>'
          : '<button class="btn btn-primary" type="button" data-add-cart="' + service.id + '">Adicionar ao carrinho</button>';
        return '<article class="service-catalog-card">' +
          '<a class="service-catalog-media" href="produto.html?id=' + encodeURIComponent(service.id) + '" aria-label="Ver ' + service.name + '">' +
            (service.image_url ? '<img src="' + esc(service.image_url) + '" alt="' + esc(service.name) + '" loading="lazy">' : '') +
          '</a>' +
          '<div class="service-catalog-body">' +
            '<span class="eyebrow">' + esc(service.category || 'Serviço') + '</span>' +
            '<h2>' + esc(service.name) + '</h2><p>' + esc(service.description || '') + '</p>' +
            '<div class="service-feature-list">' + features + '</div>' +
            '<div class="service-catalog-footer"><div><strong>' + moneyLocal(service.unit_price, service.currency) + '</strong>' +
              (service.unit_price != null ? '<small>/ ' + (service.unit_label || 'unidade') + '</small>' : '') + stock +
            '</div><div class="catalog-card-actions">' + action +
              '<a class="catalog-detail-link" href="produto.html?id=' + encodeURIComponent(service.id) + '">Detalhes</a></div></div>' +
          '</div></article>';
      }).join('');

      list.querySelectorAll('[data-add-cart]').forEach((button) => button.addEventListener('click', async () => {
        const service = services.find((x) => x.id === button.dataset.addCart);
        if (!service || !window.MukwatelaCart) return;

        button.disabled = true;
        const added = await window.MukwatelaCart.add(service, 1, {});
        if (added) showMessage('Serviço adicionado ao carrinho.', 'success');
        button.disabled = false;
      }));
    }

    searchNode?.addEventListener('input', render);
    categoryNode?.addEventListener('change', render);
    sortNode?.addEventListener('change', render);
    render();
  }

  async function initCheckout() {
    const form = document.getElementById('checkout-form');
    const summary = document.getElementById('checkout-service-summary');
    if (!form || !summary) return;

    const session = await requireCustomer();
    if (!session) return;

    const selectedId = sessionStorage.getItem('mukwatela-selected-service-id');
    const service = selectedId ? await fetchService(selectedId).catch((error) => {
      console.error(error);
      return null;
    }) : null;

    const profileResult = await client().from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .maybeSingle();
    const clientName = document.getElementById('checkout-name');
    if (clientName) clientName.value = profileResult.data?.full_name || '';

    if (!service) {
      summary.innerHTML = '<p>Selecione um serviço ou material no catálogo para continuar.</p>';
      form.hidden = true;
      return;
    }

    form.querySelectorAll('[data-payment-fields]').forEach((node) => node.remove());

    const box = document.createElement('div');
    box.className = 'checkout-service-box';

    const image = document.createElement('img');
    if (service.image_url) image.src = encodeURI(service.image_url);
    image.alt = service.name;

    const content = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = service.name;
    const description = document.createElement('p');
    description.textContent = service.description || '';
    const price = document.createElement('strong');
    price.textContent = service.unit_price === null
      ? money(service.unit_price, service.currency)
      : money(service.unit_price, service.currency) + ' / ' + (service.unit_label || 'unidade');
    content.append(title, description, price);
    box.append(image, content);

    summary.innerHTML = '';
    summary.appendChild(box);

    const itemType = service.item_type === 'material' ? 'material' : 'service';
    const qty = document.getElementById('service-quantity');
    const totalNode = document.getElementById('checkout-total');
    const paymentList = document.getElementById('payment-method-list');
    const paymentInstructions = document.getElementById('payment-instructions');

    function updateTotal() {
      const quantity = Math.max(1, Number(qty?.value || 1));
      if (totalNode) {
        totalNode.textContent = service.unit_price === null
          ? 'Valor em ' + String(service.currency || 'AOA') + ' — sob orçamento'
          : money(Number(service.unit_price) * quantity, service.currency);
      }
      document.querySelectorAll('[data-service-only]').forEach((node) => {
        node.hidden = itemType !== 'service';
      });
      const qtyLabel = document.querySelector('label[for="service-quantity"]');
      if (qtyLabel) qtyLabel.textContent = itemType === 'material' ? 'Quantidade' : 'Quantidade';
      const paymentContinue = document.querySelector('#checkout-form button[type="submit"]');
      if (paymentContinue) paymentContinue.textContent = service.unit_price === null ? 'ENVIAR PARA ORÇAMENTO' : 'CONTINUAR PARA PAGAMENTO';
    }

    if (qty) qty.addEventListener('input', updateTotal);
    updateTotal();

    const methodsResult = await client().from('payment_methods')
      .select('id,code,name,description,account_details,instructions,is_active,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (methodsResult.error) {
      console.error(methodsResult.error);
      showMessage('Não foi possível carregar os métodos de pagamento.', 'error');
      return;
    }

    const methods = methodsResult.data || [];
    if (paymentList) {
      paymentList.innerHTML = methods.map((method, index) =>
        '<label class="payment-method-option">' +
          '<input type="radio" name="paymentMethod" value="' + method.code + '" ' + (index === 0 ? 'checked' : '') + '>' +
          '<span><strong>' + method.name + '</strong><small>' + (method.description || '') + '</small></span>' +
        '</label>'
      ).join('');
    }

    const renderPaymentInstructions = () => {
      const selected = paymentList?.querySelector('input[name="paymentMethod"]:checked')?.value;
      const method = methods.find((item) => item.code === selected);
      if (!paymentInstructions || !method) return;
      paymentInstructions.innerHTML =
        '<strong>' + method.name + '</strong>' +
        (method.account_details ? '<p>' + method.account_details + '</p>' : '') +
        (method.instructions ? '<p>' + method.instructions + '</p>' : '');
    };

    paymentList?.addEventListener('change', renderPaymentInstructions);
    renderPaymentInstructions();

    // O checkout é submetido exclusivamente por js/checkout-payment.js.
;
  }

  const statusLabels = {
    pending: 'Pendente',
    pending_payment: 'A aguardar pagamento',
    pending_quote: 'A aguardar orçamento',
    processing: 'Em processamento',
    completed: 'Concluído',
    cancelled: 'Cancelado'
  };

  function statusLabel(status) {
    return statusLabels[status] || status;
  }

  const paymentStatusLabels = {
    unpaid: 'Não pago',
    submitted: 'Em validação',
    confirmed: 'Pago',
    rejected: 'Rejeitado'
  };

  function paymentStatusLabel(status) {
    return paymentStatusLabels[status] || 'Não pago';
  }

  async function loadOrders() {
    const body = document.getElementById('orders-table-body');
    if (!body) return;
    if (!await requireCustomer()) return;

    const result = await client().from('orders')
      .select('id,order_number,status,total,currency,payment_method,payment_status,created_at,order_items(service_name,quantity,item_type,unit_label)')
      .order('created_at', { ascending: false });

    if (result.error) {
      console.error(result.error);
      body.innerHTML = '<tr><td colspan="7">Não foi possível carregar os seus pedidos.</td></tr>';
      return;
    }

    const orders = result.data || [];
    if (!orders.length) {
      body.innerHTML = '<tr><td colspan="7">Ainda não existem pedidos.</td></tr>';
      return;
    }

    body.innerHTML = orders.map((order) => {
      const items = order.order_items || [];
      const amount = order.total === null ? 'Sob orçamento' : money(order.total, order.currency);
      const itemLabel = items.length > 1 ? items.map(item => (item.item_type === 'material' ? 'Material: ' : 'Serviço: ') + (item.service_name || 'Item')).join(', ') : ((items[0]?.item_type === 'material' ? 'Material: ' : 'Serviço: ') + (items[0]?.service_name || 'Item'));
      return '<tr>' +
        '<td>' + order.order_number + '</td>' +
        '<td>' + itemLabel + '</td>' +
        '<td>' + new Date(order.created_at).toLocaleDateString('pt-PT') + '</td>' +
        '<td>' + amount + '</td>' +
        '<td><span class="status-pill payment-status-table payment-status-table-' + (order.payment_status || 'unpaid') + '">' + paymentStatusLabel(order.payment_status) + '</span></td>' +
        '<td><span class="status-pill">' + statusLabel(order.status) + '</span></td>' +
        '<td><button type="button" class="link-button" data-order-detail="' + order.id + '">' + (order.payment_status === 'confirmed' || order.total === null ? 'Ver pedido' : 'Pagar agora') + '</button></td>' +
        '</tr>';
    }).join('');

    body.querySelectorAll('[data-order-detail]').forEach((button) => {
      button.addEventListener('click', () => {
        sessionStorage.setItem('mukwatela-last-order-id', button.dataset.orderDetail);
        const shouldPay = button.textContent.trim() === 'Pagar agora';
        window.location.href = shouldPay
          ? 'pagamento.html?order=' + encodeURIComponent(button.dataset.orderDetail)
          : 'pedido.html?order=' + encodeURIComponent(button.dataset.orderDetail);
      });
    });
  }

  let notificationChannel = null;
  let currentUserId = null;

  function subscribeCustomerNotifications(userId) {
    if (!userId || notificationChannel) return;
    notificationChannel = client().channel('customer-notifications-' + userId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: 'user_id=eq.' + userId
      }, async () => {
        if (document.getElementById('sum-orders')) await loadDashboard();
        if (document.getElementById('all-notifications')) await loadNotifications();
      })
      .subscribe();
  }

  async function loadDashboard() {
    if (!document.getElementById('sum-orders')) return;
    if (!await requireCustomer()) return;

    const ordersResult = await client().from('orders')
      .select('id,order_number,status,payment_status,created_at,order_items(quantity,item_type)');
    const notesResult = await client().from('notifications')
      .select('id,title,message,is_read,created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersResult.error) console.error(ordersResult.error);
    if (notesResult.error) console.error(notesResult.error);

    const orders = ordersResult.data || [];
    const notes = notesResult.data || [];
    subscribeCustomerNotifications(currentUserId || '');
    const itemCount = orders.reduce((sum, order) =>
      sum + (order.order_items || []).reduce((sub, item) => sub + Number(item.quantity || 0), 0), 0
    );
    const quoteCount = orders.filter((order) => order.status === 'pending_quote').length;
    const confirmedPayments = orders.filter((order) => order.payment_status === 'confirmed').length;

    document.getElementById('sum-services')?.replaceChildren(document.createTextNode(String(itemCount)));
    document.getElementById('sum-orders')?.replaceChildren(document.createTextNode(String(orders.length)));
    document.getElementById('sum-payments')?.replaceChildren(document.createTextNode(String(confirmedPayments)));
    document.getElementById('sum-budgets')?.replaceChildren(document.createTextNode(String(quoteCount)));
    document.getElementById('notifications-count')?.replaceChildren(document.createTextNode(String(notes.length)));

    const activity = document.getElementById('recent-activity');
    if (activity) {
      activity.innerHTML = orders.slice(0, 4).map((order) =>
        '<li>Pedido ' + order.order_number + ' · ' +
        new Date(order.created_at).toLocaleDateString('pt-PT') + '</li>'
      ).join('') || '<li>Sem atividade recente.</li>';
    }

    const list = document.getElementById('dashboard-notifications');
    if (list) {
      list.innerHTML = notes.slice(0, 3).map((note) =>
        '<li><strong>' + note.title + '</strong><span>' + note.message + '</span></li>'
      ).join('') || '<li>Sem notificações.</li>';
    }
  }

  async function loadNotifications() {
    const list = document.getElementById('all-notifications');
    if (!list) return;
    if (!await requireCustomer()) return;

    const result = await client().from('notifications')
      .select('id,title,message,is_read,created_at')
      .order('created_at', { ascending: false });

    if (result.error) {
      console.error(result.error);
      list.innerHTML = '<li>Não foi possível carregar as notificações.</li>';
      return;
    }

    list.innerHTML = (result.data || []).map((note) =>
      '<li><strong>' + note.title + '</strong><span>' + note.message +
      '</span><small>' + new Date(note.created_at).toLocaleString('pt-PT') + '</small></li>'
    ).join('') || '<li>Sem notificações.</li>';
  }

  async function loadConfirmation() {
    const summary = document.getElementById('success-summary');
    if (!summary) return;
    if (!await requireCustomer()) return;

    const orderId = sessionStorage.getItem('mukwatela-last-order-id');
    if (!orderId) {
      summary.innerHTML = '<p>Não foi encontrado um pedido recente.</p>';
      return;
    }

    const result = await client().from('orders')
      .select('id,order_number,status,total,currency,payment_method,payment_status,created_at,order_items(service_name,quantity,item_type,unit_label)')
      .eq('id', orderId)
      .maybeSingle();

    if (result.error || !result.data) {
      summary.innerHTML = '<p>Não foi possível carregar o pedido.</p>';
      return;
    }

    const order = result.data;
    const item = order.order_items?.[0];
    summary.innerHTML =
      '<div class="summary-row"><span>Número do pedido</span><strong>' + order.order_number + '</strong></div>' +
      '<div class="summary-row"><span>' + (item?.item_type === 'material' ? 'Material' : 'Serviço') + '</span><strong>' + (item?.service_name || 'Item') + '</strong></div>' +
      '<div class="summary-row"><span>Quantidade</span><strong>' + (item?.quantity || 1) + '</strong></div>' +
      '<div class="summary-row"><span>Data</span><strong>' + new Date(order.created_at).toLocaleDateString('pt-PT') + '</strong></div>' +
      '<div class="summary-row"><span>Valor</span><strong>' + (order.total === null ? 'Sob orçamento' : money(order.total, order.currency)) + '</strong></div>' +
      '<div class="summary-row"><span>Estado</span><strong>' + statusLabel(order.status) + '</strong></div>';
  }

  window.addEventListener('cms:services-updated', () => {
    if (document.getElementById('services-list')) initServices();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    if (!client()) return;
    const session = await getSession();
    if (session) {
      currentUserId = session.user.id;
      subscribeCustomerNotifications(currentUserId);
    }

    await Promise.all([
      initServices(),
      initCheckout(),
      loadOrders(),
      loadDashboard(),
      loadNotifications(),
      loadConfirmation()
    ]);
  });
})();
