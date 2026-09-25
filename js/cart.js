(() => {
  const KEY = 'mukwatela-cart-v1';

  function safeParse(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function getItems() {
    const items = safeParse(localStorage.getItem(KEY) || '[]', []);
    return Array.isArray(items) ? items : [];
  }

  function saveItems(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('mukwatela:cart-updated', { detail: { items } }));
  }

  function specsKey(specifications) {
    return JSON.stringify(specifications || {});
  }

  function add(item, quantity = 1, specifications = item.specifications || {}) {
    if (!item?.id) return;
    const qty = Math.max(1, Math.trunc(Number(quantity) || 1));
    const normalized = {
      id: item.id,
      name: item.name,
      slug: item.slug || '',
      category: item.category || '',
      description: item.description || '',
      image_url: item.image_url || '',
      features: Array.isArray(item.features) ? item.features : [],
      unit_price: item.unit_price ?? null,
      currency: item.currency || 'AOA',
      item_type: item.item_type || 'service',
      sku: item.sku || '',
      unit_label: item.unit_label || 'unidade',
      stock_quantity: item.stock_quantity ?? null,
      specifications: specifications || {}
    };

    const items = getItems();
    const existingIndex = items.findIndex((entry) => entry.id === normalized.id && specsKey(entry.specifications) === specsKey(normalized.specifications));
    if (existingIndex >= 0) {
      items[existingIndex].quantity = Math.max(1, Number(items[existingIndex].quantity || 0) + qty);
    } else {
      normalized.quantity = qty;
      items.push(normalized);
    }
    saveItems(items);
    return normalized;
  }

  function update(index, quantity) {
    const items = getItems();
    if (!items[index]) return;
    const qty = Math.trunc(Number(quantity) || 0);
    if (qty <= 0) items.splice(index, 1);
    else items[index].quantity = qty;
    saveItems(items);
  }

  function remove(index) {
    const items = getItems();
    items.splice(index, 1);
    saveItems(items);
  }

  function clear() { saveItems([]); }

  function count() {
    return getItems().reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
  }

  function subtotal() {
    return getItems().every((item) => item.unit_price !== null && item.unit_price !== undefined)
      ? getItems().reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0)
      : null;
  }

  function renderBadges() {
    document.querySelectorAll('[data-cart-count]').forEach((node) => {
      node.textContent = String(count());
      node.hidden = count() === 0;
    });
    document.querySelectorAll('[data-cart-total-items]').forEach((node) => {
      node.textContent = String(count());
    });
  }

  const api = { getItems, saveItems, add, update, remove, clear, count, subtotal, renderBadges };
  window.MukwatelaCart = api;

  document.addEventListener('DOMContentLoaded', renderBadges);
  window.addEventListener('storage', (event) => { if (event.key === KEY) renderBadges(); });
  window.addEventListener('mukwatela:cart-updated', renderBadges);
})();
