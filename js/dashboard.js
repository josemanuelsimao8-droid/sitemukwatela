(() => {
  const db = () => window.supabaseClient;

  const message = (text, type = 'info') => {
    const node = document.getElementById('auth-message');
    if (!node) return;
    node.textContent = text;
    node.dataset.type = type;
    node.hidden = false;
  };

  async function load() {
    const { data: auth, error: authError } = await db().auth.getUser();
    const user = auth?.user;
    if (authError || !user) {
      window.location.href = 'auth.html';
      return;
    }

    const profileResult = await db()
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileResult.error) {
      console.error(profileResult.error);
      message('Não foi possível carregar o seu perfil.', 'error');
      return;
    }

    if (profileResult.data?.role === 'admin') {
      window.location.href = 'admin.html';
      return;
    }

    const [ordersResult, paymentsResult, notificationsResult] = await Promise.all([
      db().from('orders')
        .select('id,order_number,status,payment_status,total,created_at,order_items(quantity)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db().from('payments')
        .select('id,status,amount,created_at')
        .eq('user_id', user.id)
        .eq('status', 'paid'),
      db().from('notifications')
        .select('id,title,message,read,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    if (ordersResult.error) console.error('orders:', ordersResult.error);
    if (paymentsResult.error) console.error('payments:', paymentsResult.error);
    if (notificationsResult.error) console.error('notifications:', notificationsResult.error);

    const orders = ordersResult.data || [];
    const payments = paymentsResult.data || [];
    const notifications = notificationsResult.data || [];

    const servicesCount = orders.reduce(
      (sum, order) => sum + (order.order_items || []).reduce((n, item) => n + Number(item.quantity || 0), 0),
      0
    );
    const activeOrders = orders.filter(order => !['delivered', 'cancelled'].includes(order.status)).length;
    const quotes = orders.filter(order => order.status === 'pending_quote').length;

    const name = profileResult.data?.full_name || user.email?.split('@')[0] || 'Cliente';

    document.getElementById('user-name')?.replaceChildren(document.createTextNode(name));
    document.getElementById('user-avatar')?.replaceChildren(document.createTextNode(name.trim().charAt(0).toUpperCase() || 'C'));
    document.getElementById('user-email')?.replaceChildren(document.createTextNode(user.email || ''));
    document.getElementById('user-role')?.replaceChildren(document.createTextNode('Cliente'));

    document.getElementById('sum-services')?.replaceChildren(document.createTextNode(String(servicesCount)));
    document.getElementById('sum-orders')?.replaceChildren(document.createTextNode(String(activeOrders)));
    document.getElementById('sum-payments')?.replaceChildren(document.createTextNode(String(payments.length)));
    document.getElementById('sum-budgets')?.replaceChildren(document.createTextNode(String(quotes)));
    document.getElementById('notifications-count')?.replaceChildren(document.createTextNode(String(notifications.length)));

    const activity = document.getElementById('recent-activity');
    if (activity) {
      activity.innerHTML = orders.slice(0, 5).map(order =>
        '<li><strong>Pedido</strong> · ' +
        String(order.order_number || order.id).slice(0, 16) +
        ' · ' + new Date(order.created_at).toLocaleDateString('pt-PT') +
        ' · ' + String(order.status) + '</li>'
      ).join('') || '<li>Ainda não existem pedidos.</li>';
    }

    const noteList = document.getElementById('dashboard-notifications');
    if (noteList) {
      noteList.innerHTML = notifications.map(note =>
        '<li><strong>' + escapeHtml(note.title) + '</strong><span>' +
        escapeHtml(note.message) + '</span></li>'
      ).join('') || '<li>Sem notificações.</li>';
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[c]));
  }

  document.addEventListener('DOMContentLoaded', load);
})();