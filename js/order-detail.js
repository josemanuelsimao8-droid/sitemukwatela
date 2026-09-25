(() => {
  const db = () => window.supabaseClient;
  const cart = () => window.MukwatelaCart;
  let session = null;

  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money = (v,c='AOA') => v == null ? 'Sob orçamento' : c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const status = { pending:'Pendente', pending_payment:'A aguardar pagamento', pending_quote:'A aguardar orçamento', processing:'Em processamento', completed:'Concluído', cancelled:'Cancelado' };
  const pay = { unpaid:'Não pago', submitted:'Em validação', confirmed:'Pago', rejected:'Rejeitado' };

  function show(text,type='info'){
    const n=document.getElementById('order-message');
    if(!n)return;
    n.textContent=text;n.dataset.type=type;n.hidden=false;
  }

  async function loadOrder(id){
    const r=await db().from('orders')
      .select('id,order_number,status,total,currency,payment_method,payment_status,notes,delivery_method,delivery_zone_id,delivery_address,delivery_contact,created_at,updated_at,order_items(service_id,service_name,quantity,unit_price,subtotal,item_type,unit_label,specifications)')
      .eq('id',id).eq('user_id',session.user.id).maybeSingle();
    if(r.error) throw r.error;
    return r.data;
  }

  async function loadZone(id){
    if(!id)return null;
    const r=await db().from('delivery_zones').select('name,fee').eq('id',id).maybeSingle();
    return r.data||null;
  }

  async function cancelOrder(id){
    if(!confirm('Tem a certeza que deseja cancelar este pedido?')) return;
    const reason=prompt('Motivo do cancelamento (opcional):')||null;
    const r=await db().rpc('customer_cancel_order',{p_order_id:id,p_reason:reason});
    if(r.error){show('Não foi possível cancelar o pedido.','error');return;}
    show('Pedido cancelado com sucesso.','success');
    await reload(id);
  }

  async function reorder(items){
    const ids=[...new Set(items.map(i=>i.service_id).filter(Boolean))];
    if(!ids.length){show('Não foi possível repetir este pedido.','error');return;}
    const r=await db().from('services').select('id,name,slug,category,description,image_url,features,unit_price,currency,item_type,sku,unit_label,stock_quantity,is_active').in('id',ids).eq('is_active',true);
    if(r.error){show('Não foi possível preparar a repetição.','error');return;}
    let added=0;
    for(const item of items){
      const service=(r.data||[]).find(s=>s.id===item.service_id);
      if(service && cart()){await cart().add(service,Number(item.quantity)||1,item.specifications||{});added++;}
    }
    if(added) location.href='carrinho.html'; else show('Os itens já não estão disponíveis.','error');
  }

  async function render(order){
    const root=document.getElementById('order-detail'); if(!root)return;
    const zone=await loadZone(order.delivery_zone_id);
    const items=order.order_items||[];
    const canCancel=['pending','pending_payment','pending_quote'].includes(order.status) && order.payment_status!=='confirmed';

    const rows=items.map(i =>
      '<tr><td>'+esc(i.service_name)+'</td><td>'+esc(i.item_type==='material'?'Material':'Serviço')+'</td><td>'+esc(i.quantity)+' '+esc(i.unit_label||'unidade')+'</td><td>'+esc(money(i.unit_price,order.currency))+'</td><td>'+esc(money(i.subtotal,order.currency))+'</td></tr>'
    ).join('');

    let html='<div class="order-detail-head"><div><span class="eyebrow">Pedido</span><h1>'+esc(order.order_number)+'</h1><p>Criado em '+new Date(order.created_at).toLocaleString('pt-PT')+'</p></div><div class="card-actions"><span class="payment-status-badge payment-status-'+(order.payment_status==='confirmed'?'paid':order.payment_status==='submitted'?'awaiting':order.payment_status==='rejected'?'rejected':'pending')+'">'+esc(pay[order.payment_status]||'Não pago')+'</span>'+
      (canCancel?'<button class="btn btn-secondary btn-small" type="button" id="cancel-order-btn">Cancelar pedido</button>':'')+
      '<button class="btn btn-primary btn-small" type="button" id="reorder-btn">Comprar novamente</button></div></div>';

    html+='<section class="panel-card order-block"><h2>Itens do pedido</h2><div class="table-responsive"><table class="order-items-table"><thead><tr><th>Item</th><th>Tipo</th><th>Quantidade</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>'+rows+'</tbody></table><div class="document-total"><span>Total</span><strong>'+esc(money(order.total,order.currency))+'</strong></div></div></section>';

    html+='<div class="order-detail-grid"><section class="panel-card"><h2>Estado</h2><div class="detail-list"><div><span>Pedido</span><strong>'+esc(status[order.status]||order.status)+'</strong></div><div><span>Pagamento</span><strong>'+esc(pay[order.payment_status]||order.payment_status)+'</strong></div><div><span>Método de pagamento</span><strong>'+esc(order.payment_method||'—')+'</strong></div></div></section><section class="panel-card"><h2>Entrega / levantamento</h2><div class="detail-list"><div><span>Método</span><strong>'+esc(order.delivery_method==='delivery'?'Entrega':'Levantamento')+'</strong></div><div><span>Zona</span><strong>'+esc(zone?.name||'—')+'</strong></div><div><span>Contacto</span><strong>'+esc(order.delivery_contact||'—')+'</strong></div><div><span>Morada</span><strong>'+esc(order.delivery_address||'—')+'</strong></div></div></section></div>';

    if(order.notes) html+='<section class="panel-card order-block"><h2>Observações</h2><p>'+esc(order.notes)+'</p></section>';

    if(order.total!==null && Number(order.total)>0 && order.payment_status!=='confirmed' && order.status!=='cancelled')
      html+='<section class="panel-card order-block"><h2>Pagamento</h2><p>Conclua o pagamento e envie o comprovativo para validação.</p><a class="btn btn-primary" href="pagamento.html?order='+encodeURIComponent(order.id)+'">Pagar e enviar comprovativo</a></section>';

    root.innerHTML=html;
    document.getElementById('cancel-order-btn')?.addEventListener('click',()=>cancelOrder(order.id));
    document.getElementById('reorder-btn')?.addEventListener('click',()=>reorder(items));
  }

  async function reload(id){
    try{
      const order=await loadOrder(id);
      if(!order){show('Pedido não encontrado.','error');return;}
      await render(order);
    }catch(e){console.error(e);show('Não foi possível carregar este pedido.','error');}
  }

  async function init(){
    session=(await db().auth.getSession()).data?.session;
    if(!session){location.href='auth.html';return;}
    const id=new URLSearchParams(location.search).get('order')||sessionStorage.getItem('mukwatela-last-order-id');
    if(!id){show('Nenhum pedido selecionado.','error');return;}
    await reload(id);
    db().channel('order-detail-'+id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders',filter:'id=eq.'+id},()=>reload(id)).subscribe();
  }

  document.addEventListener('DOMContentLoaded',init);
})();