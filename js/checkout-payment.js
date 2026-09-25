(() => {
  const client = () => window.supabaseClient;

  function message(text, type = 'info') {
    const node = document.getElementById('shop-message');
    if (!node) return;
    node.textContent = text;
    node.dataset.type = type;
    node.hidden = false;
  }

  async function getSession() {
    const result = await client().auth.getSession();
    if (result.error) console.error(result.error);
    return result.data?.session || null;
  }

  function selectedPaymentMethod(form) {
    return form.querySelector('input[name="paymentMethod"]:checked')?.value || null;
  }

  async function loadService(id) {
    const result = await client().from('services')
      .select('id,name,unit_price,currency,is_active,item_type,unit_label,stock_quantity')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function submitOrder(form) {
    const session = await getSession();
    if (!session) {
      window.location.href = 'auth.html';
      return;
    }

    const selectedId = sessionStorage.getItem('mukwatela-selected-service-id');
    if (!selectedId) {
      message('Selecione um serviço antes de continuar.', 'error');
      return;
    }

    const service = await loadService(selectedId);
    if (!service) {
      message('O item selecionado já não está disponível.', 'error');
      return;
    }

    const itemTypeNode = document.getElementById('checkout-item-type');
    if (itemTypeNode) {
      itemTypeNode.textContent = service.item_type === 'material'
        ? 'Material para compra · indique a quantidade e a forma de entrega.'
        : 'Serviço personalizado · preencha os detalhes necessários para execução.';
    }
    const initialPaymentStage = form.querySelector('.checkout-payment-stage');
    if (initialPaymentStage) initialPaymentStage.hidden = service.unit_price === null;
    const initialSubmit = form.querySelector('button[type="submit"]');
    if (initialSubmit) initialSubmit.textContent = service.unit_price === null ? 'ENVIAR PARA ORÇAMENTO' : 'CONTINUAR PARA PAGAMENTO';

    const quantity = Math.max(1, Number(document.getElementById('service-quantity')?.value || 1));
    if (service.item_type === 'material' && service.stock_quantity !== null && quantity > Number(service.stock_quantity)) {
      message('A quantidade solicitada ultrapassa o stock disponível (' + service.stock_quantity + ' ' + (service.unit_label || 'unidade') + ').', 'error');
      return;
    }

    const paymentMethod = service.unit_price === null ? null : selectedPaymentMethod(form);
    if (service.unit_price !== null && !paymentMethod) {
      message('Selecione uma forma de pagamento.', 'error');
      return;
    }
    const specifications = {
      format: document.getElementById('service-format')?.value || '',
      material: document.getElementById('service-material')?.value.trim() || '',
      dimensions: document.getElementById('service-dimensions')?.value.trim() || '',
      deadline: document.getElementById('service-deadline')?.value.trim() || ''
    };
    const notes = document.getElementById('service-observations')?.value.trim() || null;
    const deliveryMethod = document.getElementById('delivery-method')?.value || 'pickup';
    const deliveryContact = document.getElementById('delivery-contact')?.value.trim() || null;
    const deliveryAddress = document.getElementById('delivery-address')?.value.trim() || null;

    if (deliveryMethod === 'delivery' && !deliveryAddress) {
      message('Introduza a morada de entrega ou escolha levantamento na Mukwatela.', 'error');
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    const paymentStage = form.querySelector('.checkout-payment-stage');
    if (paymentStage) paymentStage.hidden = service.unit_price === null;

    submit.disabled = true;
    submit.textContent = 'A criar pedido...';

    const result = await client().rpc('create_service_order', {
      p_service_id: service.id,
      p_quantity: quantity,
      p_notes: notes,
      p_specifications: specifications,
      p_payment_method: paymentMethod,
      p_delivery_method: deliveryMethod,
      p_delivery_address: deliveryAddress,
      p_delivery_contact: deliveryContact
    });

    if (result.error) {
      console.error(result.error);
      const code = String(result.error.code || '');
      const detail = String(result.error.message || '');
      if (detail.includes('INSUFFICIENT_STOCK') || detail.includes('Insufficient stock')) {
        message('O stock disponível não é suficiente para esta quantidade.', 'error');
      } else if (detail.includes('PAYMENT_METHOD_NOT_AVAILABLE') || code === 'PGRST202') {
        message('Este método de pagamento não está disponível de momento.', 'error');
      } else {
        message('Não foi possível criar o pedido. Tente novamente.', 'error');
      }
      submit.disabled = false;
      submit.textContent = 'CONTINUAR PARA PAGAMENTO';
      return;
    }

    const orderId = result.data?.id;
    sessionStorage.setItem('mukwatela-last-order-id', orderId || '');
    sessionStorage.removeItem('mukwatela-selected-service-id');
    sessionStorage.removeItem('mukwatela-selected-service');

    window.location.href = service.unit_price === null
      ? 'orcamentos.html'
      : 'pagamento.html?order=' + encodeURIComponent(orderId);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('checkout-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await submitOrder(form);
      } catch (error) {
        console.error(error);
        message('Ocorreu um erro ao processar o pedido. Tente novamente.', 'error');
        const submit = form.querySelector('button[type="submit"]');
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'CONTINUAR PARA PAGAMENTO';
        }
      }
    }, true);
  });
})();