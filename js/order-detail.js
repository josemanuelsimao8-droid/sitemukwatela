(() => {
  const db=()=>window.supabaseClient;
  let session=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'Sob orçamento':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const status={pending_payment:'A aguardar pagamento',pending_quote:'A aguardar orçamento',processing:'Em processamento',completed:'Concluído',cancelled:'Cancelado',pending:'Pendente'};
  const pay={unpaid:'Não pago',submitted:'Em validação',confirmed:'Pago',rejected:'Rejeitado'};
  const delivery={pending:'A preparar',preparing:'A preparar',ready:'Pronto',out_for_delivery:'Em entrega',delivered:'Entregue',picked_up:'Levantado',cancelled:'Cancelado'};

  async function init(){
    session=(await db().auth.getSession()).data?.session;if(!session){location.href='auth.html';return;}
    const id=new URLSearchParams(location.search).get('order')||sessionStorage.getItem('mukwatela-last-order-id');
    if(!id){show('Nenhum pedido selecionado.','error');return;}
    const r=await db().from('orders').select('id,order_number,status,total,currency,payment_method,payment_status,payment_reference,payment_note,delivery_method,delivery_address,delivery_contact,delivery_notes,delivery_status,delivered_at,admin_note,created_at,updated_at,order_items(service_name,quantity,unit_price,specifications)').eq('id',id).eq('customer_id',session.user.id).maybeSingle();
    if(r.error||!r.data){show('Pedido não encontrado.','error');return;}
    await render(r.data);
    db().channel('order-detail-'+id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders',filter:'id=eq.'+id},async()=>{const x=await db().from('orders').select('id,order_number,status,total,currency,payment_method,payment_status,payment_reference,payment_note,delivery_method,delivery_address,delivery_contact,delivery_notes,delivery_status,delivered_at,admin_note,created_at,updated_at,order_items(service_name,quantity,unit_price,specifications)').eq('id',id).eq('customer_id',session.user.id).maybeSingle();if(x.data)render(x.data)}).subscribe();
  }

  async function render(o){
    const root=document.getElementById('order-detail');if(!root)return;
    const items=o.order_items||[];
    const docs=await db().from('documents').select('id,document_type,document_number,status,amount,currency,issue_date').eq('order_id',o.id).order('created_at');
    const quotes=await db().from('quotes').select('id,amount,currency,status,notes,valid_until').eq('order_id',o.id).maybeSingle();
    let html='<div class="order-detail-head"><div><span class="eyebrow">Pedido</span><h1>'+esc(o.order_number)+'</h1><p>Criado em '+new Date(o.created_at).toLocaleString('pt-PT')+'</p></div><span class="payment-status-badge payment-status-'+(o.payment_status==='confirmed'?'paid':o.payment_status==='submitted'?'awaiting':o.payment_status==='rejected'?'rejected':'pending')+'">'+esc(pay[o.payment_status]||'Não pago')+'</span></div>';
    html+='<div class="order-detail-grid"><section class="panel-card"><h2>Resumo</h2><div class="detail-list"><div><span>Serviço</span><strong>'+esc(items[0]?.service_name||'Serviço')+'</strong></div><div><span>Quantidade</span><strong>'+esc(items[0]?.quantity||1)+'</strong></div><div><span>Total</span><strong>'+esc(money(o.total,o.currency))+'</strong></div><div><span>Estado</span><strong>'+esc(status[o.status]||o.status)+'</strong></div><div><span>Pagamento</span><strong>'+esc(pay[o.payment_status]||o.payment_status)+'</strong></div></div></section>';
    html+='<section class="panel-card"><h2>Entrega / levantamento</h2><div class="detail-list"><div><span>Método</span><strong>'+esc(o.delivery_method==='delivery'?'Entrega':'Levantamento')+'</strong></div><div><span>Estado</span><strong>'+esc(delivery[o.delivery_status]||o.delivery_status)+'</strong></div><div><span>Contacto</span><strong>'+esc(o.delivery_contact||'—')+'</strong></div><div><span>Morada</span><strong>'+esc(o.delivery_address||'—')+'</strong></div></div></section></div>';
    html+='<section class="panel-card order-block"><h2>Documentos</h2><div class="order-document-list">'+((docs.data||[]).map(d=>'<div><span>'+esc(d.document_type==='proforma'?'Factura Proforma':'Factura')+'</span><strong>'+esc(d.document_number)+'</strong><a class="btn btn-secondary btn-small" href="documento.html?id='+encodeURIComponent(d.id)+'">Abrir</a></div>').join('')||'<p>Ainda não existem documentos emitidos.</p>')+'</div></section>';
    if(o.total!==null&&Number(o.total)>0&&o.payment_status!=='confirmed'&&o.status!=='cancelled')html+='<section class="panel-card order-block"><h2>Pagamento</h2><p>O pagamento desta encomenda é feito por transferência bancária. Depois, envie o comprovativo pela plataforma.</p><a class="btn btn-primary" href="pagamento.html?order='+encodeURIComponent(o.id)+'">Pagar e enviar comprovativo</a></section>';
    if(quotes.data)html+='<section class="panel-card order-block"><h2>Orçamento</h2><div class="detail-list"><div><span>Valor</span><strong>'+esc(money(quotes.data.amount,quotes.data.currency))+'</strong></div><div><span>Estado</span><strong>'+esc(quotes.data.status)+'</strong></div></div><a class="btn btn-secondary" href="orcamentos.html">Abrir orçamentos</a></section>';
    root.innerHTML=html;
  }

  function show(text,type){const n=document.getElementById('order-message');if(!n)return;n.textContent=text;n.dataset.type=type;n.hidden=false;}
  document.addEventListener('DOMContentLoaded',init);
})();