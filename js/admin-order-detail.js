(() => {
  const db=()=>window.supabaseClient;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'Sob orçamento':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const stat={pending_payment:'A aguardar pagamento',pending_quote:'A aguardar orçamento',processing:'Em processamento',completed:'Concluído',cancelled:'Cancelado',pending:'Pendente'};
  const pay={unpaid:'Não pago',submitted:'Comprovativo enviado',confirmed:'Confirmado',rejected:'Rejeitado'};
  function msg(t,type='info'){const n=document.getElementById('admin-order-message');if(!n)return;n.textContent=t;n.dataset.type=type;n.hidden=false;}
  async function admin(){
    const s=(await db().auth.getSession()).data?.session;if(!s){location.href='auth.html';return null;}
    const r=await db().from('user_roles').select('role').eq('user_id',s.user.id).maybeSingle();if(r.data?.role!=='admin'){location.href='dashboard.html';return null;}return s;
  }
  async function files(orderId){
    const r=await db().from('order_files').select('id,file_name,file_path,file_type,mime_type,file_size,note,created_at').eq('order_id',orderId).order('created_at',{ascending:false});if(r.error)return[];
    return Promise.all((r.data||[]).map(async f=>{const s=await db().storage.from('order-files').createSignedUrl(f.file_path,3600);return Object.assign({},f,{url:s.data?.signedUrl||''});}));
  }
  async function init(){
    const s=await admin();if(!s)return;
    const id=new URLSearchParams(location.search).get('order');if(!id){msg('Pedido não selecionado.','error');return;}
    const r=await db().from('orders').select('id,order_number,status,total,subtotal,currency,payment_method,payment_status,payment_reference,payment_note,delivery_method,delivery_zone_id,delivery_fee,delivery_address,delivery_contact,delivery_notes,delivery_status,delivered_at,admin_note,created_at,updated_at,profiles(full_name,phone,company,address),order_items(service_id,service_name,quantity,unit_price,line_total,item_type,unit_label,sku,specifications)').eq('id',id).maybeSingle();
    if(r.error||!r.data){msg('Pedido não encontrado.','error');return;}
    const o=r.data,z=o.delivery_zone_id?await db().from('delivery_zones').select('name').eq('id',o.delivery_zone_id).maybeSingle():{data:null},fs=await files(o.id);
    const items=o.order_items||[];
    const root=document.getElementById('admin-order-detail');
    root.innerHTML='<div class="order-detail-head"><div><span class="eyebrow">Pedido</span><h1>'+esc(o.order_number)+'</h1><p>'+new Date(o.created_at).toLocaleString('pt-PT')+'</p></div><div class="card-actions"><a class="btn btn-secondary" href="admin.html">Painel</a><span class="payment-status-badge">'+esc(pay[o.payment_status]||o.payment_status)+'</span></div></div>'+
      '<div class="order-detail-grid"><section class="panel-card"><h2>Cliente</h2><div class="detail-list"><div><span>Nome</span><strong>'+esc(o.profiles?.full_name||'—')+'</strong></div><div><span>Empresa</span><strong>'+esc(o.profiles?.company||'—')+'</strong></div><div><span>Telefone</span><strong>'+esc(o.profiles?.phone||'—')+'</strong></div></div></section>'+
      '<section class="panel-card"><h2>Estado</h2><div class="detail-list"><div><span>Pedido</span><strong>'+esc(stat[o.status]||o.status)+'</strong></div><div><span>Pagamento</span><strong>'+esc(pay[o.payment_status]||o.payment_status)+'</strong></div><div><span>Entrega</span><strong>'+esc(o.delivery_status||'—')+'</strong></div><div><span>Zona</span><strong>'+esc(z.data?.name||'—')+'</strong></div></div></section></div>'+
      '<section class="panel-card order-block"><h2>Itens</h2><div class="table-responsive"><table class="order-items-table"><thead><tr><th>Item</th><th>Tipo</th><th>Qtd.</th><th>Preço</th><th>Total</th></tr></thead><tbody>'+items.map(i=>'<tr><td>'+esc(i.service_name)+'</td><td>'+esc(i.item_type==='material'?'Material':'Serviço')+'</td><td>'+esc(i.quantity)+'</td><td>'+esc(money(i.unit_price,o.currency))+'</td><td>'+esc(money(i.line_total,o.currency))+'</td></tr>').join('')+'</tbody></table><div class="document-total"><span>Entrega</span><strong>'+esc(money(o.delivery_fee,o.currency))+'</strong><span>Total</span><strong>'+esc(money(o.total,o.currency))+'</strong></div></div></section>'+
      '<section class="panel-card order-block"><h2>Entrega / levantamento</h2><div class="detail-list"><div><span>Método</span><strong>'+esc(o.delivery_method==='delivery'?'Entrega':'Levantamento')+'</strong></div><div><span>Zona</span><strong>'+esc(z.data?.name||'—')+'</strong></div><div><span>Morada</span><strong>'+esc(o.delivery_address||'—')+'</strong></div><div><span>Contacto</span><strong>'+esc(o.delivery_contact||'—')+'</strong></div></div></section>'+
      '<section class="panel-card order-block"><h2>Ficheiros do cliente</h2><div class="order-file-list">'+(fs.map(f=>'<div class="order-file-row"><div><strong>'+esc(f.file_name)+'</strong><small>'+esc(f.file_type)+' · '+esc(f.note||'')+'</small></div><small>'+esc(f.file_size?Math.round(f.file_size/1024)+' KB':'')+'</small>'+(f.url?'<a class="btn btn-secondary btn-small" target="_blank" rel="noreferrer" href="'+esc(f.url)+'">Abrir</a>':'<span>Indisponível</span>')+'</div>').join('')||'<p>Nenhum ficheiro enviado.</p>')+'</div></section>'+
      '<section class="panel-card order-block"><h2>Notas administrativas</h2><p class="admin-section-note">'+esc(o.admin_note||'Sem nota interna.')+'</p></section>';
  }
  document.addEventListener('DOMContentLoaded',init);
})();