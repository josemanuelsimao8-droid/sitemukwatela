(() => {
  const cart = () => window.MukwatelaCart;
  const db = () => window.supabaseClient;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = (v, c = 'AOA') => c + ' ' + Number(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function toast(text) {
    const n = document.getElementById('cart-toast');
    if (!n) return;
    n.textContent = text;
    n.hidden = false;
    clearTimeout(window.__cartToast);
    window.__cartToast = setTimeout(() => { n.hidden = true; }, 2200);
  }

  function bind() {
    document.querySelectorAll('[data-cart-qty]').forEach((n) => n.addEventListener('change', () => {
      const i = Number(n.dataset.cartQty);
      const item = cart().getItems()[i];
      let q = Math.max(1, Math.trunc(Number(n.value) || 1));
      if (item?.stock_quantity != null) q = Math.min(q, Number(item.stock_quantity));
      cart().update(i, q);
    }));
    document.querySelectorAll('[data-cart-remove]').forEach((n) => n.addEventListener('click', () => {
      cart().remove(Number(n.dataset.cartRemove));
      toast('Item removido do carrinho.');
      render(cart().getItems());
    }));
  }

  function render(items) {
    const list = document.getElementById('cart-list');
    const lines = document.getElementById('cart-summary-lines');
    const total = document.getElementById('cart-total');
    const checkout = document.getElementById('cart-checkout');
    if (!list) return;

    if (!items.length) {
      list.innerHTML = '<div class="cart-empty"><h2>O carrinho está vazio.</h2><p>Adicione serviços ou materiais do catálogo para começar.</p><a class="btn btn-primary" href="services.html">Ver serviços</a></div>';
      if (lines) lines.innerHTML = '<div><span>Itens</span><strong>0</strong></div>';
      if (total) total.textContent = 'AOA 0,00';
      if (checkout) { checkout.classList.add('is-disabled'); checkout.setAttribute('aria-disabled', 'true'); }
      return;
    }

    if (checkout) { checkout.classList.remove('is-disabled'); checkout.removeAttribute('aria-disabled'); }

    list.innerHTML = items.map((item, i) => {
      const max = item.stock_quantity == null ? '' : ' max="' + Number(item.stock_quantity) + '"';
      const line = item.unit_price == null ? 'Sob orçamento' : money(Number(item.unit_price) * Number(item.quantity), item.currency);
      const specs = item.specifications && Object.keys(item.specifications).length
        ? Object.entries(item.specifications).filter(([, v]) => v).map(([k, v]) => '<span>' + esc(k) + ': ' + esc(v) + '</span>').join('')
        : '';
      return '<article class="cart-item"><div class="cart-item-media">' + (item.image_url ? '<img src="' + encodeURI(item.image_url) + '" alt="' + esc(item.name) + '">' : '') + '</div>' +
        '<div class="cart-item-body"><h3>' + esc(item.name) + '</h3><p>' + esc(item.item_type === 'material' ? 'Material' : 'Serviço') + ' · ' + esc(item.unit_label || 'unidade') + '</p><div class="cart-item-meta"><span>' +
        (item.unit_price == null ? 'Sob orçamento' : money(item.unit_price, item.currency) + ' / ' + esc(item.unit_label || 'unidade')) + '</span>' + specs + '</div></div>' +
        '<div class="cart-item-actions"><input class="cart-qty" data-cart-qty="' + i + '" type="number" min="1" step="1" value="' + (Number(item.quantity) || 1) + '"' + max + '><strong>' + esc(line) + '</strong><button class="link-button" type="button" data-cart-remove="' + i + '">Remover</button></div></article>';
    }).join('');

    const known = items.every((x) => x.unit_price != null);
    const sub = known ? items.reduce((s, x) => s + Number(x.unit_price) * Number(x.quantity), 0) : null;
    lines.innerHTML = '<div><span>Itens</span><strong>' + cart().count() + '</strong></div><div><span>Subtotal</span><strong>' +
      (sub == null ? 'Sob orçamento' : money(sub, items[0]?.currency || 'AOA')) + '</strong></div>';
    total.textContent = sub == null ? 'Sob orçamento' : money(sub, items[0]?.currency || 'AOA');
    bind();
  }

  async function refreshCatalog() {
    const items = cart().getItems();
    if (!items.length) { render([]); return; }
    const r = await db().from('services').select('id,name,slug,category,description,image_url,features,unit_price,currency,item_type,sku,unit_label,stock_quantity,is_active').in('id', items.map(x => x.id));
    if (r.error) { render(items); return; }

    const current = r.data || [];
    const valid = items.filter(item => current.some(x => x.id === item.id && x.is_active));
    if (valid.length !== items.length) toast('Alguns itens deixaram de estar disponíveis e foram removidos.');
    const normalized = valid.map(item => Object.assign({}, item, current.find(x => x.id === item.id) || {}));
    cart().saveItems(normalized);
    render(normalized);
  }

  document.addEventListener('DOMContentLoaded', refreshCatalog);
  window.addEventListener('mukwatela:cart-updated', () => render(cart().getItems()));
})();