(() => {
  const client = () => window.supabaseClient;
  let allPayments = [];
  let section = null;

  const labels = {
    pending: 'Pendente',
    processing: 'Processando',
    awaiting_confirmation: 'Em validação',
    paid: 'Pago',
    rejected: 'Rejeitado',
    cancelled: 'Cancelado'
  };

  function money(value, currency) {
    return String(currency || 'AOA') + ' ' + Number(value || 0).toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function statusClass(status) {
    return 'payment-admin-pill payment-admin-' + String(status || 'pending').replace(/[^a-z_]/g, '');
  }

  async function openProof(path) {
    if (!path) return;

    try {
      const result = await client().storage.from('payment-proofs').createSignedUrl(path, 600);

      if (result.error || !result.data?.signedUrl) {
        console.error('createSignedUrl:', result.error);
        alert(
          'Não foi possível abrir o comprovativo.\n\n' +
          (result.error?.message || 'O ficheiro não está acessível para esta sessão de administrador.')
        );
        return;
      }

      window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('openProof:', error);
      alert('Erro ao abrir o comprovativo.\n\n' + (error?.message || error));
    }
  }

  function render() {
    if (!section) return;
    const query = (section.querySelector('#admin-payment-search')?.value || '').toLowerCase().trim();
    const status = section.querySelector('#admin-payment-status-filter')?.value || '';

    const rows = allPayments.filter((item) => {
      const haystack = [
        item.order?.order_number,
        item.order?.customer_name,
        item.payment_method,
        item.provider_transaction_id,
        item.reference,
        item.customer_mobile
      ].filter(Boolean).join(' ').toLowerCase();

      return (!query || haystack.includes(query)) && (!status || item.status === status);
    });

    const body = section.querySelector('#admin-payment-list');
    if (!body) return;

    if (!rows.length) {
      body.innerHTML = '<div class="payment-admin-empty">Nenhum pagamento encontrado com estes filtros.</div>';
      return;
    }

    body.innerHTML = rows.map((item) => {
      const date = new Date(item.created_at).toLocaleString('pt-PT');
      const proof = item.proof_path
        ? '<button type="button" class="link-button" data-proof="' + item.proof_path + '">Abrir comprovativo</button>'
        : '<span class="admin-muted">—</span>';

      return '<article class="payment-admin-row">' +
        '<div class="payment-admin-main">' +
          '<div><span class="payment-admin-order">' + (item.order?.order_number || 'Pedido') + '</span><strong>' + (item.order?.customer_name || 'Cliente') + '</strong><small>' + date + '</small></div>' +
          '<div><span class="payment-admin-method">' + (item.provider || '—') + '</span><small>' + money(item.amount, 'AOA') + '</small></div>' +
          '<div><span class="' + statusClass(item.status) + '">' + (labels[item.status] || item.status) + '</span><small>' + (item.transaction_reference || 'Sem referência') + '</small></div>' +
        '</div>' +
        '<div class="payment-admin-actions">' +
          proof +
          '<button type="button" class="btn btn-secondary btn-small" data-payment-status="paid" data-payment-id="' + item.id + '">Confirmar</button>' +
          '<button type="button" class="btn btn-danger btn-small" data-payment-status="rejected" data-payment-id="' + item.id + '">Rejeitar</button>' +
        '</div>' +
      '</article>';
    }).join('');

    body.querySelectorAll('[data-proof]').forEach((button) => {
      button.addEventListener('click', () => openProof(button.dataset.proof));
    });

    body.querySelectorAll('[data-payment-status]').forEach((button) => {
      button.addEventListener('click', () => setPaymentStatus(button.dataset.paymentId, button.dataset.paymentStatus));
    });
  }

  async function setPaymentStatus(id, status) {
    const button = section?.querySelector('[data-payment-id="' + id + '"][data-payment-status="' + status + '"]');
    if (button) button.disabled = true;

    const note = status === 'rejected'
      ? window.prompt('Motivo da rejeição (opcional):') || null
      : null;

    try {
      const result = await client().rpc('admin_set_payment_status', {
        p_payment_id: id,
        p_status: status,
        p_note: note
      });

      if (result.error) {
        console.error('admin_set_payment_status:', result.error);
        const detail = result.error.message || result.error.details || result.error.hint || 'Erro desconhecido.';
        alert('Não foi possível atualizar o pagamento.\n\n' + detail);
        return;
      }

      alert(status === 'paid'
        ? 'Pagamento confirmado com sucesso.'
        : status === 'rejected'
          ? 'Pagamento rejeitado.'
          : 'Estado do pagamento atualizado.');

      await load();
    } catch (error) {
      console.error('admin_set_payment_status exception:', error);
      alert('Erro ao atualizar o pagamento.\n\n' + (error?.message || error));
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function load() {
    if (!section) return;

    const result = await client().from('payments')
      .select('id,order_id,user_id,provider,amount,status,proof_path,customer_note,transaction_reference,created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (result.error) {
      console.error(result.error);
      section.querySelector('#admin-payment-list').innerHTML = '<div class="payment-admin-empty">Não foi possível carregar os pagamentos.</div>';
      return;
    }

    const payments = result.data || [];
    const orderIds = [...new Set(payments.map((item) => item.order_id))];
    const customerIds = [...new Set(payments.map((item) => item.customer_id))];

    let orders = [];
    let profiles = [];

    if (orderIds.length) {
      const orderResult = await client().from('orders').select('id,order_number').in('id', orderIds);
      orders = orderResult.data || [];
    }
    if (customerIds.length) {
      const profileResult = await client().from('profiles').select('id,full_name').in('id', customerIds);
      profiles = profileResult.data || [];
    }

    const orderMap = Object.fromEntries(orders.map((item) => [item.id, item]));
    const profileMap = Object.fromEntries(profiles.map((item) => [item.id, item]));

    allPayments = payments.map((item) => ({
      ...item,
      order: {
        order_number: orderMap[item.order_id]?.order_number,
        customer_name: profileMap[item.user_id]?.full_name
      }
    }));

    render();
  }

  function mount() {
    const paymentMethods = document.getElementById('payment-methods-admin');
    if (!paymentMethods) return;

    const card = document.createElement('div');
    card.className = 'panel-card admin-payment-center';
    card.innerHTML = '<div class="section-header-row"><div><h3>Transferências bancárias</h3><p class="admin-section-note">Acompanhe as transferências dos clientes e valide os comprovativos.</p></div><div class="admin-toolbar"><input id="admin-payment-search" class="admin-filter-input" type="search" placeholder="Pedido, cliente, referência..."><select id="admin-payment-status-filter" class="admin-filter-select"><option value="">Todos os estados</option><option value="pending">Pendente</option><option value="processing">Processando</option><option value="awaiting_confirmation">Em validação</option><option value="paid">Pago</option><option value="rejected">Rejeitado</option></select></div></div><div id="admin-payment-list" class="payment-admin-list"></div>';

    paymentMethods.parentElement?.appendChild(card);
    section = card;

    section.addEventListener('input', render);
    section.addEventListener('change', render);
    load();

    client().channel('admin-payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, load)
      .subscribe();
  }

  document.addEventListener('DOMContentLoaded', mount);
})();