(() => {
  const db = () => window.supabaseClient;
  const state = { settings: {}, content: {}, services: [], media: [] };
  let refreshTimer = null;
  let refreshPromise = null;

  const keyOf = (page, section, field) => [page, section, field].join('.');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  async function loadData() {
    const client = db();
    if (!client) return;

    const [settings, content, services, media] = await Promise.all([
      client.from('site_settings').select('key,value'),
      client.from('site_content').select('page,section,field,value'),
      client.from('services')
        .select('id,name,slug,category,description,image_url,features,unit_price,currency,is_active,sort_order,item_type,sku,unit_label,stock_quantity,is_featured')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      client.from('site_media')
        .select('id,media_type,title,category,description,image_url,whatsapp_message,is_active,sort_order')
        .eq('is_active', true)
        .order('media_type')
        .order('sort_order', { ascending: true })
    ]);

    if (settings.error) console.error('CMS settings:', settings.error);
    if (content.error) console.error('CMS content:', content.error);
    if (services.error) console.error('CMS services:', services.error);
    if (media.error) console.error('CMS media:', media.error);

    state.settings = Object.fromEntries((settings.data || []).map((row) => [row.key, row.value || '']));
    state.content = Object.fromEntries(
      (content.data || []).map((row) => [keyOf(row.page, row.section, row.field), row.value || ''])
    );
    state.services = services.data || [];
    state.media = media.data || [];
  }

  function applySettings() {
    const company = {
      name: state.settings.company_name || 'Mukwatela',
      whatsapp: state.settings.whatsapp || '975397984',
      phone: state.settings.phone || '975397984',
      email: state.settings.email || 'Mukwatelasulda@gmail.com',
      nif: state.settings.nif || '5002473488',
      address: state.settings.address || 'Angola - Cunene - Ombadja - Xangongo'
    };

    window.COMPANY = { ...(window.COMPANY || {}), ...company };

    document.querySelectorAll('[data-setting]').forEach((node) => {
      const value = state.settings[node.dataset.setting];
      if (value !== undefined) node.textContent = value;
    });

    document.querySelectorAll('[data-setting-href]').forEach((node) => {
      const value = state.settings[node.dataset.settingHref];
      if (value) node.setAttribute('href', value);
    });

    document.querySelectorAll('[data-whatsapp]').forEach((node) => {
      const number = String(company.whatsapp).replace(/\D/g, '');
      const message = node.dataset.whatsappMessage || state.settings.whatsapp_message || 'Olá, gostaria de obter mais informações sobre os serviços.';
      node.setAttribute('href', 'https://wa.me/' + number + '?text=' + encodeURIComponent(message));
    });

    document.querySelectorAll('[data-phone-link]').forEach((node) => {
      node.setAttribute('href', 'tel:' + String(company.phone).replace(/\s/g, ''));
    });

    document.querySelectorAll('[data-email-link]').forEach((node) => {
      node.setAttribute('href', 'mailto:' + company.email);
    });

    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function applyContent() {
    document.querySelectorAll('[data-cms]').forEach((node) => {
      const value = state.content[node.dataset.cms];
      if (value !== undefined) node.textContent = value;
    });
  }

  function renderHero() {
    const carousel = document.querySelector('[data-hero-carousel]');
    if (!carousel) return;

    const items = state.media.filter((item) => item.media_type === 'hero');
    if (!items.length) return;

    const overlay = carousel.querySelector('.hero-overlay');
    carousel.querySelectorAll('.hero-slide').forEach((node) => node.remove());

    items.forEach((item, index) => {
      const slide = document.createElement('div');
      slide.className = 'hero-slide' + (index === 0 ? ' is-active' : '');
      slide.style.backgroundImage = 'url("' + item.image_url.replace(/"/g, '\\"') + '")';
      slide.setAttribute('data-media-id', item.id);
      carousel.insertBefore(slide, overlay || null);
    });
  }

  function renderHomeServices() {
    const container = document.getElementById('home-services-grid');
    if (!container) return;

    if (!state.services.length) {
      container.innerHTML = '<p>Não existem serviços disponíveis neste momento.</p>';
      return;
    }

    container.innerHTML = '';
    state.services.forEach((service, index) => {
      const article = document.createElement('article');
      article.className = 'service-card-item';
      article.dataset.animate = 'fade-up';
      article.dataset.delay = String(Math.min(index * 60, 240));

      const visual = document.createElement('div');
      visual.className = 'service-visual';
      if (service.image_url) {
        const img = document.createElement('img');
        img.src = encodeURI(service.image_url);
        img.alt = service.name;
        img.loading = 'lazy';
        visual.appendChild(img);
      }

      const copy = document.createElement('div');
      copy.className = 'service-copy';

      const category = document.createElement('span');
      category.className = 'service-number';
      category.textContent = service.item_type === 'material' ? 'Material' : (service.category || 'Serviço');

      const title = document.createElement('h3');
      title.textContent = service.name;

      const description = document.createElement('p');
      description.textContent = service.description || '';

      const link = document.createElement('a');
      link.href = service.item_type === 'material' ? 'materiais.html' : 'services.html';
      link.textContent = service.item_type === 'material' ? 'Ver material' : 'Ver serviço';

      copy.append(category, title, description, link);
      article.append(visual, copy);
      container.appendChild(article);
    });
  }

  function renderHomeGallery() {
    const container = document.getElementById('assets-gallery');
    if (!container) return;

    const items = state.media.filter((item) => item.media_type === 'gallery');
    container.innerHTML = items.map((item) => {
      const message = item.whatsapp_message || ('Olá, tenho interesse em ' + (item.title || 'este trabalho') + '.');
      return '<figure class="asset-card" data-animate="fade-up">' +
        '<img src="' + esc(encodeURI(item.image_url)) + '" alt="' + esc(item.title || item.category || 'Trabalho Mukwatela') + '" loading="lazy">' +
        '<figcaption><span>' + esc(item.category || 'Trabalho') + '</span>' +
        '<strong>' + esc(item.title || 'Trabalho Mukwatela') + '</strong>' +
        '<p>' + esc(item.description || '') + '</p>' +
        '<a class="portfolio-whatsapp" data-whatsapp data-whatsapp-message="' + esc(message) + '" href="#">Falar sobre este trabalho</a>' +
        '</figcaption></figure>';
    }).join('') || '<p>Sem trabalhos publicados.</p>';
  }

  function renderPortfolio() {
    const container = document.getElementById('portfolio-gallery');
    const filters = document.getElementById('portfolio-filters');
    if (!container) return;

    const items = state.media.filter((item) => item.media_type === 'portfolio');
    const categories = [...new Set(items.map((item) => item.category).filter(Boolean))];

    if (filters) {
      filters.innerHTML =
        '<button type="button" class="filter-btn is-active" data-portfolio-filter="all">Todos</button>' +
        categories.map((category) =>
          '<button type="button" class="filter-btn" data-portfolio-filter="' + esc(category) + '">' + esc(category) + '</button>'
        ).join('');

      filters.querySelectorAll('[data-portfolio-filter]').forEach((button) => {
        button.addEventListener('click', () => {
          filters.querySelectorAll('[data-portfolio-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
          const selected = button.dataset.portfolioFilter;
          container.querySelectorAll('[data-portfolio-item]').forEach((card) => {
            card.style.display = selected === 'all' || card.dataset.category === selected ? '' : 'none';
          });
        });
      });
    }

    container.innerHTML = items.map((item) => {
      const message = item.whatsapp_message || ('Olá, tenho interesse em ' + (item.title || 'este trabalho') + '.');
      return '<figure class="asset-card" data-portfolio-item data-category="' + esc(item.category || '') + '" data-animate="fade-up">' +
        '<img src="' + esc(encodeURI(item.image_url)) + '" alt="' + esc(item.title || item.category || 'Trabalho Mukwatela') + '" loading="lazy">' +
        '<figcaption><span>' + esc(item.category || 'Trabalho') + '</span>' +
        '<strong>' + esc(item.title || 'Trabalho Mukwatela') + '</strong>' +
        '<p>' + esc(item.description || '') + '</p>' +
        '<a class="portfolio-whatsapp" data-whatsapp data-whatsapp-message="' + esc(message) + '" href="#">Falar sobre este trabalho</a>' +
        '</figcaption></figure>';
    }).join('') || '<p>Sem trabalhos publicados.</p>';
  }

  async function refresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      await loadData();
      applySettings();
      applyContent();
      renderHero();
      renderHomeServices();
      renderHomeGallery();
      renderPortfolio();

      window.dispatchEvent(new CustomEvent('cms:hero-updated'));
      window.dispatchEvent(new CustomEvent('cms:services-updated'));
      window.dispatchEvent(new CustomEvent('cms:content-updated'));
    })();
    try {
      await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, 150);
  }

  function subscribe() {
    const client = db();
    if (!client?.channel) return;

    const channel = client.channel('mukwatela-cms-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_media' }, scheduleRefresh);

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') console.warn('CMS realtime indisponível.');
    });
  }

  async function init() {
    if (!db()) return;
    await refresh();
    subscribe();
  }

  window.MukwatelaCMS = { state, refresh };
  document.addEventListener('DOMContentLoaded', init);
})();