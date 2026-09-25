(() => {
  const db = () => window.supabaseClient;

  const money = (value, currency = 'AOA') =>
    value === null || value === undefined || value === ''
      ? 'Sob orçamento'
      : String(currency) + ' ' + Number(value).toLocaleString('pt-PT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  function msg(text, type = 'info') {
    const node = document.getElementById('admin-message');
    if (!node) return;
    node.textContent = text;
    node.dataset.type = type;
    node.hidden = false;
  }

  async function requireAdmin() {
    const sessionResult = await db().auth.getSession();
    const session = sessionResult.data?.session;
    if (!session) {
      window.location.href = 'auth.html';
      return null;
    }

    const result = await db().from('profiles')
      .select('id,full_name,role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (result.error || result.data?.role !== 'admin') {
      window.location.href = 'dashboard.html';
      return null;
    }
    return session;
  }

  async function loadOverview() {
    const [clients, orders, paid, services] = await Promise.all([
      db().from('profiles').select('id', { count: 'exact', head: true }),
      db().from('orders').select('id,total,payment_status,status,created_at').order('created_at', { ascending: false }),
      db().from('orders').select('id,total').eq('payment_status', 'confirmed'),
      db().from('services').select('id', { count: 'exact', head: true }).eq('is_active', true)
    ]);

    document.getElementById('admin-customers').textContent = String(clients.count ?? 0);
    document.getElementById('admin-orders').textContent = String(orders.data?.length ?? 0);
    document.getElementById('admin-payments').textContent = String(paid.data?.length ?? 0);
    document.getElementById('admin-services-active').textContent = String(services.count ?? 0);

    const revenue = (paid.data || []).reduce((sum, row) => sum + Number(row.total || 0), 0);
    document.getElementById('admin-revenue').textContent = money(revenue);

    const pending = (orders.data || []).filter((row) =>
      ['pending_payment','pending_quote','pending','processing'].includes(row.status)
    ).length;
    document.getElementById('admin-pending').textContent = String(pending);

    const body = document.getElementById('admin-order-table');
    if (!body) return;
    body.innerHTML = (orders.data || []).slice(0, 8).map((order) =>
      '<tr><td>' + esc(order.id.slice(0,8)) + '</td>' +
      '<td>' + esc(order.status) + '</td>' +
      '<td>' + esc(order.payment_status) + '</td>' +
      '<td>' + money(order.total) + '</td>' +
      '<td>' + new Date(order.created_at).toLocaleDateString('pt-PT') + '</td></tr>'
    ).join('') || '<tr><td colspan="5">Sem pedidos.</td></tr>';
  }

  async function loadClients() {
    const result = await db().from('profiles')
      .select('id,full_name,phone,company,role,created_at')
      .order('created_at', { ascending: false });

    if (result.error) {
      msg('Não foi possível carregar clientes.', 'error');
      return;
    }

    const body = document.getElementById('admin-clients-table');
    body.innerHTML = (result.data || []).map((client) =>
      '<tr><td>' + esc(client.full_name) + '</td>' +
      '<td>' + esc(client.company || '—') + '</td>' +
      '<td>' + esc(client.phone || '—') + '</td>' +
      '<td>' + esc(client.role) + '</td>' +
      '<td>' + new Date(client.created_at).toLocaleDateString('pt-PT') + '</td></tr>'
    ).join('') || '<tr><td colspan="5">Sem clientes.</td></tr>';
  }

  async function loadOrders() {
    const result = await db().from('orders')
      .select('id,order_number,customer_id,status,total,currency,payment_method,payment_status,created_at,profiles(full_name),order_items(service_name,quantity)')
      .order('created_at', { ascending: false });

    const body = document.getElementById('admin-all-orders');
    if (result.error) {
      msg('Não foi possível carregar pedidos.', 'error');
      return;
    }

    body.innerHTML = (result.data || []).map((order) => {
      const item = order.order_items?.[0];
      return '<tr>' +
        '<td>' + esc(order.order_number) + '</td>' +
        '<td>' + esc(order.profiles?.full_name || 'Cliente') + '</td>' +
        '<td>' + esc(item?.service_name || 'Serviço') + '</td>' +
        '<td>' + money(order.total, order.currency) + '</td>' +
        '<td>' + esc(order.payment_method === 'multicaixa_express' ? 'Multicaixa Express' : order.payment_method === 'transferencia' ? 'Transferência' : '—') + '</td>' +
        '<td><select data-order-status="' + order.id + '">' +
          '<option value="pending_payment" ' + (order.status === 'pending_payment' ? 'selected' : '') + '>A aguardar pagamento</option>' +
          '<option value="pending_quote" ' + (order.status === 'pending_quote' ? 'selected' : '') + '>A aguardar orçamento</option>' +
          '<option value="processing" ' + (order.status === 'processing' ? 'selected' : '') + '>Em processamento</option>' +
          '<option value="completed" ' + (order.status === 'completed' ? 'selected' : '') + '>Concluído</option>' +
          '<option value="cancelled" ' + (order.status === 'cancelled' ? 'selected' : '') + '>Cancelado</option>' +
        '</select></td>' +
        '<td><select data-payment-status="' + order.id + '">' +
          '<option value="unpaid" ' + (order.payment_status === 'unpaid' ? 'selected' : '') + '>Não pago</option>' +
          '<option value="submitted" ' + (order.payment_status === 'submitted' ? 'selected' : '') + '>Comprovativo enviado</option>' +
          '<option value="confirmed" ' + (order.payment_status === 'confirmed' ? 'selected' : '') + '>Pagamento confirmado</option>' +
          '<option value="rejected" ' + (order.payment_status === 'rejected' ? 'selected' : '') + '>Pagamento rejeitado</option>' +
        '</select></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="7">Sem pedidos.</td></tr>';

    body.querySelectorAll('[data-order-status]').forEach((select) => {
      select.addEventListener('change', () => updateOrder(select.dataset.orderStatus, { status: select.value }));
    });
    body.querySelectorAll('[data-payment-status]').forEach((select) => {
      select.addEventListener('change', () => updateOrder(select.dataset.paymentStatus, { payment_status: select.value }));
    });
  }

  async function updateOrder(id, patch) {
    const result = await db().from('orders').update({
      ...patch,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    msg(result.error ? 'Não foi possível atualizar o pedido.' : 'Pedido atualizado.', result.error ? 'error' : 'success');
  }

  async function loadServices() {
    const result = await db().from('services')
      .select('id,name,category,description,unit_price,currency,is_active,sort_order')
      .order('sort_order', { ascending: true });

    if (result.error) {
      msg('Não foi possível carregar os serviços.', 'error');
      return;
    }

    const list = document.getElementById('admin-services-list');
    list.innerHTML = (result.data || []).map((service) =>
      '<article class="admin-service-editor">' +
      '<div class="field-row field-two">' +
      '<div><label>Nome</label><input data-service="' + service.id + '" data-field="name" value="' + esc(service.name) + '"></div>' +
      '<div><label>Categoria</label><input data-service="' + service.id + '" data-field="category" value="' + esc(service.category || '') + '"></div>' +
      '</div>' +
      '<div class="field-row"><label>Descrição</label><textarea data-service="' + service.id + '" data-field="description" rows="3">' + esc(service.description || '') + '</textarea></div>' +
      '<div class="field-row field-two">' +
      '<div><label>Preço (AOA)</label><input type="number" step="0.01" min="0" data-service="' + service.id + '" data-field="unit_price" value="' + (service.unit_price ?? '') + '"></div>' +
      '<div><label>Ativo no site</label><select data-service="' + service.id + '" data-field="is_active">' +
        '<option value="true" ' + (service.is_active ? 'selected' : '') + '>Sim</option>' +
        '<option value="false" ' + (!service.is_active ? 'selected' : '') + '>Não</option>' +
      '</select></div>' +
      '</div>' +
      '<button class="btn btn-primary" type="button" data-save-service="' + service.id + '">Guardar serviço</button>' +
      '</article>'
    ).join('') || '<p>Sem serviços.</p>';

    list.querySelectorAll('[data-save-service]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.dataset.saveService;
        const fields = [...list.querySelectorAll('[data-service="' + id + '"]')];
        const patch = {};
        fields.forEach((field) => {
          if (field.dataset.field === 'unit_price') patch[field.dataset.field] = field.value === '' ? null : Number(field.value);
          else if (field.dataset.field === 'is_active') patch[field.dataset.field] = field.value === 'true';
          else patch[field.dataset.field] = field.value.trim();
        });
        patch.updated_at = new Date().toISOString();
        const result = await db().from('services').update(patch).eq('id', id);
        msg(result.error ? 'Não foi possível guardar o serviço.' : 'Serviço atualizado.', result.error ? 'error' : 'success');
      });
    });
  }

  async function loadPayments() {
    const result = await db().from('payment_methods')
      .select('id,code,name,description,account_details,instructions,is_active,sort_order')
      .order('sort_order', { ascending: true });

    if (result.error) {
      msg('Não foi possível carregar métodos de pagamento.', 'error');
      return;
    }

    const list = document.getElementById('payment-methods-admin');
    list.innerHTML = (result.data || []).map((method) =>
      '<article class="admin-service-editor">' +
      '<h3>' + esc(method.name) + '</h3>' +
      '<div class="field-row"><label>Descrição</label><input data-payment="' + method.id + '" data-field="description" value="' + esc(method.description || '') + '"></div>' +
      '<div class="field-row"><label>Dados para recebimento</label><textarea data-payment="' + method.id + '" data-field="account_details" rows="3">' + esc(method.account_details || '') + '</textarea></div>' +
      '<div class="field-row"><label>Instruções ao cliente</label><textarea data-payment="' + method.id + '" data-field="instructions" rows="3">' + esc(method.instructions || '') + '</textarea></div>' +
      '<div class="field-row"><label>Disponível</label><select data-payment="' + method.id + '" data-field="is_active"><option value="true" ' + (method.is_active ? 'selected' : '') + '>Sim</option><option value="false" ' + (!method.is_active ? 'selected' : '') + '>Não</option></select></div>' +
      '<button class="btn btn-primary" type="button" data-save-payment="' + method.id + '">Guardar método</button>' +
      '</article>'
    ).join('');

    list.querySelectorAll('[data-save-payment]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.dataset.savePayment;
        const patch = {};
        list.querySelectorAll('[data-payment="' + id + '"]').forEach((field) => {
          patch[field.dataset.field] = field.dataset.field === 'is_active'
            ? field.value === 'true'
            : field.value.trim();
        });
        patch.updated_at = new Date().toISOString();
        const result = await db().from('payment_methods').update(patch).eq('id', id);
        msg(result.error ? 'Não foi possível guardar o método.' : 'Método atualizado.', result.error ? 'error' : 'success');
      });
    });
  }

  async function loadSettings() {
    const result = await db().from('site_settings').select('key,value').order('key');
    const list = document.getElementById('settings-admin');
    if (result.error) {
      msg('Não foi possível carregar definições.', 'error');
      return;
    }

    list.innerHTML = (result.data || []).map((item) =>
      '<div class="field-row"><label>' + esc(item.key) + '</label>' +
      '<input data-setting="' + esc(item.key) + '" value="' + esc(item.value || '') + '">' +
      '<button class="btn btn-secondary" type="button" data-save-setting="' + esc(item.key) + '">Guardar</button></div>'
    ).join('');

    list.querySelectorAll('[data-save-setting]').forEach((button) => {
      button.addEventListener('click', async () => {
        const key=button.dataset.saveSetting;
        const input=list.querySelector('[data-setting="' + key.replace(/"/g,'&quot;') + '"]');
        const value=input?.value ?? '';
        const result=await db().from('site_settings').upsert({ key, value, updated_at:new Date().toISOString() });
        msg(result.error ? 'Não foi possível guardar.' : 'Definição atualizada.', result.error ? 'error' : 'success');
      });
    });
  }

  async function loadContent() {
    const result = await db().from('site_content').select('id,page,section,field,value').order('page').order('section').order('field');
    const list=document.getElementById('content-admin');
    if(result.error){ msg('Não foi possível carregar conteúdos.','error'); return; }
    list.innerHTML=(result.data||[]).map(item =>
      '<article class="admin-service-editor"><div class="field-row field-two">' +
      '<div><label>Página</label><input value="' + esc(item.page) + '" data-content-id="' + item.id + '" data-field="page"></div>' +
      '<div><label>Secção</label><input value="' + esc(item.section) + '" data-content-id="' + item.id + '" data-field="section"></div></div>' +
      '<div class="field-row"><label>' + esc(item.field) + '</label><textarea data-content-id="' + item.id + '" data-field="value" rows="3">' + esc(item.value || '') + '</textarea></div>' +
      '<button class="btn btn-primary" type="button" data-save-content="' + item.id + '">Guardar conteúdo</button></article>'
    ).join('') || '<p>Sem conteúdos configurados.</p>';

    list.querySelectorAll('[data-save-content]').forEach(button=>{
      button.addEventListener('click',async()=>{
        const id=button.dataset.saveContent;
        const patch={};
        list.querySelectorAll('[data-content-id="' + id + '"]').forEach(field=>{
          patch[field.dataset.field]=field.value.trim();
        });
        patch.updated_at=new Date().toISOString();
        patch.updated_by=(await db().auth.getUser()).data.user.id;
        const result=await db().from('site_content').update(patch).eq('id',id);
        msg(result.error?'Não foi possível guardar conteúdo.':'Conteúdo atualizado.',result.error?'error':'success');
      });
    });
  }

  async function loadAdmins() {
    const result = await db().rpc('list_admins');

    const list = document.getElementById('admin-admins-list');
    if (!list) return;

    if (result.error) {
      list.innerHTML = '<p>Não foi possível carregar os administradores.</p>';
      msg('Não foi possível carregar administradores.', 'error');
      return;
    }

    list.innerHTML = (result.data || []).map((admin) => {
      const isCurrent = admin.user_id === window.currentAdminId;
      return '<article class="admin-admin-card">' +
        '<div>' +
          '<strong>' + esc(admin.full_name || 'Administrador') + '</strong>' +
          '<span>' + esc(admin.email || '') + '</span>' +
          '<small>Administrador desde ' + new Date(admin.created_at).toLocaleDateString('pt-PT') + '</small>' +
        '</div>' +
        '<button class="btn btn-secondary" type="button" data-remove-admin="' + admin.user_id + '" ' + (isCurrent ? 'disabled' : '') + '>' +
          (isCurrent ? 'Administrador atual' : 'Remover acesso') +
        '</button>' +
      '</article>';
    }).join('') || '<p>Não existem administradores configurados.</p>';

    list.querySelectorAll('[data-remove-admin]:not([disabled])').forEach((button) => {
      button.addEventListener('click', async () => {
        const adminCard = button.closest('.admin-admin-card');
        const email = adminCard?.querySelector('span')?.textContent?.trim();
        if (!email) return;

        const confirmed = window.confirm('Remover o acesso de administrador de ' + email + '?');
        if (!confirmed) return;

        button.disabled = true;
        const result = await db().rpc('set_admin_role_by_email', {
          p_email: email,
          p_make_admin: false
        });

        if (result.error) {
          msg('Não foi possível remover o acesso de administrador.', 'error');
          button.disabled = false;
          return;
        }

        msg('Acesso de administrador removido.', 'success');
        await Promise.all([loadAdmins(), loadClients()]);
      });
    });
  }

  async function addAdmin() {
    const input = document.getElementById('new-admin-email');
    const email = input?.value?.trim().toLowerCase();
    if (!email) {
      msg('Introduza o email do utilizador que pretende tornar administrador.', 'error');
      input?.focus();
      return;
    }

    const button = document.getElementById('add-admin-btn');
    if (button) button.disabled = true;

    const result = await db().rpc('set_admin_role_by_email', {
      p_email: email,
      p_make_admin: true
    });

    if (result.error) {
      const raw = result.error.message || '';
      const userNotFound = raw.includes('USER_NOT_FOUND');
      msg(
        userNotFound
          ? 'Este email ainda não tem uma conta registada. Primeiro peça ao utilizador para criar a conta no site.'
          : 'Não foi possível adicionar este administrador.',
        'error'
      );
      if (button) button.disabled = false;
      return;
    }

    input.value = '';
    msg('Administrador adicionado com sucesso.', 'success');
    if (button) button.disabled = false;
    await Promise.all([loadAdmins(), loadClients()]);
  }

  async function init() {
    if (!db()) return;
    const admin = await requireAdmin();
    if (!admin) return;

    const profile = await db().from('profiles').select('full_name').eq('id', admin.user.id).maybeSingle();
    document.getElementById('admin-name').textContent = profile.data?.full_name || 'Administrador';

    await Promise.all([loadOverview(),loadClients(),loadOrders(),loadServices(),loadPayments(),loadSettings(),loadContent(),loadAdmins()]);

    document.querySelectorAll('.admin-tab').forEach((tab)=>{
      tab.addEventListener('click',()=>{
        document.querySelectorAll('.admin-section').forEach((section)=>section.classList.toggle('is-visible',section.dataset.adminPanel===tab.dataset.adminSection));
        document.querySelectorAll('.admin-tab').forEach((item)=>item.classList.toggle('is-active',item===tab));
      });
    });

    document.querySelector('[data-logout]')?.addEventListener('click', async()=>{
      await db().auth.signOut();
      window.location.href='auth.html';
    });
  }

  document.addEventListener('DOMContentLoaded',init);
})();
