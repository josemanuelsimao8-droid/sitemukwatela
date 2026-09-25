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
    const service = order.order_items?.[0]?.service_name || 'Serviço';
    const item = document.createElement('span');
    item.innerHTML = '<small>Serviço</small><strong>' + service + '</strong>';
    const method = document.createElement('span');
    method.innerHTML = '<small>Pagamento</small><strong>' + (paymentMethod?.name || order.payment_method || '—') + '</strong>';
    details.append(item, method);
    node.appendChild(details);
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

    if (!paymentMethod) return;

    const shell = document.createElement('div');
    shell.className = 'payment-method-card';

    const header = document.createElement('div');
    header.className = 'payment-method-card-header';
    const heading = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Método selecionado';
    const h2 = document.createElement('h2');
    h2.textContent = paymentMethod.name;
    heading.append(eyebrow, h2);
    const amount = document.createElement('strong');
    amount.className = 'payment-method-card-amount';
    amount.textContent = money(order.total, order.currency);
    header.append(heading, amount);
    shell.appendChild(header);

    if (paymentMethod.code === 'multicaixa_express') {
      const info = document.createElement('div');
      info.className = 'payment-provider-panel';

      const text = document.createElement('p');
      text.textContent = 'Introduza o número associado ao seu Multicaixa Express. A plataforma enviará o pedido e, depois, terá de confirmar a operação na aplicação.';
      info.appendChild(text);

      const label = document.createElement('label');
      label.textContent = 'Número Multicaixa Express';
      const input = document.createElement('input');
      input.id = 'mcx-mobile';
      input.type = 'tel';
      input.inputMode = 'numeric';
      input.autocomplete = 'tel';
      input.placeholder = '9XXXXXXXX';
      input.maxLength = 12;
      label.appendChild(input);
      info.appendChild(label);

      if (payment?.customer_mobile) input.value = payment.customer_mobile;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary btn-block';
      button.textContent = payment?.status === 'processing' ? 'PAGAMENTO JÁ ENVIADO' : 'PAGAR COM MULTICAIXA EXPRESS';
      button.disabled = payment?.status === 'processing';
      button.addEventListener('click', () => initiateMulticaixa(input.value, button));

      const note = document.createElement('div');
      note.className = 'payment-provider-note';
      note.innerHTML = '<strong>Como funciona</strong><p>1. A Mukwatela envia a cobrança. 2. O pedido aparece na sua app Multicaixa Express. 3. Confirme a operação na app. 4. O estado do pedido será atualizado automaticamente.</p>';

      info.append(button, note);
      shell.appendChild(info);

    } else {
      const info = document.createElement('div');
      info.className = 'payment-provider-panel';

      const account = document.createElement('div');
      account.className = 'payment-bank-details';
      const accountTitle = document.createElement('h3');
      accountTitle.textContent = 'Dados para transferência';
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
      refLabel.textContent = 'Referência / comprovativo';
      const ref = document.createElement('input');
      ref.id = 'bank-reference';
      ref.type = 'text';
      ref.placeholder = 'Ex.: número da operação';
      refLabel.appendChild(ref);

      const fileLabel = document.createElement('label');
      fileLabel.textContent = 'Comprovativo (PDF, JPG ou PNG)';
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
      note.placeholder = 'Ex.: transferência feita pelo titular João...';
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
    }

    root.appendChild(shell);
  }

  async function initiateMulticaixa(rawMobile, button) {
    const mobile = String(rawMobile || '').replace(/\D/g, '');
    if (mobile.startsWith('244') && mobile.length === 12) {
      rawMobile = mobile.slice(3);
    } else {
      rawMobile = mobile;
    }

    if (!/^9\d{8}$/.test(rawMobile)) {
      showMessage('Introduza um número Multicaixa Express válido com 9 dígitos.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'A ENVIAR...';

    const response = await fetch(
      'https://jbnwatatstxudepllacg.supabase.co/functions/v1/payment-initiate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },
        body: JSON.stringify({ order_id: order.id, mobile: rawMobile })
      }
    );

    let data = null;
    try { data = await response.json(); } catch {}

    if (!response.ok) {
      console.error(data);
      const errorText = data?.error === 'PAYMENT_GATEWAY_NOT_CONFIGURED'
        ? 'O pagamento Multicaixa Express ainda não foi ativado para esta conta.'
        : (data?.message || 'Não foi possível iniciar o pagamento.');
      showMessage(errorText, 'error');
      button.disabled = false;
      button.textContent = 'PAGAR COM MULTICAIXA EXPRESS';
      return;
    }

    showMessage(data?.message || 'Pedido de pagamento enviado. Confirme na aplicação Multicaixa Express.', 'success');
    payment = await loadPayment();
    renderMethodPanel();
    subscribeRealtime();
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

    const result = await client().rpc('submit_bank_payment_proof', {
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
      .eq('customer_id', session.user.id)
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

  async function loadMethod() {
    const result = await client().from('payment_methods')
      .select('id,code,name,description,account_details,instructions,is_active')
      .eq('code', order.payment_method)
      .eq('is_active', true)
      .maybeSingle();

    if (result.error) throw result.error;
    return result.data;
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

        paymentMethod = await loadMethod();
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