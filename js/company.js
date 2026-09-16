window.COMPANY = {
  name: 'Mukwatela',
  whatsapp: '975397984',
  phone: '975397984',
  email: 'Mukwatelasulda@gmail.com',
  nif: '5002473488',
  address: '[ENDEREÇO]'
};

window.openWhatsApp = function (message) {
  const cleanNumber = (window.COMPANY?.whatsapp || '975397984').replace(/\D/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message || 'Olá, gostaria de obter mais informações.')}`;
};
