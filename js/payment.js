(() => {
  const client = () => window.supabaseClient;
  let session = null;
  let order = null;
  let payment = null;
  let paymentMethod = null;
  let channel = null;

  const statusMeta = {
    pending: ['A preparar', 'payment-status-pending'],
    processing: ['Pedido enviado', 'payment-status-processing'],
    awaiting_confirmation: ['Em validação', 'payment-status-awaiting'],
    paid: ['Pago', 'payment-status-paid'],
    rejected: ['Rejeitado', 'payment-status-rejected'],
    cancelled: ['Cancelado', 'payment-status-rejected']
  };

  function money(value, currency) {
    return String(currency || 'AOA') + ' ' +
      Number(value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function showMessage(text, type = 'info') {
    const node = document.getElementById('payment-message');
    if (!node) return;
    node.textContent = text;
    node.dataset.type = type;
    node.hidden = false;
  }

  function setStatus(status) {
    const [label, className] = statusMeta[status] || ['A preparar', 'payment-status-pending'];
    const badge = document.getElementById('payment-status-badge');
    const copy = document.getElementById('payment-status-copy');
    if (badge) {
      badge.textContent = label;
      badge.className = 'payment-status-badge ' + className;
    }
    if (copy) {
      copy.textContent = status === 'paid'
        ? 'Pagamento confirmado. O seu pedido pode seguir para processamento.'
        : status === 'rejected'
          ? 'O pagamento não foi aceite. Verifique os dados e tente novamente.'
          : 'Acompanhe aqui o estado da sua operação.';
    }

    const paymentTimeline = document.getElementById('timeline-payment');
    const productionTimeline = document.getElementById('timeline-production');
    if (paymentTimeline) {
      paymentTimeline.classList.toggle('is-active', !['paid'].includes(status));
      paymentTimeline.classList.toggle('is-done', status === 'paid');
      if (status === 'paid') paymentTimeline.querySelector('span').textContent = '✓';
    }
    if (productionTimeline) productionTimeline.classList.toggle('is-active', status === 'paid');
  }

  function renderSummary() {
    const node = document.getElementById('payment-order-summary');
    if (!node || !order) return;
    node.innerHTML = '';

    const top = document.createElement('div');
    top.className = 'payment-summary-top';
    const left = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'eyebrow';
    title.textContent = 'Pedido';
    const num = document.createElement('strong');
    num.textContent = order.order_number;
    left.append(title, num);

    const amount = document.createElement('div');
    amount.className = 'payment-summary-amount';
    amount.innerHTML = '<span>Total</span><strong>' +
      (order.total === null ? 'Sob orçamento' : money(order.total, order.currency)) +
      '</strong>';

    top.append(left, amount);
    node.appendChild(top);

    const details = document.createElement('div');
    details.className = 'payment-summary-details';
    const items = order.order_items || [];
    const item = document.createElement('span');
    const names = items.map((entry) => entry.service_name).filter(Boolean);
    item.innerHTML = '<small>Itens</small><strong>' + names.length + ' · ' + names.join(', ') + '</strong>';
    const method = document.createElement('span');
    method.innerHTML = '<small>Pagamento</small><strong>' + (paymentMethod?.name || order.payment_method || '—') + '</strong>';
    details.append(item, method);
    node.appendChild(details);

    if (Number(order.delivery_fee || 0) > 0) {
      const delivery = document.createElement('span');
      delivery.innerHTML = '<small>Entrega</small><strong>' + money(order.delivery_fee, order.currency) + '</strong>';
      details.appendChild(delivery);
    }
  }

  function renderMethodPanel() {
    const root = document.getElementById('payment-method-panel');
    if (!root || !order) return;
    root.innerHTML = '';

    if (order.total === null || Number(order.total) <= 0) {
      const box = document.createElement('div');
      box.className = 'payment-unavailable-card';
      box.innerHTML = '<span class="eyebrow">Orçamento</span><h3>Pagamento indisponível neste momento</h3><p>Este serviço ainda está dependente de orçamento. Assim que a Mukwatela definir o valor do pedido, a opção de pagamento ficará disponível na sua área.</p><a class="btn btn-secondary" href="compras.html">Ver pedido</a>';
      root.appendChild(box);
      return;
    }

    if (!paymentMethod) {
      const box = document.createElement('div');
      box.className = 'payment-unavailable-card';
      box.innerHTML = '<span class="eyebrow">Pagamento</span><h3>Método indisponível</h3><p>O método de pagamento deste pedido já não está disponível. Contacte a Mukwatela para obter orientação.</p><a class="btn btn-secondary" href="contactos.html">Contactar a Mukwatela</a>';
      root.appendChild(box);
      return;
    }

    const shell = document.createElement('div');
    shell.className = 'payment-method-card';

    const header = document.createElement('div');
    header.className = 'payment-method-card-header';
    const heading = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Método selecionado';
    const h2 = document.createElement('h2');
    h2.textContent = paymentMethod.name || 'Pagamento';
    heading.append(eyebrow, h2);

    const amount = document.createElement('strong');
    amount.className = 'payment-method-card-amount';
    amount.textContent = money(order.total, order.currency);
    header.append(heading, amount);
    shell.appendChild(header);

    const info = document.createElement('div');
    info.className = 'payment-provider-panel';

    const intro = document.createElement('p');
    intro.textContent = 'Efetue o pagamento usando o método selecionado, siga os dados e instruções apresentados e, depois, envie o comprovativo nesta página para validação.';
    info.appendChild(intro);

    const account = document.createElement('div');
    account.className = 'payment-bank-details';

    const accountTitle = document.createElement('h3');
    accountTitle.textContent = 'Dados para pagamento';
    account.appendChild(accountTitle);

    if (paymentMethod.account_details) {
      const accountText = document.createElement('p');
      accountText.textContent = paymentMethod.account_details;
      account.appendChild(accountText);
    }

    if (paymentMethod.instructions) {
      const instructions = document.createElement('div');
      instructions.className = 'payment-bank-instructions';
      instructions.textContent = paymentMethod.instructions;
      account.appendChild(instructions);
    }

    info.appendChild(account);

    const form = document.createElement('div');
    form.className = 'payment-proof-form';

    const refLabel = document.createElement('label');
    refLabel.textContent = 'Referência do pagamento';
    const ref = document.createElement('input');
    ref.id = 'bank-reference';
    ref.type = 'text';
    ref.placeholder = 'Número da operação ou referência';
    ref.value = payment?.transaction_reference || '';
    refLabel.appendChild(ref);

    const fileLabel = document.createElement('label');
    fileLabel.textContent = 'Comprovativo do pagamento (PDF, JPG ou PNG)';
    const file = document.createElement('input');
    file.id = 'bank-proof';
    file.type = 'file';
    file.accept = 'application/pdf,image/jpeg,image/png';
    fileLabel.appendChild(file);

    const noteLabel = document.createElement('label');
    noteLabel.textContent = 'Observação';
    const note = document.createElement('textarea');
    note.id = 'bank-note';
    note.rows = 3;
    note.placeholder = 'Observação adicional (opcional)';
    note.value = payment?.customer_note || '';
    noteLabel.appendChild(note);

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn btn-primary btn-block';
    submit.textContent = payment?.status === 'awaiting_confirmation' ? 'COMPROVATIVO ENVIADO' : 'ENVIAR COMPROVATIVO';
    submit.disabled = payment?.status === 'awaiting_confirmation';
    submit.addEventListener('click', () => submitBankProof(file, ref, note, submit));

    form.append(refLabel, fileLabel, noteLabel, submit);
    info.appendChild(form);

    shell.appendChild(info);
    root.appendChild(shell);
  }

  async function submitBankProof(fileInput, refInput, noteInput, button) {
    const file = fileInput.files?.[0];
    if (!file) {
      showMessage('Selecione o comprovativo do pagamento.', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showMessage('O comprovativo não pode ultrapassar 8 MB.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'A ENVIAR...';

    const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
    const path = session.user.id + '/' + payment.id + '-' + Date.now() + '.' + extension;

    const upload = await client().storage.from('payment-proofs').upload(path, file, {
      contentType: file.type,
      upsert: false
    });

    if (upload.error) {
      console.error(upload.error);
      showMessage('Não foi possível enviar o comprovativo.', 'error');
      button.disabled = false;
      button.textContent = 'ENVIAR COMPROVATIVO';
      return;
    }

    const result = await client().rpc('submit_payment_proof', {
      p_payment_id: payment.id,
      p_proof_path: path,
      p_reference: refInput.value.trim() || null,
      p_note: noteInput.value.trim() || null
    });

    if (result.error) {
      console.error(result.error);
      await client().storage.from('payment-proofs').remove([path]);
      showMessage('O comprovativo foi enviado mas não pôde ser associado ao pagamento. Tente novamente.', 'error');
      button.disabled = false;
      button.textContent = 'ENVIAR COMPROVATIVO';
      return;
    }

    payment = result.data;
    setStatus(payment.status);
    showMessage('Comprovativo enviado. A Mukwatela irá validar o pagamento.', 'success');
    button.textContent = 'COMPROVATIVO ENVIADO';
    subscribeRealtime();
  }

  async function loadOrder(orderId) {
    const result = await client().from('orders')
      .select('id,order_number,status,total,currency,payment_method,payment_status,created_at,updated_at,order_items(service_name,quantity,unit_price)')
      .eq('id', orderId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (result.error) throw result.error;
    return result.data;
  }

  async function loadPayment() {
    const result = await client().from('payments')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) throw result.error;
    return result.data;
  }

  async function loadMethods() {
    const result = await client().from('payment_methods')
      .select('id,code,name,description,account_details,instructions,is_active,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function choosePaymentMethod(code) {
    const result = await client().rpc('customer_set_payment_method', {
      p_order_id: order.id,
      p_payment_method: code
    });
    if (result.error) throw result.error;
    payment = result.data;
    order.payment_method = code;
    paymentMethod = (await loadMethods()).find(x => x.code === code) || null;
    renderSummary();
    renderMethodPanel();
    setStatus(payment.status);
    subscribeRealtime();
  }

  function renderMethodChooser(methods) {
    const root = document.getElementById('payment-method-panel');
    if (!root) return;
    root.innerHTML = '';
    const shell = document.createElement('div');
    shell.className = 'payment-method-card';
    const title = document.createElement('h2');
    title.textContent = 'Escolha a forma de pagamento';
    const copy = document.createElement('p');
    copy.textContent = 'Selecione um método disponível para ver os dados de pagamento e enviar o comprovativo.';
    shell.append(title, copy);
    const list = document.createElement('div');
    list.className = 'payment-method-list';
    methods.forEach((method, index) => {
      const label = document.createElement('label');
      label.className = 'payment-method-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'payment-method-after-quote';
      input.value = method.code;
      input.checked = index === 0;
      const span = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = method.name;
      const small = document.createElement('small');
      small.textContent = method.description || '';
      span.append(strong, small);
      label.append(input, span);
      input.addEventListener('change', async () => {
        try {
          await choosePaymentMethod(input.value);
          showMessage('Método de pagamento selecionado.', 'success');
        } catch (error) {
          console.error(error);
          showMessage('Não foi possível selecionar este método de pagamento.', 'error');
        }
      });
      list.appendChild(label);
    });
    shell.appendChild(list);
    root.appendChild(shell);
  }

  function subscribeRealtime() {
    if (!order?.id || !payment?.id) return;
    if (channel) client().removeChannel(channel);

    channel = client()
      .channel('payment-status-' + payment.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments',
        filter: 'id=eq.' + payment.id
      }, (payload) => {
        payment = payload.new;
        setStatus(payment.status);
        renderMethodPanel();
        if (payment.status === 'paid') {
          showMessage('Pagamento confirmado com sucesso.', 'success');
        }
      })
      .subscribe();
  }

  async function init() {
    session = (await client().auth.getSession()).data?.session || null;
    if (!session) {
      window.location.href = 'auth.html';
      return;
    }

    const fromUrl = new URLSearchParams(window.location.search).get('order');
    const orderId = fromUrl || sessionStorage.getItem('mukwatela-last-order-id');
    if (!orderId) {
      showMessage('Nenhum pedido selecionado para pagamento.', 'error');
      return;
    }

    try {
      order = await loadOrder(orderId);
      if (!order) {
        showMessage('Pedido não encontrado.', 'error');
        return;
      }

      if (order.status === 'cancelled') {
        renderSummary();
        setStatus('cancelled');
        const root = document.getElementById('payment-method-panel');
        if (root) root.innerHTML = '<div class="payment-unavailable-card"><span class="eyebrow">Pedido cancelado</span><h3>Pagamento indisponível</h3><p>Este pedido foi cancelado e já não pode receber comprovativo de pagamento.</p><a class="btn btn-secondary" href="compras.html">Voltar aos pedidos</a></div>';
        return;
      }

      renderSummary();
      setStatus(order.payment_status === 'confirmed' ? 'paid' : 'pending');

      if (order.total !== null && Number(order.total) > 0) {
        payment = await loadPayment();
        if (!payment) {
          const result = await client().rpc('ensure_payment_intent', { p_order_id: order.id });
          if (result.error) {
            console.error(result.error);
            if (result.error.message?.includes('PAYMENT_NOT_AVAILABLE')) {
              renderMethodPanel();
              return;
            }
            throw result.error;
          }
          payment = result.data;
        }

        if (order.payment_method) {
          paymentMethod = (await loadMethods()).find(x => x.code === order.payment_method) || null;
        } else {
          const methods = await loadMethods();
          if (!methods.length) {
            renderMethodPanel();
            return;
          }
          renderMethodChooser(methods);
          return;
        }
        renderSummary();
        renderMethodPanel();
        setStatus(payment.status);
        subscribeRealtime();
      } else {
        renderMethodPanel();
      }
    } catch (error) {
      console.error(error);
      showMessage('Não foi possível carregar o pagamento deste pedido.', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();