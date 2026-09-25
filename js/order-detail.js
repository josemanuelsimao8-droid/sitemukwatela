(() => {
  const db=()=>window.supabaseClient, cart=()=>window.MukwatelaCart;
  let session=null,currentOrder=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'Sob orçamento':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const status={pending_payment:'A aguardar pagamento',pending_quote:'A aguardar orçamento',processing:'Em processamento',completed:'Concluído',cancelled:'Cancelado',pending:'Pendente'};
  const pay={unpaid:'Não pago',submitted:'Em validação',confirmed:'Pago',rejected:'Rejeitado'};
  const delivery={pending:'A preparar',preparing:'Em preparação',ready:'Pronto',out_for_delivery:'Em entrega',delivered:'Entregue',picked_up:'Levantado',cancelled:'Cancelado'};

  function show(t,type='info'){const n=document.getElementById('order-message');if(!n)return;n.textContent=t;n.dataset.type=type;n.hidden=false;}
  async function loadFiles(orderId){
    const r=await db().from('order_files').select('id,file_name,file_path,file_type,mime_type,file_size,note,created_at').eq('order_id',orderId).eq('customer_id',session.user.id).order('created_at',{ascending:false});
    if(r.error){console.error(r.error);return[];}
    return Promise.all((r.data||[]).map(async f=>{const s=await db().storage.from('order-files').createSignedUrl(f.file_path,3600);return {...f,url:s.data?.signedUrl||''};}));
  }
  function fileUploadBlock(o,files){
    const canUpload=o.status!=='cancelled'&&o.status!=='completed';
    return '<section class="panel-card order-block"><h2>Ficheiros do pedido</h2><p class="admin-section-note">Envie artes finais, referências ou outros ficheiros necessários para produção. Máximo: 16 MB por ficheiro.</p>'+
      (canUpload?'<div class="file-upload-box"><div class="field-row field-two"><div><label>Tipo<select id="order-file-type"><option value="artwork">Arte / ficheiro para produção</option><option value="reference">Referência</option><option value="other">Outro</option></select></label></div><div><label>Observação<input id="order-file-note" placeholder="Ex.: versão final aprovada"></label></div></div><input id="order-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.zip,.doc,.docx,.xls,.xlsx"><button class="btn btn-primary" type="button" id="order-file-upload">Enviar ficheiro</button><small class="file-upload-hint">Formatos aceites: PDF, imagens, ZIP, Word e Excel.</small></div>':'')+
      '<div class="order-file-list">'+(files.map(f=>'<div class="order-file-row"><div><strong>'+esc(f.file_name)+'</strong><small>'+esc(f.file_type)+' · '+esc(f.note||'')+'</small></div><small>'+esc(f.file_size?Math.round(f.file_size/1024)+' KB':'')+'</small>'+(f.url?'<a class="btn btn-secondary btn-small" target="_blank" rel="noreferrer" href="'+esc(f.url)+'">Abrir</a>':'<span>Indisponível</span>')+'</div>').join('')||'<p>Ainda não existem ficheiros.</p>')+'</div></section>';
  }
  async function uploadFile(orderId){
    const input=document.getElementById('order-file-input'),file=input?.files?.[0];
    if(!file){show('Escolha um ficheiro.','error');return;}
    if(file.size>16*1024*1024){show('O ficheiro deve ter no máximo 16 MB.','error');return;}
    const allowed=['application/pdf','image/jpeg','image/png','image/webp','application/zip','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if(!allowed.includes(file.type)){show('Formato de ficheiro não suportado.','error');return;}
    const safe=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'ficheiro';
    const path=session.user.id+'/'+orderId+'/'+crypto.randomUUID()+'-'+safe;
    const up=await db().storage.from('order-files').upload(path,file,{upsert:false,cacheControl:'3600',contentType:file.type});
    if(up.error){console.error(up.error);show('Não foi possível carregar o ficheiro.','error');return;}
    const row=await db().from('order_files').insert({order_id:orderId,customer_id:session.user.id,file_type:document.getElementById('order-file-type')?.value||'other',file_name:file.name,file_path:path,mime_type:file.type,file_size:file.size,note:document.getElementById('order-file-note')?.value.trim()||null}).select('id').single();
    if(row.error){await db().storage.from('order-files').remove([path]);console.error(row.error);show('O ficheiro foi carregado, mas não foi possível associá-lo ao pedido.','error');return;}
    show('Ficheiro enviado com sucesso.','success');await reloadOrder(orderId);
  }
  async function cancelOrder(orderId){
    if(!confirm('Tem a certeza que deseja cancelar este pedido?'))return;
    const reason=prompt('Motivo do cancelamento (opcional):')||null;
    const r=await db().rpc('customer_cancel_order',{p_order_id:orderId,p_reason:reason});
    if(r.error){show(r.error.message?.includes('ORDER_CANNOT')?'Este pedido já não pode ser cancelado.':'Não foi possível cancelar o pedido.','error');return;}
    show('Pedido cancelado.','success');await reloadOrder(orderId);
  }
  async function reorderItems(items){
    const ids=[...new Set(items.map(x=>x.service_id))];const r=await db().from('services').select('id,name,slug,category,description,image_url,features,unit_price,currency,item_type,sku,unit_label,stock_quantity,is_active').in('id',ids).eq('is_active',true);
    if(r.error){show('Não foi possível preparar a repetição do pedido.','error');return;}
    let added=0;(items||[]).forEach(i=>{const s=(r.data||[]).find(x=>x.id===i.service_id);if(s&&cart()){cart().add(s,Number(i.quantity)||1,i.specifications||{});added++;}});
    if(added)location.href='carrinho.html';else show('Os itens deste pedido já não estão disponíveis.','error');
  }
  async function reloadOrder(id){
    const r=await db().from('orders').select('id,order_number,status,total,subtotal,currency,payment_method,payment_status,payment_reference,payment_note,delivery_method,delivery_zone_id,delivery_fee,delivery_address,delivery_contact,delivery_notes,delivery_status,delivered_at,admin_note,created_at,updated_at,order_items(service_id,service_name,quantity,unit_price,line_total,specifications,item_type,unit_label,sku)').eq('id',id).eq('customer_id',session.user.id).maybeSingle();
    if(r.error||!r.data){show('Pedido não encontrado.','error');return;}currentOrder=r.data;await render(r.data);
  }
  async function render(o){
    const root=document.getElementById('order-detail');if(!root)return;const items=o.order_items||[],files=await loadFiles(o.id);
    const zone=o.delivery_zone_id?await db().from('delivery_zones').select('name').eq('id',o.delivery_zone_id).maybeSingle():{data:null};
    const docs=await db().from('documents').select('id,document_type,document_number,status,amount,currency,issue_date').eq('order_id',o.id).order('created_at');
    const quotes=await db().from('quotes').select('id,amount,currency,status,notes,valid_until').eq('order_id',o.id).maybeSingle();
    const itemRows=items.map(i=>'<tr><td>'+esc(i.service_name)+'</td><td>'+esc(i.item_type==='material'?'Material':'Serviço')+'</td><td>'+esc(i.quantity)+' '+esc(i.unit_label||'unidade')+'</td><td>'+esc(money(i.unit_price,o.currency))+'</td><td>'+esc(money(i.line_total,o.currency))+'</td></tr>').join('');
    const canCancel=['pending','pending_payment','pending_quote'].includes(o.status)&&o.payment_status!=='confirmed';
    let html='<div class="order-detail-head"><div><span class="eyebrow">Pedido</span><h1>'+esc(o.order_number)+'</h1><p>Criado em '+new Date(o.created_at).toLocaleString('pt-PT')+'</p></div><div class="card-actions"><span class="payment-status-badge payment-status-'+(o.payment_status==='confirmed'?'paid':o.payment_status==='submitted'?'awaiting':o.payment_status==='rejected'?'rejected':'pending')+'">'+esc(pay[o.payment_status]||'Não pago')+'</span>'+(canCancel?'<button class="btn btn-secondary btn-small" type="button" id="cancel-order-btn">Cancelar pedido</button>':'')+'<button class="btn btn-primary btn-small" type="button" id="reorder-btn">Comprar novamente</button></div></div>';
    html+='<section class="panel-card order-block"><h2>Itens do pedido</h2><div class="table-responsive"><table class="order-items-table"><thead><tr><th>Item</th><th>Tipo</th><th>Quantidade</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>'+itemRows+'</tbody></table><div class="document-total"><span>Subtotal</span><strong>'+esc(money(o.subtotal,o.currency))+'</strong><span>Entrega</span><strong>'+esc(money(o.delivery_fee,o.currency))+'</strong><span>Total</span><strong>'+esc(money(o.total,o.currency))+'</strong></div></div></section>';
    html+='<div class="order-detail-grid"><section class="panel-card"><h2>Estado</h2><div class="detail-list"><div><span>Pedido</span><strong>'+esc(status[o.status]||o.status)+'</strong></div><div><span>Pagamento</span><strong>'+esc(pay[o.payment_status]||o.payment_status)+'</strong></div></div></section><section class="panel-card"><h2>Entrega / levantamento</h2><div class="detail-list"><div><span>Método</span><strong>'+esc(o.delivery_method==='delivery'?'Entrega':'Levantamento')+'</strong></div><div><span>Zona</span><strong>'+esc(zone.data?.name||'—')+(o.delivery_method==='delivery'?' · '+esc(money(o.delivery_fee,o.currency)):'')+'</strong></div><div><span>Estado</span><strong>'+esc(delivery[o.delivery_status]||o.delivery_status)+'</strong></div><div><span>Contacto</span><strong>'+esc(o.delivery_contact||'—')+'</strong></div><div><span>Morada</span><strong>'+esc(o.delivery_address||'—')+'</strong></div></div></section></div>';
    html+='<section class="panel-card order-block"><h2>Documentos</h2><div class="order-document-list">'+((docs.data||[]).map(d=>'<div><span>'+esc(d.document_type==='proforma'?'Factura Proforma':'Factura')+'</span><strong>'+esc(d.document_number)+'</strong><a class="btn btn-secondary btn-small" href="documento.html?id='+encodeURIComponent(d.id)+'">Abrir</a></div>').join('')||'<p>Ainda não existem documentos emitidos.</p>')+'</div></section>';
    if(o.total!==null&&Number(o.total)>0&&o.payment_status!=='confirmed'&&o.status!=='cancelled')html+='<section class="panel-card order-block"><h2>Pagamento</h2><p>O pagamento desta encomenda é feito por transferência bancária. Depois, envie o comprovativo pela plataforma.</p><a class="btn btn-primary" href="pagamento.html?order='+encodeURIComponent(o.id)+'">Pagar e enviar comprovativo</a></section>';
    if(quotes.data)html+='<section class="panel-card order-block"><h2>Orçamento</h2><div class="detail-list"><div><span>Valor</span><strong>'+esc(money(quotes.data.amount,quotes.data.currency))+'</strong></div><div><span>Estado</span><strong>'+esc(quotes.data.status)+'</strong></div></div><a class="btn btn-secondary" href="orcamentos.html">Abrir orçamentos</a></section>';
    html+=fileUploadBlock(o,files);
    root.innerHTML=html;
    document.getElementById('order-file-upload')?.addEventListener('click',()=>uploadFile(o.id));
    document.getElementById('cancel-order-btn')?.addEventListener('click',()=>cancelOrder(o.id));
    document.getElementById('reorder-btn')?.addEventListener('click',()=>reorderItems(items));
  }
  async function init(){
    session=(await db().auth.getSession()).data?.session;if(!session){location.href='auth.html';return;}
    const id=new URLSearchParams(location.search).get('order')||sessionStorage.getItem('mukwatela-last-order-id');if(!id){show('Nenhum pedido selecionado.','error');return;}
    await reloadOrder(id);
    db().channel('order-detail-'+id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders',filter:'id=eq.'+id},()=>reloadOrder(id)).on('postgres_changes',{event:'*',schema:'public',table:'order_files',filter:'order_id=eq.'+id},()=>reloadOrder(id)).subscribe();
  }
  document.addEventListener('DOMContentLoaded',init);
})();