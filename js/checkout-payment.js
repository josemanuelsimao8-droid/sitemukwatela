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
      .select('id,name,unit_price,currency,is_active')
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
      message('O serviço selecionado já não está disponível.', 'error');
      return;
    }

    const paymentMethod = selectedPaymentMethod(form);
    if (!paymentMethod) {
      message('Selecione uma forma de pagamento.', 'error');
      return;
    }

    const quantity = Math.max(1, Number(document.getElementById('service-quantity')?.value || 1));
    const specifications = {
      format: document.getElementById('service-format')?.value || '',
      material: document.getElementById('service-material')?.value.trim() || '',
      dimensions: document.getElementById('service-dimensions')?.value.trim() || '',
      deadline: document.getElementById('service-deadline')?.value.trim() || ''
    };
    const notes = document.getElementById('service-observations')?.value.trim() || null;
    const submit = form.querySelector('button[type="submit"]');

    submit.disabled = true;
    submit.textContent = 'A criar pedido...';

    const result = await client().rpc('create_service_order', {
      p_service_id: service.id,
      p_quantity: quantity,
      p_notes: notes,
      p_specifications: specifications,
      p_payment_method: paymentMethod
    });

    if (result.error) {
      console.error(result.error);
      message('Não foi possível criar o pedido. Tente novamente.', 'error');
      submit.disabled = false;
      submit.textContent = 'CONTINUAR PARA PAGAMENTO';
      return;
    }

    const orderId = result.data?.id;
    sessionStorage.setItem('mukwatela-last-order-id', orderId || '');
    sessionStorage.removeItem('mukwatela-selected-service-id');
    sessionStorage.removeItem('mukwatela-selected-service');

    window.location.href = 'pagamento.html?order=' + encodeURIComponent(orderId);
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