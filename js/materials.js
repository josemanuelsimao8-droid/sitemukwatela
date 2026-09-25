(() => {
  const client = () => window.supabaseClient;

  const money = (value, currency) => {
    if (value === null || value === undefined || value === '') return 'Sob orçamento';
    return String(currency || 'AOA') + ' ' + Number(value).toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  function selectItem(item) {
    sessionStorage.setItem('mukwatela-selected-service-id', item.id);
    sessionStorage.setItem('mukwatela-selected-service', JSON.stringify(item));
  }

  async function getSession() {
    const result = await client().auth.getSession();
    return result.data?.session || null;
  }

  async function getRole(userId) {
    const result = await client().from('user_roles').select('role').eq('user_id', userId).maybeSingle();
    return result.data?.role || 'customer';
  }

  async function loadMaterials() {
    const list = document.getElementById('materials-list');
    if (!list) return;

    const result = await client().from('services')
      .select('id,name,slug,category,description,image_url,features,unit_price,currency,is_active,sort_order,item_type,sku,unit_label,stock_quantity,is_featured')
      .eq('is_active', true)
      .eq('item_type', 'material')
      .order('sort_order', { ascending: true });

    if (result.error) {
      console.error(result.error);
      list.innerHTML = '<p>Não foi possível carregar os materiais neste momento.</p>';
      return;
    }

    const materials = result.data || [];
    if (!materials.length) {
      list.innerHTML = '<p>Não existem materiais disponíveis neste momento.</p>';
      return;
    }

    const session = await getSession();
    const role = session ? await getRole(session.user.id) : 'guest';
    list.innerHTML = materials.map((item) => {
      const stock = item.stock_quantity === null || item.stock_quantity === undefined
        ? ''
        : '<small class="catalog-stock">' + (Number(item.stock_quantity).toLocaleString('pt-PT')) + ' ' + (item.unit_label || 'unidade') + ' disponíveis</small>';
      const features = Array.isArray(item.features)
        ? item.features.map((feature) => '<span>' + feature + '</span>').join('')
        : '';
      const action = role === 'admin'
        ? '<a class="btn btn-primary" href="admin.html">Gerir no painel</a>'
        : '<button class="btn btn-primary" type="button" data-buy-material="' + item.id + '">Comprar material</button>';
      return '<article class="service-catalog-card">' +
        '<div class="service-catalog-media">' + (item.image_url ? '<img src="' + encodeURI(item.image_url) + '" alt="' + item.name + '" loading="lazy">' : '') + '</div>' +
        '<div class="service-catalog-body">' +
          '<span class="eyebrow">Material</span>' +
          '<h2>' + item.name + '</h2>' +
          '<p>' + (item.description || '') + '</p>' +
          '<div class="service-feature-list">' + features + '</div>' +
          '<div class="service-catalog-footer"><div><strong>' + money(item.unit_price, item.currency) + '</strong><small>' + (item.unit_label || 'unidade') + '</small>' + stock + '</div>' + action + '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    list.querySelectorAll('[data-buy-material]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = materials.find((entry) => entry.id === button.dataset.buyMaterial);
        if (!item) return;
        selectItem(item);
        window.location.href = session ? 'checkout.html' : 'auth.html';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', loadMaterials);
  window.addEventListener('cms:services-updated', loadMaterials);
})();