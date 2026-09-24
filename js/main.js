const ASSET_IMAGES = [
  'assets/WhatsApp Image 2026-09-13 at 23.25.28.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.26.27.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.31 (1).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.31.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.32 (1).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.32.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.33.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.34.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.35 (1).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.35.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.36 (1).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.36.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.37.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.38 (1).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.30.38.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.32.19 (1).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.32.19.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.32.20 (1).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.32.20 (2).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.32.20.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.32.21 (1).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.32.21.jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.32.22 (1).jpeg',
  'assets/WhatsApp Image 2026-09-13 at 23.32.22.jpeg'
].map((src) => encodeURI(src));

function openWhatsApp(message) {
  const company = window.COMPANY || {};
  const cleanNumber = ((company.whatsapp || '975397984')).replace(/\D/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message || 'Olá, gostaria de obter mais informações.')}`;
}

function initHeader() {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const navTrigger = document.querySelector('.nav-trigger');
  const megaMenu = document.querySelector('.mega-menu');
  const accordionTriggers = document.querySelectorAll('.accordion-trigger');

  function setHeaderState() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });

  navToggle?.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    mobileMenu?.classList.toggle('is-open', !expanded);
    document.body.classList.toggle('menu-open', !expanded);
  });

  const closeMobileMenu = () => {
    navToggle?.setAttribute('aria-expanded', 'false');
    mobileMenu?.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  };

  document.querySelectorAll('.mobile-menu a').forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });

  navTrigger?.addEventListener('mouseenter', () => {
    megaMenu?.classList.add('is-visible');
    navTrigger.setAttribute('aria-expanded', 'true');
  });

  navTrigger?.addEventListener('mouseleave', () => {
    megaMenu?.classList.remove('is-visible');
    navTrigger.setAttribute('aria-expanded', 'false');
  });

  navTrigger?.addEventListener('click', (event) => {
    const visible = megaMenu?.classList.contains('is-visible');
    megaMenu?.classList.toggle('is-visible', !visible);
    navTrigger.setAttribute('aria-expanded', String(!visible));
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.nav-item-with-mega')) {
      megaMenu?.classList.remove('is-visible');
      navTrigger?.setAttribute('aria-expanded', 'false');
    }
  });

  accordionTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      const content = trigger.nextElementSibling;
      if (!content) return;
      content.style.maxHeight = expanded ? '0px' : `${content.scrollHeight}px`;
    });
  });
}

function initHeroCarousel() {
  const carousels = document.querySelectorAll('[data-hero-carousel]');
  if (!carousels.length) return;

  carousels.forEach((carousel) => {
    const slides = carousel.querySelectorAll('.hero-slide');
    if (slides.length < 2) return;

    let currentIndex = 0;
    const update = () => {
      slides.forEach((slide, index) => {
        slide.classList.toggle('is-active', index === currentIndex);
      });
      currentIndex = (currentIndex + 1) % slides.length;
    };

    update();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      setInterval(update, 5500);
    }
  });
}

function initAnimations() {
  document.body.classList.add('js-ready');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = document.querySelectorAll('[data-animate]');

  if (reducedMotion) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  if (!('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const target = entry.target;
      const delay = Number(target.dataset.delay || 0);
      setTimeout(() => target.classList.add('is-visible'), delay);
      observer.unobserve(target);
    });
  }, { threshold: 0.18 });

  elements.forEach((element) => observer.observe(element));
  window.setTimeout(() => {
    elements.forEach((element) => element.classList.add('is-visible'));
  }, 1600);
}

function initPortfolio() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const items = document.querySelectorAll('.portfolio-item');
  const modal = document.querySelector('.modal-backdrop');
  const modalTitle = document.querySelector('#modal-title');
  const modalDescription = document.querySelector('#modal-description');
  const modalMedia = document.querySelector('.modal-media');
  const closeButton = document.querySelector('.modal-close');

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.getAttribute('data-filter');
      filterButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
      items.forEach((item) => {
        const category = item.getAttribute('data-category');
        const show = filter === 'all' || category === filter;
        item.style.display = show ? 'block' : 'none';
      });
    });
  });

  document.querySelectorAll('.portfolio-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const title = trigger.getAttribute('data-title') || 'Projeto';
      const description = trigger.getAttribute('data-description') || 'Descrição do projeto.';
      const imageUrl = trigger.getAttribute('data-image') || '';

      if (modalTitle) modalTitle.textContent = title;
      if (modalDescription) modalDescription.textContent = description;
      if (modalMedia) {
        modalMedia.style.backgroundImage = imageUrl ? `url('${imageUrl}')` : '';
      }

      modal?.classList.add('is-open');
      document.body.classList.add('modal-open');
    });
  });

  function closeModal() {
    modal?.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  closeButton?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}

function populateCompanyData() {
  const company = window.COMPANY || {};
  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value || '';
  };

  setText('company-phone', company.phone || '975397984');
  setText('company-whatsapp', company.whatsapp || '975397984');
  setText('company-email', company.email || 'Mukwatelasulda@gmail.com');
  setText('company-address', company.address || 'Angola - Cunene - Ombadja - Xangongo');
  setText('company-nif', company.nif || '5002473488');

  const whatsappLink = document.getElementById('footer-whatsapp-link');
  if (whatsappLink) whatsappLink.href = openWhatsApp('Olá, gostaria de obter informações sobre os serviços.');

  const phoneLink = document.getElementById('footer-phone-link');
  if (phoneLink) phoneLink.href = `tel:+351${(company.phone || '975397984').replace(/\D/g, '')}`;

  const emailLink = document.getElementById('footer-email-link');
  if (emailLink) emailLink.href = `mailto:${company.email || 'Mukwatelasulda@gmail.com'}`;

  const yearNode = document.getElementById('year');
  if (yearNode) yearNode.textContent = new Date().getFullYear();
}

function bindWhatsAppLinks() {
  const links = document.querySelectorAll('a[href*="wa.me"], a[data-whatsapp-message]');
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const message = link.getAttribute('data-whatsapp-message') || 'Olá, gostaria de obter mais informações.';
      event.preventDefault();
      window.open(openWhatsApp(message), '_blank', 'noopener,noreferrer');
    });
  });
}

function initAssetGallery() {
  const gallery = document.getElementById('assets-gallery');
  if (!gallery) return;

  gallery.innerHTML = '';
  ASSET_IMAGES.forEach((src, index) => {
    const card = document.createElement('figure');
    card.className = 'asset-card';

    const image = document.createElement('img');
    image.src = src;
    image.alt = `Trabalho Mukwatela ${index + 1}`;
    image.loading = 'lazy';

    card.appendChild(image);
    gallery.appendChild(card);
  });
}

function init() {
  populateCompanyData();
  initAssetGallery();
  initHeader();
  initHeroCarousel();
  initAnimations();
  initPortfolio();
  bindWhatsAppLinks();
}

document.addEventListener('DOMContentLoaded', init);
