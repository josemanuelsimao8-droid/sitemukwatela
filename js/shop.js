(() => {
  const client = () => window.supabaseClient;

  async function getSession() {
    const result = await client().auth.getSession();
    if (result.error) console.error(result.error);
    return result.data?.session || null;
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
      .select('id,name,slug,category,description,image_url,features,unit_price,currency,is_active,sort_order')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function initServices() {
    const list = document.getElementById('services-list');
    if (!list) return;

    const result = await client().from('services')
      .select('id,name,slug,category,description,image_url,features,unit_price,currency,is_active,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (result.error) {
      console.error(result.error);
      list.innerHTML = '<p>Não foi possível carregar os serviços neste momento.</p>';
      return;
    }

    const services = result.data || [];
    if (!services.length) {
      list.innerHTML = '<p>Não existem serviços disponíveis neste momento.</p>';
      return;
    }

    const currentSession = await getSession();
    list.innerHTML = '';

    services.forEach((service) => {
      const card = document.createElement('article');
      card.className = 'service-catalog-card';

      const media = document.createElement('div');
      media.className = 'service-catalog-media';
      if (service.image_url) {
        const img = document.createElement('img');
        img.src = encodeURI(service.image_url);
        img.alt = service.name;
        img.loading = 'lazy';
        media.appendChild(img);
      }

      const body = document.createElement('div');
      body.className = 'service-catalog-body';

      const category = document.createElement('span');
      category.className = 'eyebrow';
      category.textContent = service.category || 'Serviço';

      const title = document.createElement('h2');
      title.textContent = service.name;

      const description = document.createElement('p');
      description.textContent = service.description || '';

      const features = document.createElement('div');
      features.className = 'service-feature-list';
      (Array.isArray(service.features) ? service.features : []).forEach((item) => {
        const tag = document.createElement('span');
        tag.textContent = item;
        features.appendChild(tag);
      });

      const footer = document.createElement('div');
      footer.className = 'service-catalog-footer';

      const price = document.createElement('strong');
      price.textContent = money(service.unit_price, service.currency);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary';
      button.textContent = service.unit_price === null ? 'Solicitar serviço' : 'Comprar serviço';
      button.addEventListener('click', () => {
        selectService(service);
        window.location.href = currentSession ? 'checkout.html' : 'auth.html';
      });

      footer.append(price, button);
      body.append(category, title, description, features, footer);
      card.append(media, body);
      list.appendChild(card);
    });
  }

  async function initCheckout() {
    const form = document.getElementById('checkout-form');
    const summary = document.getElementById('checkout-service-summary');
    if (!form || !summary) return;

    if (!await getSession()) {
      window.location.href = 'auth.html';
      return;
    }

    const selectedId = sessionStorage.getItem('mukwatela-selected-service-id');
    const service = selectedId ? await fetchService(selectedId).catch((error) => {
      console.error(error);
      return null;
    }) : null;

    const profileResult = await client().from('profiles')
      .select('full_name')
      .eq('id', (await getSession()).user.id)
      .maybeSingle();
    const clientName = document.getElementById('checkout-name');
    if (clientName) clientName.value = profileResult.data?.full_name || '';

    if (!service) {
      summary.innerHTML = '<p>Selecione um serviço na área de Serviços para continuar.</p>';
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
    price.textContent = money(service.unit_price, service.currency);
    content.append(title, description, price);
    box.append(image, content);

    summary.innerHTML = '';
    summary.appendChild(box);

    const qty = document.getElementById('service-quantity');
    const totalNode = document.getElementById('checkout-total');
    const paymentList = document.getElementById('payment-method-list');
    const paymentInstructions = document.getElementById('payment-instructions');

    function updateTotal() {
      const quantity = Math.max(1, Number(qty?.value || 1));
      if (totalNode) {
        totalNode.textContent = service.unit_price === null
          ? 'Sob orçamento'
          : money(Number(service.unit_price) * quantity, service.currency);
      }
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

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const quantity = Math.max(1, Number(qty?.value || 1));
      const paymentMethod = form.querySelector('input[name="paymentMethod"]:checked')?.value || null;
      if (!paymentMethod) {
        showMessage('Selecione um método de pagamento.', 'error');
        return;
      }

      const specifications = {
        format: document.getElementById('service-format')?.value || '',
        material: document.getElementById('service-material')?.value.trim() || '',
        dimensions: document.getElementById('service-dimensions')?.value.trim() || '',
        deadline: document.getElementById('service-deadline')?.value.trim() || ''
      };
      const notes = document.getElementById('service-observations')?.value.trim() || null;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'A processar...';

      const result = await client().rpc('create_service_order', {
        p_service_id: service.id,
        p_quantity: quantity,
        p_notes: notes,
        p_specifications: specifications,
        p_payment_method: paymentMethod
      });

      if (result.error) {
        console.error(result.error);
        showMessage('Não foi possível criar o pedido. Tente novamente.', 'error');
        submit.disabled = false;
        submit.textContent = service.unit_price === null ? 'Solicitar serviço' : 'Confirmar pedido';
        return;
      }

      sessionStorage.setItem('mukwatela-last-order-id', result.data.id);
      sessionStorage.removeItem('mukwatela-selected-service-id');
      sessionStorage.removeItem('mukwatela-selected-service');
      window.location.href = 'pedido-confirmado.html';
    });
  }

  const statusLabels = {
    pending: 'Pendente',
    pending_quote: 'A aguardar orçamento',
    processing: 'Em processamento',
    completed: 'Concluído',
    cancelled: 'Cancelado'
  };

  function statusLabel(status) {
    return statusLabels[status] || status;
  }

  async function loadOrders() {
    const body = document.getElementById('orders-table-body');
    if (!body) return;
    if (!await getSession()) {
      window.location.href = 'auth.html';
      return;
    }

    const result = await client().from('orders')
      .select('id,order_number,status,total,currency,payment_method,payment_status,created_at,order_items(service_name,quantity)')
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
      const item = order.order_items?.[0];
      const amount = order.total === null ? 'Sob orçamento' : money(order.total, order.currency);
      return '<tr>' +
        '<td>' + order.order_number + '</td>' +
        '<td>' + (item?.service_name || 'Serviço') + '</td>' +
        '<td>' + new Date(order.created_at).toLocaleDateString('pt-PT') + '</td>' +
        '<td>' + amount + '</td>' +
        '<td>A aguardar pagamento</td>' +
        '<td><span class="status-pill">' + statusLabel(order.status) + '</span></td>' +
        '<td><button type="button" class="link-button" data-order-detail="' + order.id + '">Ver detalhes</button></td>' +
        '</tr>';
    }).join('');

    body.querySelectorAll('[data-order-detail]').forEach((button) => {
      button.addEventListener('click', () => {
        sessionStorage.setItem('mukwatela-last-order-id', button.dataset.orderDetail);
        window.location.href = 'pedido-confirmado.html';
      });
    });
  }

  async function loadDashboard() {
    if (!document.getElementById('sum-orders')) return;
    if (!await getSession()) {
      window.location.href = 'auth.html';
      return;
    }

    const ordersResult = await client().from('orders')
      .select('id,status,created_at,order_items(quantity)');
    const notesResult = await client().from('notifications')
      .select('id,title,message,is_read,created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersResult.error) console.error(ordersResult.error);
    if (notesResult.error) console.error(notesResult.error);

    const orders = ordersResult.data || [];
    const notes = notesResult.data || [];
    const serviceCount = orders.reduce((sum, order) =>
      sum + (order.order_items || []).reduce((sub, item) => sub + Number(item.quantity || 0), 0), 0
    );
    const quoteCount = orders.filter((order) => order.status === 'pending_quote').length;

    document.getElementById('sum-services')?.replaceChildren(document.createTextNode(String(serviceCount)));
    document.getElementById('sum-orders')?.replaceChildren(document.createTextNode(String(orders.length)));
    document.getElementById('sum-payments')?.replaceChildren(document.createTextNode('0'));
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
    if (!await getSession()) {
      window.location.href = 'auth.html';
      return;
    }

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
    if (!await getSession()) {
      window.location.href = 'auth.html';
      return;
    }

    const orderId = sessionStorage.getItem('mukwatela-last-order-id');
    if (!orderId) {
      summary.innerHTML = '<p>Não foi encontrado um pedido recente.</p>';
      return;
    }

    const result = await client().from('orders')
      .select('id,order_number,status,total,currency,payment_method,payment_status,created_at,order_items(service_name,quantity)')
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
      '<div class="summary-row"><span>Serviço</span><strong>' + (item?.service_name || 'Serviço') + '</strong></div>' +
      '<div class="summary-row"><span>Quantidade</span><strong>' + (item?.quantity || 1) + '</strong></div>' +
      '<div class="summary-row"><span>Data</span><strong>' + new Date(order.created_at).toLocaleDateString('pt-PT') + '</strong></div>' +
      '<div class="summary-row"><span>Valor</span><strong>' + (order.total === null ? 'Sob orçamento' : money(order.total, order.currency)) + '</strong></div>' +
      '<div class="summary-row"><span>Estado</span><strong>' + statusLabel(order.status) + '</strong></div>';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!client()) return;
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
