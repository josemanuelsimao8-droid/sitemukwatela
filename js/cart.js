(() => {
  const KEY_PREFIX = 'mukwatela-cart-v1:';
  let currentUserId = null;
  let authReady = false;

  function safeParse(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function setCurrentUser(user) {
    currentUserId = user?.id || null;
    authReady = true;
    renderBadges();
  }

  async function getAuthenticatedUser() {
    const supabase = window.supabaseClient;
    if (!supabase?.auth) return null;
    const result = await supabase.auth.getUser();
    if (result.error) {
      console.error('Supabase auth:', result.error);
      setCurrentUser(null);
      return null;
    }
    setCurrentUser(result.data?.user || null);
    return result.data?.user || null;
  }

  async function requireAuth({ redirect = true } = {}) {
    const user = await getAuthenticatedUser();
    if (user) return user;

    if (redirect) {
      const returnUrl = window.location.pathname + window.location.search + window.location.hash;
      if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
        const safeUrl = new URL(returnUrl, window.location.origin);
        const blocked = ['/auth.html', '/register.html', '/recuperar-password.html'].includes(safeUrl.pathname);
        if (safeUrl.origin === window.location.origin && !blocked) {
          sessionStorage.setItem('mukwatela-auth-return', safeUrl.pathname + safeUrl.search + safeUrl.hash);
        }
      }
      window.location.href = 'auth.html';
    }
    return null;
  }

  function storageKey() {
    return currentUserId ? KEY_PREFIX + currentUserId : null;
  }

  function getItems() {
    const key = storageKey();
    if (!key) return [];
    const items = safeParse(localStorage.getItem(key) || '[]', []);
    return Array.isArray(items) ? items : [];
  }

  function saveItems(items) {
    const key = storageKey();
    if (!key) return false;
    const normalizedItems = Array.isArray(items) ? items : [];
    localStorage.setItem(key, JSON.stringify(normalizedItems));
    window.dispatchEvent(new CustomEvent('mukwatela:cart-updated', { detail: { items: normalizedItems } }));
    return true;
  }

  function specsKey(specifications) {
    try { return JSON.stringify(specifications || {}); } catch (_) { return '{}'; }
  }

  async function add(item, quantity = 1, specifications = item?.specifications || {}) {
    const user = await requireAuth();
    if (!user || !item?.id) return null;

    const qty = Math.max(1, Math.trunc(Number(quantity) || 1));
    const normalized = {
      id: item.id,
      name: String(item.name || ''),
      slug: String(item.slug || ''),
      category: String(item.category || ''),
      description: String(item.description || ''),
      image_url: String(item.image_url || ''),
      features: Array.isArray(item.features) ? item.features : [],
      unit_price: item.unit_price ?? null,
      currency: String(item.currency || 'AOA'),
      item_type: item.item_type === 'material' ? 'material' : 'service',
      sku: String(item.sku || ''),
      unit_label: String(item.unit_label || 'unidade'),
      stock_quantity: item.stock_quantity ?? null,
      specifications: specifications && typeof specifications === 'object' ? specifications : {}
    };

    const items = getItems();
    const existingIndex = items.findIndex((entry) =>
      entry.id === normalized.id &&
      specsKey(entry.specifications) === specsKey(normalized.specifications)
    );

    if (existingIndex >= 0) {
      items[existingIndex].quantity = Math.max(
        1,
        Number(items[existingIndex].quantity || 0) + qty
      );
    } else {
      normalized.quantity = qty;
      items.push(normalized);
    }

    saveItems(items);
    return normalized;
  }

  function update(index, quantity) {
    if (!currentUserId) return false;
    const items = getItems();
    if (!items[index]) return false;

    const qty = Math.trunc(Number(quantity) || 0);
    if (qty <= 0) items.splice(index, 1);
    else items[index].quantity = qty;

    return saveItems(items);
  }

  function remove(index) {
    if (!currentUserId) return false;
    const items = getItems();
    if (!items[index]) return false;
    items.splice(index, 1);
    return saveItems(items);
  }

  function clear() {
    if (!currentUserId) return false;
    return saveItems([]);
  }

  function count() {
    return getItems().reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
  }

  function subtotal() {
    const items = getItems();
    return items.every((item) => item.unit_price !== null && item.unit_price !== undefined)
      ? items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0)
      : null;
  }

  function renderBadges() {
    const total = count();
    document.querySelectorAll('[data-cart-count]').forEach((node) => {
      node.textContent = String(total);
      node.hidden = total === 0;
    });
    document.querySelectorAll('[data-cart-total-items]').forEach((node) => {
      node.textContent = String(total);
    });
  }

  const api = {
    getItems,
    saveItems,
    add,
    update,
    remove,
    clear,
    count,
    subtotal,
    renderBadges,
    requireAuth,
    getCurrentUser: () => currentUserId ? { id: currentUserId } : null,
    isAuthenticated: () => Boolean(currentUserId),
    isAuthReady: () => authReady
  };

  window.MukwatelaCart = api;

  if (window.supabaseClient?.auth) {
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user || null);
    });
    window.supabaseClient.auth.getUser().then((result) => {
      setCurrentUser(result.data?.user || null);
    }).catch(() => {
      setCurrentUser(null);
    });
  } else {
    authReady = true;
  }

  document.addEventListener('DOMContentLoaded', renderBadges);
  window.addEventListener('storage', (event) => {
    if (event.key?.startsWith(KEY_PREFIX)) renderBadges();
  });
  window.addEventListener('mukwatela:cart-updated', renderBadges);
})();
