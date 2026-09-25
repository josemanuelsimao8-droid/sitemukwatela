(() => {
  const db=()=>window.supabaseClient;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'Sob orçamento':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const quoteLabels={draft:'Em análise',sent:'Enviado',accepted:'Aceite',rejected:'Rejeitado',expired:'Expirado'};
  const deliveryLabels={pending:'A preparar',preparing:'Em preparação',ready:'Pronto',out_for_delivery:'Em entrega',delivered:'Entregue',picked_up:'Levantado',cancelled:'Cancelado'};
  const state={quotes:[],docs:[],orders:[],payments:[],from:null,to:null};

  function msg(text,type='info'){
    const n=document.getElementById('admin-message');if(!n)return;n.textContent=text;n.dataset.type=type;n.hidden=false;
  }
  async function isAdmin(){
    const s=(await db().auth.getSession()).data?.session;if(!s)return false;
    const r=await db().from('profiles').select('role').eq('id',s.user.id).maybeSingle();
    return r.data?.role==='admin';
  }

  async function loadQuotes(){
    const r=await db().from('quotes').select('id,order_id,customer_id,amount,currency,status,notes,valid_until,created_at,updated_at').order('created_at',{ascending:false});
    if(r.error){msg('Não foi possível carregar orçamentos.','error');return;}
    const ids=[...new Set((r.data||[]).map(x=>x.order_id))], cids=[...new Set((r.data||[]).map(x=>x.customer_id))];
    let orders=[],profiles=[],items=[];
    if(ids.length){const x=await db().from('orders').select('id,order_number').in('id',ids);orders=x.data||[];const y=await db().from('order_items').select('order_id,service_name,item_type').in('order_id',ids);items=y.data||[];}
    if(cids.length){const x=await db().from('profiles').select('id,full_name').in('id',cids);profiles=x.data||[];}
    const om=Object.fromEntries(orders.map(x=>[x.id,x])),pm=Object.fromEntries(profiles.map(x=>[x.id,x])),im={};
    items.forEach(x=>{im[x.order_id]={name:x.service_name,type:x.item_type}});
    state.quotes=(r.data||[]).map(x=>({...x,order_number:om[x.order_id]?.order_number||'—',customer_name:pm[x.customer_id]?.full_name||'Cliente',service_name:im[x.order_id]?.name||'Item',item_type:im[x.order_id]?.type||'service'}));
    renderQuotes();
  }
  function renderQuotes(){
    const root=document.getElementById('admin-quotes-list');if(!root)return;
    const q=(document.getElementById('admin-quotes-search')?.value||'').toLowerCase().trim();
    const s=document.getElementById('admin-quotes-status')?.value||'';
    const rows=state.quotes.filter(x=>(!q||[x.order_number,x.customer_name,x.service_name].join(' ').toLowerCase().includes(q))&&(!s||x.status===s));
    root.innerHTML=rows.map(x=>'<article class="ops-admin-card"><div class="ops-admin-head"><div><span class="editor-kicker">'+esc(x.order_number)+'</span><h3>'+esc(x.customer_name)+'</h3><small>'+esc(x.service_name)+'</small></div><span class="admin-chip '+(x.status==='sent'?'chip-on':'chip-off')+'">'+esc(quoteLabels[x.status]||x.status)+'</span></div><div class="field-two cms-field-grid"><div><label>Valor (AOA)</label><input type="number" min="0" step="0.01" data-quote="'+x.id+'" data-field="amount" value="'+(x.amount??'')+'"></div><div><label>Validade</label><input type="date" data-quote="'+x.id+'" data-field="valid_until" value="'+esc(x.valid_until||'')+'"></div><div><label>Estado</label><select data-quote="'+x.id+'" data-field="status"><option value="draft" '+(x.status==='draft'?'selected':'')+'>Em análise</option><option value="sent" '+(x.status==='sent'?'selected':'')+'>Enviar ao cliente</option><option value="rejected" '+(x.status==='rejected'?'selected':'')+'>Rejeitado</option><option value="expired" '+(x.status==='expired'?'selected':'')+'>Expirado</option><option value="accepted" '+(x.status==='accepted'?'selected':'')+'>Aceite</option></select></div></div><div class="field-row"><label>Mensagem / observações</label><textarea data-quote="'+x.id+'" data-field="notes" rows="3">'+esc(x.notes||'')+'</textarea></div><div class="inline-action-row"><span><strong>Valor atual:</strong> '+esc(money(x.amount,x.currency))+'</span><button class="btn btn-primary" type="button" data-save-quote="'+x.id+'">Guardar orçamento</button></div></article>').join('')||'<div class="operations-empty">Sem orçamentos encontrados.</div>';
    root.querySelectorAll('[data-save-quote]').forEach(b=>b.addEventListener('click',()=>saveQuote(b.dataset.saveQuote)));
  }
  async function saveQuote(id){
    const root=document.getElementById('admin-quotes-list');
    const fields=[...root.querySelectorAll('[data-quote="'+id+'"]')];
    const value=name=>fields.find(x=>x.dataset.field===name)?.value||'';
    const status=value('status'), amount=value('amount')===''?null:Number(value('amount'));
    const r=await db().rpc('admin_set_quote',{p_quote_id:id,p_amount:amount,p_status:status,p_notes:value('notes')||null,p_valid_until:value('valid_until')||null});
    if(r.error){msg('Não foi possível guardar o orçamento.','error');return;}
    msg(status==='sent'?'Orçamento enviado ao cliente.':'Orçamento atualizado.','success');loadQuotes();
  }

  async function loadDocs(){
    const r=await db().from('documents').select('id,order_id,customer_id,document_type,document_number,amount,currency,status,issue_date,created_at').order('created_at',{ascending:false}).limit(300);
    if(r.error){msg('Não foi possível carregar documentos.','error');return;}
    const ids=[...new Set((r.data||[]).map(x=>x.order_id))],cids=[...new Set((r.data||[]).map(x=>x.customer_id))];
    const [o,p]=await Promise.all([
      ids.length?db().from('orders').select('id,order_number').in('id',ids):Promise.resolve({data:[]}),
      cids.length?db().from('profiles').select('id,full_name').in('id',cids):Promise.resolve({data:[]})
    ]);
    const om=Object.fromEntries((o.data||[]).map(x=>[x.id,x])),pm=Object.fromEntries((p.data||[]).map(x=>[x.id,x]));
    state.docs=(r.data||[]).map(x=>({...x,order_number:om[x.order_id]?.order_number||'—',customer_name:pm[x.customer_id]?.full_name||'Cliente'}));
    renderDocs();
  }
  function renderDocs(){
    const root=document.getElementById('admin-documents-list');if(!root)return;
    const q=(document.getElementById('admin-documents-search')?.value||'').toLowerCase().trim(),t=document.getElementById('admin-documents-type')?.value||'';
    const rows=state.docs.filter(x=>(!q||[x.document_number,x.order_number,x.customer_name].join(' ').toLowerCase().includes(q))&&(!t||x.document_type===t));
    root.innerHTML=rows.map(x=>'<article class="ops-admin-row"><div><span class="editor-kicker">'+esc(x.document_type==='proforma'?'Factura Proforma':'Factura')+'</span><strong>'+esc(x.document_number)+'</strong><small>'+esc(x.customer_name)+' · '+esc(x.order_number)+'</small></div><div><strong>'+esc(money(x.amount,x.currency))+'</strong><small>'+esc(new Date(x.issue_date).toLocaleDateString('pt-PT'))+'</small></div><a class="btn btn-secondary btn-small" href="documento.html?id='+encodeURIComponent(x.id)+'">Abrir</a></article>').join('')||'<div class="operations-empty">Sem documentos encontrados.</div>';
  }

  async function loadDelivery(){
    const r=await db().from('orders').select('id,order_number,customer_id,status,total,currency,delivery_method,delivery_zone_id,delivery_fee,delivery_address,delivery_contact,delivery_status,delivery_notes,updated_at,profiles(full_name),order_items(service_name,item_type)').order('updated_at',{ascending:false}).limit(300);
    if(r.error){msg('Não foi possível carregar entregas.','error');return;}
    state.orders=r.data||[];renderDelivery();
  }
  function renderDelivery(){
    const root=document.getElementById('admin-delivery-list');if(!root)return;
    const q=(document.getElementById('admin-delivery-search')?.value||'').toLowerCase().trim(),s=document.getElementById('admin-delivery-status')?.value||'';
    const rows=state.orders.filter(x=>(!q||[x.order_number,x.profiles?.full_name,x.delivery_address,x.delivery_contact].join(' ').toLowerCase().includes(q))&&(!s||x.delivery_status===s));
    root.innerHTML=rows.map(x=>'<article class="ops-admin-card"><div class="ops-admin-head"><div><span class="editor-kicker">'+esc(x.order_number)+'</span><h3>'+esc(x.profiles?.full_name||'Cliente')+'</h3><small>'+esc((x.order_items?.[0]?.item_type==='material'?'Material: ':'Serviço: ')+(x.order_items?.[0]?.service_name||'Item'))+'</small></div><span class="admin-chip">'+esc(x.delivery_method==='delivery'?'Entrega':'Levantamento')+'</span></div><div class="field-two cms-field-grid"><div><label>Estado da entrega</label><select data-delivery="'+x.id+'"><option value="pending" '+(x.delivery_status==='pending'?'selected':'')+'>A preparar</option><option value="preparing" '+(x.delivery_status==='preparing'?'selected':'')+'>Em preparação</option><option value="ready" '+(x.delivery_status==='ready'?'selected':'')+'>Pronto</option><option value="out_for_delivery" '+(x.delivery_status==='out_for_delivery'?'selected':'')+'>Em entrega</option><option value="delivered" '+(x.delivery_status==='delivered'?'selected':'')+'>Entregue</option><option value="picked_up" '+(x.delivery_status==='picked_up'?'selected':'')+'>Levantado</option><option value="cancelled" '+(x.delivery_status==='cancelled'?'selected':'')+'>Cancelado</option></select></div><div><label>Contacto</label><input readonly value="'+esc(x.delivery_contact||'')+'"></div></div><div class="delivery-meta"><span><strong>Morada:</strong> '+esc(x.delivery_address||'Levantamento na Mukwatela')+'</span><span><strong>Valor:</strong> '+esc(money(x.total,x.currency))+'</span></div></article>').join('')||'<div class="operations-empty">Sem entregas/levantamentos encontrados.</div>';
    root.querySelectorAll('[data-delivery]').forEach(n=>n.addEventListener('change',async()=>updateDelivery(n.dataset.delivery,n.value)));
  }
  async function updateDelivery(id,status){
    const r=await db().rpc('admin_update_order',{p_order_id:id,p_delivery_status:status,p_admin_note:null});
    if(r.error){msg('Não foi possível atualizar a entrega.','error');return;}
    msg('Estado de entrega atualizado.','success');loadDelivery();
  }

  async function loadReports(){
    const days=Number(document.getElementById('report-period')?.value||30);
    const from=new Date(Date.now()-days*86400000).toISOString();
    const [o,p,s]=await Promise.all([
      db().from('orders').select('id,total,payment_status,status,created_at,order_items(service_name,quantity)').gte('created_at',from),
      db().from('payments').select('amount,status,created_at').gte('created_at',from),
      db().from('services').select('id,name')
    ]);
    const orders=o.data||[],payments=p.data||[];
    const paid=payments.filter(x=>x.status==='paid'),revenue=paid.reduce((sum,x)=>sum+Number(x.amount||0),0);
    const serviceCount={};orders.forEach(x=>(x.order_items||[]).forEach(i=>{serviceCount[i.service_name]=(serviceCount[i.service_name]||0)+Number(i.quantity||0)}));
    const statusCount={};orders.forEach(x=>{statusCount[x.status]=(statusCount[x.status]||0)+1});
    document.getElementById('admin-report-grid').innerHTML='<article class="summary-card"><span>Pedidos</span><strong>'+orders.length+'</strong></article><article class="summary-card"><span>Pagamentos pagos</span><strong>'+paid.length+'</strong></article><article class="summary-card"><span>Receita</span><strong>'+esc(money(revenue))+'</strong></article><article class="summary-card"><span>Ticket médio pago</span><strong>'+esc(money(paid.length?revenue/paid.length:0))+'</strong></article>';
    const top=Object.entries(serviceCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
    document.getElementById('report-services').innerHTML=top.map(x=>'<div><span>'+esc(x[0])+'</span><strong>'+x[1]+'</strong></div>').join('')||'<p>Sem dados.</p>';
    document.getElementById('report-statuses').innerHTML=Object.entries(statusCount).sort((a,b)=>b[1]-a[1]).map(x=>'<div><span>'+esc(x[0])+'</span><strong>'+x[1]+'</strong></div>').join('')||'<p>Sem dados.</p>';
  }

  function bind(){
    ['admin-quotes-search','admin-quotes-status'].forEach(id=>document.getElementById(id)?.addEventListener(id.endsWith('search')?'input':'change',renderQuotes));
    ['admin-documents-search','admin-documents-type'].forEach(id=>document.getElementById(id)?.addEventListener(id.endsWith('search')?'input':'change',renderDocs));
    ['admin-delivery-search','admin-delivery-status'].forEach(id=>document.getElementById(id)?.addEventListener(id.endsWith('search')?'input':'change',renderDelivery));
    document.getElementById('report-period')?.addEventListener('change',loadReports);
  }

  async function init(){
    if(!db()||!await isAdmin())return;
    bind();
    await Promise.all([loadQuotes(),loadDocs(),loadDelivery(),loadReports()]);
    db().channel('mukwatela-admin-operations-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'quotes'},loadQuotes)
      .on('postgres_changes',{event:'*',schema:'public',table:'documents'},()=>{loadDocs();loadReports();})
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>{loadDelivery();loadReports();})
      .on('postgres_changes',{event:'*',schema:'public',table:'payments'},loadReports)
      .subscribe();
  }
  document.addEventListener('DOMContentLoaded',init);
})();