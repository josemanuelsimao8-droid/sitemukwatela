(() => {
  const db = () => window.supabaseClient;
  const filters = {
    overviewSearch:'', overviewStatus:'',
    clientsSearch:'', clientsRole:'',
    ordersSearch:'', ordersStatus:'', ordersPayment:'',
    servicesSearch:'', servicesType:'', servicesCategory:'', servicesActive:'',
    mediaSearch:'', mediaType:'', mediaActive:'',
    contentSearch:'', contentPage:'', contentSection:'',
    paymentsSearch:'', paymentsActive:'', settingsSearch:''
  };
  const cache = { clients:[], orders:[], services:[], media:[], content:[], payments:[], settings:[] };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const money = (value, currency='AOA') => value === null || value === undefined || value === '' ? 'Sob orçamento' : String(currency) + ' ' + Number(value).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtDate = (value) => value ? new Date(value).toLocaleString('pt-PT') : '—';

  function msg(text,type='info'){
    const node=document.getElementById('admin-message');
    if(!node)return;
    node.textContent=text;
    node.dataset.type=type;
    node.hidden=false;
  }

  async function appRole(userId){
    const role=await db().from('user_roles').select('role').eq('user_id',userId).maybeSingle();
    if(!role.error && role.data?.role)return role.data.role;
    const profile=await db().from('profiles').select('role').eq('id',userId).maybeSingle();
    return profile.data?.role||'customer';
  }

  async function requireAdmin(){
    const session=(await db().auth.getSession()).data?.session;
    if(!session){window.location.href='auth.html';return null;}
    const role=await appRole(session.user.id);
    if(role!=='admin'){window.location.href='dashboard.html';return null;}
    return session;
  }

  function filtered(list, search, fields){
    const term=String(search||'').trim().toLowerCase();
    if(!term)return list;
    return list.filter(item=>fields.some(field=>String(field(item)??'').toLowerCase().includes(term)));
  }

  async function loadOverview(){
    const [clients,orders,paid,services]=await Promise.all([
      db().from('profiles').select('id,role'),
      db().from('orders').select('id,order_number,total,payment_status,status,created_at').order('created_at',{ascending:false}).limit(100),
      db().from('orders').select('id,total').eq('payment_status','confirmed'),
      db().from('services').select('id').eq('is_active',true)
    ]);
    const customerCount=(clients.data||[]).filter(item=>item.role!=='admin').length;
    document.getElementById('admin-customers').textContent=String(customerCount);
    document.getElementById('admin-orders').textContent=String(orders.data?.length||0);
    document.getElementById('admin-payments').textContent=String(paid.data?.length||0);
    document.getElementById('admin-services-active').textContent=String(services.data?.length||0);
    document.getElementById('admin-revenue').textContent=money((paid.data||[]).reduce((sum,row)=>sum+Number(row.total||0),0));
    document.getElementById('admin-pending').textContent=String((orders.data||[]).filter(row=>['pending','pending_payment','pending_quote','processing'].includes(row.status)).length);
    cache.orders=orders.data||[];
    renderOverview();
  }

  function renderOverview(){
    const body=document.getElementById('admin-order-table');
    if(!body)return;
    const data=filtered(cache.orders,filters.overviewSearch,[x=>x.order_number,x=>x.id,x=>x.status,x=>x.payment_status]).filter(x=>!filters.overviewStatus||x.status===filters.overviewStatus).slice(0,12);
    body.innerHTML=data.map(order=>'<tr><td>'+esc(order.order_number||order.id.slice(0,8))+'</td><td>'+esc(order.status)+'</td><td>'+esc(order.payment_status)+'</td><td>'+money(order.total)+'</td><td>'+fmtDate(order.created_at)+'</td></tr>').join('')||'<tr><td colspan="5">Sem pedidos encontrados.</td></tr>';
  }

  async function loadClients(){
    const result=await db().from('profiles').select('id,full_name,phone,company,role,created_at').order('created_at',{ascending:false});
    if(result.error){msg('Não foi possível carregar clientes.','error');return;}
    cache.clients=result.data||[];
    renderClients();
  }

  function renderClients(){
    const body=document.getElementById('admin-clients-table');
    if(!body)return;
    const data=filtered(cache.clients,filters.clientsSearch,[x=>x.full_name,x=>x.phone,x=>x.company,x=>x.role]).filter(x=>!filters.clientsRole||x.role===filters.clientsRole);
    body.innerHTML=data.map(client=>'<tr><td>'+esc(client.full_name)+'</td><td>'+esc(client.company||'—')+'</td><td>'+esc(client.phone||'—')+'</td><td>'+esc(client.role)+'</td><td>'+fmtDate(client.created_at)+'</td></tr>').join('')||'<tr><td colspan="5">Sem resultados.</td></tr>';
  }

  async function loadOrders(){
    const result=await db().from('orders').select('id,order_number,customer_id,status,total,currency,payment_method,payment_status,created_at,profiles(full_name),order_items(service_name,quantity),payments(id,status)').order('created_at',{ascending:false}).limit(250);
    if(result.error){msg('Não foi possível carregar pedidos.','error');return;}
    cache.orders=result.data||[];
    renderOrders();
  }

  function renderOrders(){
    const body=document.getElementById('admin-all-orders');
    if(!body)return;
    const data=filtered(cache.orders,filters.ordersSearch,[x=>x.order_number,x=>x.profiles?.full_name,x=>x.order_items?.map(i=>i.service_name).join(' '),x=>x.payment_method,x=>x.status,x=>x.payment_status])
      .filter(x=>!filters.ordersStatus||x.status===filters.ordersStatus)
      .filter(x=>!filters.ordersPayment||x.payment_status===filters.ordersPayment);

    body.innerHTML=data.map(order=>{
      const item=order.order_items?.[0];
      const payment=order.payment_method==='multicaixa_express'?'Multicaixa Express':order.payment_method==='transferencia'?'Transferência':'—';
      const paymentId = order.payments?.[0]?.id || '';
      return '<tr><td>'+esc(order.order_number)+'</td><td>'+esc(order.profiles?.full_name||'Cliente')+'</td><td>'+esc(item?.service_name||'Serviço')+'</td><td>'+money(order.total,order.currency)+'</td><td>'+esc(payment)+'</td>' +
        '<td><select data-order-status="'+order.id+'"><option value="pending_payment" '+(order.status==='pending_payment'?'selected':'')+'>A aguardar pagamento</option><option value="pending_quote" '+(order.status==='pending_quote'?'selected':'')+'>A aguardar orçamento</option><option value="processing" '+(order.status==='processing'?'selected':'')+'>Em processamento</option><option value="completed" '+(order.status==='completed'?'selected':'')+'>Concluído</option><option value="cancelled" '+(order.status==='cancelled'?'selected':'')+'>Cancelado</option></select></td>' +
        '<td><select data-payment-status="'+order.id+'" data-payment-id="'+paymentId+'" '+(paymentId?'':'disabled title="Sem pagamento associado"')+'><option value="unpaid" '+(order.payment_status==='unpaid'?'selected':'')+'>Não pago</option><option value="submitted" '+(order.payment_status==='submitted'?'selected':'')+'>Comprovativo enviado</option><option value="confirmed" '+(order.payment_status==='confirmed'?'selected':'')+'>Confirmado</option><option value="rejected" '+(order.payment_status==='rejected'?'selected':'')+'>Rejeitado</option></select></td></tr>';
    }).join('')||'<tr><td colspan="7">Sem pedidos encontrados.</td></tr>';

    body.querySelectorAll('[data-order-status]').forEach(node=>node.addEventListener('change',()=>updateOrderStatus(node.dataset.orderStatus,node.value)));
    body.querySelectorAll('[data-payment-status]').forEach(node=>node.addEventListener('change',()=>updateOrderPayment(node.dataset.paymentId,node.value)));
  }

  async function updateOrderStatus(id,status){
    const result=await db().rpc('admin_update_order',{p_order_id:id,p_status:status,p_payment_status:null,p_delivery_status:null,p_admin_note:null});
    if(result.error){msg('Não foi possível atualizar o estado do pedido.','error');return;}
    msg('Estado do pedido atualizado.','success');
    await Promise.all([loadOrders(),loadOverview()]);
  }

  async function updateOrderPayment(paymentId,status){
    if(!paymentId){msg('Este pedido ainda não tem um registo de pagamento.','error');return;}
    const result=await db().rpc('admin_set_payment_status',{
      p_payment_id:paymentId,
      p_status:status==='confirmed'?'paid':status==='rejected'?'rejected':status==='submitted'?'awaiting_confirmation':status==='unpaid'?'pending':'processing',
      p_note:null
    });
    if(result.error){msg('Não foi possível atualizar o pagamento.','error');return;}
    msg('Pagamento atualizado. Documentos e notificações foram sincronizados.','success');
    await Promise.all([loadOrders(),loadOverview()]);
  }

  async function updateOrder(id,patch){
    const result=await db().from('orders').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);
    if(result.error){msg('Não foi possível atualizar o pedido.','error');return;}
    msg('Pedido atualizado.','success');
    await Promise.all([loadOrders(),loadOverview()]);
  }

  async function loadServices(){
    const result=await db().from('services').select('id,name,slug,category,description,image_url,features,unit_price,currency,is_active,sort_order,updated_at,item_type,sku,unit_label,stock_quantity,low_stock_threshold,is_featured').order('sort_order',{ascending:true});
    if(result.error){msg('Não foi possível carregar serviços.','error');return;}
    cache.services=result.data||[];
    fillServiceCategoryFilter();
    renderServices();
  }

  function fillServiceCategoryFilter(){
    const node=document.getElementById('services-category-filter');
    if(!node)return;
    const typeNode=document.getElementById('services-type-filter');
    if(typeNode) typeNode.value=filters.servicesType;
    const categories=[...new Set(cache.services.map(x=>x.category).filter(Boolean))].sort();
    node.innerHTML='<option value="">Todas as categorias</option>'+categories.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    node.value=filters.servicesCategory;
  }

  function renderServices(){
    const list=document.getElementById('admin-services-list');
    if(!list)return;
    const data=filtered(cache.services,filters.servicesSearch,[x=>x.name,x=>x.slug,x=>x.category,x=>x.description,x=>x.image_url,x=>x.sku])
      .filter(x=>!filters.servicesType||x.item_type===filters.servicesType)
      .filter(x=>!filters.servicesCategory||x.category===filters.servicesCategory)
      .filter(x=>!filters.servicesActive||String(x.is_active)===filters.servicesActive);
    list.innerHTML=data.map(serviceEditor).join('')||'<p>Sem itens encontrados.</p>';
    bindServiceEvents();
  }

  function serviceEditor(service){
    const features=Array.isArray(service.features)?service.features.join('\n'):'';
    return '<article class="cms-editor-card"><div class="editor-card-head"><div><span class="editor-kicker">'+esc(service.item_type==='material'?'Material':(service.category||'Serviço'))+'</span><h3>'+esc(service.name)+'</h3></div><span class="admin-chip '+(service.is_active?'chip-on':'chip-off')+'">'+(service.is_active?'Ativo':'Inativo')+'</span></div>' +
      '<div class="field-two cms-field-grid"><div><label>Tipo</label><select data-service="'+service.id+'" data-field="item_type"><option value="service" '+(service.item_type!=='material'?'selected':'')+'>Serviço</option><option value="material" '+(service.item_type==='material'?'selected':'')+'>Material</option></select></div><div><label>Nome</label><input data-service="'+service.id+'" data-field="name" value="'+esc(service.name)+'"></div><div><label>Categoria</label><input data-service="'+service.id+'" data-field="category" value="'+esc(service.category||'')+'"></div><div><label>SKU / Referência</label><input data-service="'+service.id+'" data-field="sku" value="'+esc(service.sku||'')+'"></div><div><label>Slug</label><input data-service="'+service.id+'" data-field="slug" value="'+esc(service.slug||'')+'"></div><div><label>Preço (AOA)</label><input type="number" min="0" step="0.01" data-service="'+service.id+'" data-field="unit_price" value="'+(service.unit_price??'')+'"></div><div><label>Moeda</label><input data-service="'+service.id+'" data-field="currency" value="'+esc(service.currency||'AOA')+'"></div><div><label>Unidade de venda</label><input data-service="'+service.id+'" data-field="unit_label" value="'+esc(service.unit_label||'unidade')+'" placeholder="unidade, caixa, metro, resma..."></div><div><label>Stock disponível</label><input type="number" min="0" step="0.01" data-service="'+service.id+'" data-field="stock_quantity" value="'+(service.stock_quantity??'')+'" placeholder="Vazio = não controlar"></div><div><label>Alerta de stock baixo</label><input type="number" min="0" step="0.01" data-service="'+service.id+'" data-field="low_stock_threshold" value="'+(service.low_stock_threshold??0)+'"></div><div><label>Ordem</label><input type="number" step="1" data-service="'+service.id+'" data-field="sort_order" value="'+(service.sort_order??0)+'"></div></div>' +
      '<div class="field-row"><label>Descrição</label><textarea data-service="'+service.id+'" data-field="description" rows="3">'+esc(service.description||'')+'</textarea></div>' +
      '<div class="field-row"><label>Imagem (caminho ou URL)</label><input data-service="'+service.id+'" data-field="image_url" value="'+esc(service.image_url||'')+'"></div>' +
      '<div class="field-row"><label>Características (uma por linha)</label><textarea data-service="'+service.id+'" data-field="features" rows="3">'+esc(features)+'</textarea></div>' +
      '<div class="inline-action-row"><label class="checkbox-row"><input type="checkbox" data-service="'+service.id+'" data-field="is_featured" '+(service.is_featured?'checked':'')+'> Destaque</label><label class="checkbox-row"><input type="checkbox" data-service="'+service.id+'" data-field="is_active" '+(service.is_active?'checked':'')+'> Publicado no catálogo</label><button class="btn btn-primary" type="button" data-save-service="'+service.id+'">Guardar item</button></div></article>';
  }

  function bindServiceEvents(){
    const list=document.getElementById('admin-services-list');
    list.querySelectorAll('[data-save-service]').forEach(button=>button.addEventListener('click',async()=>{
      const id=button.dataset.saveService;
      const patch={updated_at:new Date().toISOString()};
      list.querySelectorAll('[data-service="'+id+'"]').forEach(field=>{
        const name=field.dataset.field;
        if(name==='features')patch[name]=field.value.split('\n').map(v=>v.trim()).filter(Boolean);
        else if(['unit_price','stock_quantity','low_stock_threshold'].includes(name))patch[name]=field.value===''?null:Number(field.value);
        else if(name==='sort_order')patch[name]=Number(field.value||0);
        else if(['is_active','is_featured'].includes(name))patch[name]=field.checked;
        else patch[name]=field.value.trim();
      });
      const result=await db().from('services').update(patch).eq('id',id);
      if(result.error){msg(result.error.code==='23505'?'A referência/SKU deste item já existe. Use outra.':'Não foi possível guardar o item.','error');return;}
      msg('Item atualizado. O catálogo será atualizado em tempo real.','success');
      await loadServices();
    }));
  }

  async function addService(){
    const result=await db().from('services').insert({name:'Novo item',slug:'novo-item-'+Date.now(),category:'Nova categoria',description:'Descrição do item.',image_url:'',features:[],unit_price:null,currency:'AOA',item_type:'service',sku:null,unit_label:'unidade',stock_quantity:null,low_stock_threshold:0,is_featured:false,is_active:false,sort_order:cache.services.length+1});
    if(result.error){msg(result.error.code==='23505'?'A referência/SKU deste item já existe. Use outra.':'Não foi possível adicionar o item.','error');return;}
    msg('Item criado. Escolha o tipo, preencha os dados e guarde.','success');
    await loadServices();
  }

  async function loadMedia(){
    const result=await db().from('site_media').select('id,media_type,title,category,description,image_url,whatsapp_message,is_active,sort_order,updated_at').order('media_type').order('sort_order');
    if(result.error){msg('Não foi possível carregar as imagens.','error');return;}
    cache.media=result.data||[];
    renderMedia();
  }

  function renderMedia(){
    const list=document.getElementById('admin-media-list');
    if(!list)return;
    const data=filtered(cache.media,filters.mediaSearch,[x=>x.title,x=>x.category,x=>x.description,x=>x.image_url,x=>x.whatsapp_message])
      .filter(x=>!filters.mediaType||x.media_type===filters.mediaType)
      .filter(x=>!filters.mediaActive||String(x.is_active)===filters.mediaActive);
    list.innerHTML=data.map(mediaEditor).join('')||'<p>Sem imagens encontradas.</p>';
    bindMediaEvents();
  }

  function mediaEditor(item){
    return '<article class="media-editor-card"><div class="media-editor-preview">'+(item.image_url?'<img src="'+esc(encodeURI(item.image_url))+'" alt="'+esc(item.title||'Imagem')+'">':'<div class="media-placeholder">Sem imagem</div>')+'</div><div class="media-editor-form">' +
      '<div class="editor-card-head"><div><span class="editor-kicker">'+esc(item.media_type)+'</span><h3>'+esc(item.title||'Imagem')+'</h3></div><span class="admin-chip '+(item.is_active?'chip-on':'chip-off')+'">'+(item.is_active?'Ativo':'Inativo')+'</span></div>' +
      '<div class="field-two cms-field-grid"><div><label>Tipo</label><select data-media="'+item.id+'" data-field="media_type"><option value="hero" '+(item.media_type==='hero'?'selected':'')+'>Hero</option><option value="gallery" '+(item.media_type==='gallery'?'selected':'')+'>Galeria</option><option value="portfolio" '+(item.media_type==='portfolio'?'selected':'')+'>Portfólio</option></select></div><div><label>Categoria</label><input data-media="'+item.id+'" data-field="category" value="'+esc(item.category||'')+'"></div><div><label>Título</label><input data-media="'+item.id+'" data-field="title" value="'+esc(item.title||'')+'"></div><div><label>Ordem</label><input type="number" data-media="'+item.id+'" data-field="sort_order" value="'+(item.sort_order??0)+'"></div></div>' +
      '<div class="field-row"><label>Imagem (caminho ou URL)</label><input data-media="'+item.id+'" data-field="image_url" value="'+esc(item.image_url||'')+'"></div>' +
      '<div class="media-upload-row"><input type="file" accept="image/*" data-media-file="'+item.id+'"><button class="btn btn-secondary" type="button" data-upload-media="'+item.id+'">Carregar imagem</button></div>' +
      '<div class="field-row"><label>Descrição</label><textarea data-media="'+item.id+'" data-field="description" rows="2">'+esc(item.description||'')+'</textarea></div><div class="field-row"><label>Mensagem WhatsApp</label><textarea data-media="'+item.id+'" data-field="whatsapp_message" rows="2">'+esc(item.whatsapp_message||'')+'</textarea></div>' +
      '<div class="inline-action-row"><label class="checkbox-row"><input type="checkbox" data-media="'+item.id+'" data-field="is_active" '+(item.is_active?'checked':'')+'> Publicado</label><div class="card-actions"><button class="btn btn-primary" type="button" data-save-media="'+item.id+'">Guardar</button><button class="btn btn-secondary" type="button" data-delete-media="'+item.id+'">Apagar</button></div></div></div></article>';
  }

  async function uploadMediaFile(id){
    const input=document.querySelector('[data-media-file="'+id+'"]');
    const file=input?.files?.[0];
    if(!file){msg('Escolha uma imagem primeiro.','error');return;}
    if(!file.type.startsWith('image/')){msg('O ficheiro selecionado não é uma imagem.','error');return;}
    if(file.size>8*1024*1024){msg('A imagem deve ter no máximo 8 MB.','error');return;}

    const record=cache.media.find(item=>item.id===id);
    const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-');
    const path=(record?.media_type||'gallery')+'/'+crypto.randomUUID()+'-'+safeName;
    const result=await db().storage.from('site-assets').upload(path,file,{upsert:false,cacheControl:'3600'});
    if(result.error){msg('Não foi possível carregar a imagem.','error');return;}

    const publicUrl=db().storage.from('site-assets').getPublicUrl(path).data.publicUrl;
    const update=await db().from('site_media').update({image_url:publicUrl,updated_at:new Date().toISOString()}).eq('id',id);
    if(update.error){msg('A imagem foi carregada, mas não foi possível associá-la ao site.','error');return;}

    msg('Imagem carregada e publicada no CMS.','success');
    await loadMedia();
  }

  function bindMediaEvents(){
    const list=document.getElementById('admin-media-list');
    list.querySelectorAll('[data-upload-media]').forEach(button=>button.addEventListener('click',()=>uploadMediaFile(button.dataset.uploadMedia)));
    list.querySelectorAll('[data-save-media]').forEach(button=>button.addEventListener('click',async()=>{
      const id=button.dataset.saveMedia;
      const patch={updated_at:new Date().toISOString()};
      list.querySelectorAll('[data-media="'+id+'"]').forEach(field=>{
        const name=field.dataset.field;
        if(name==='is_active')patch[name]=field.checked;
        else if(name==='sort_order')patch[name]=Number(field.value||0);
        else patch[name]=field.value.trim();
      });
      const result=await db().from('site_media').update(patch).eq('id',id);
      if(result.error){msg('Não foi possível guardar a imagem.','error');return;}
      msg('Imagem atualizada. O site será atualizado em tempo real.','success');
      await loadMedia();
    }));
    list.querySelectorAll('[data-delete-media]').forEach(button=>button.addEventListener('click',async()=>{
      if(!window.confirm('Apagar esta imagem do site?'))return;
      const result=await db().from('site_media').delete().eq('id',button.dataset.deleteMedia);
      if(result.error){msg('Não foi possível apagar a imagem.','error');return;}
      msg('Imagem removida.','success');
      await loadMedia();
    }));
  }

  async function addMedia(){
    const result=await db().from('site_media').insert({media_type:'gallery',title:'Nova imagem',category:'',description:'',image_url:'',whatsapp_message:'',is_active:false,sort_order:cache.media.length+1});
    if(result.error){msg('Não foi possível adicionar a imagem.','error');return;}
    msg('Imagem criada. Preencha a imagem e publique.','success');
    await loadMedia();
  }

  async function loadContent(){
    const result=await db().from('site_content').select('id,page,section,field,value,updated_at').order('page').order('section').order('field');
    if(result.error){msg('Não foi possível carregar conteúdos.','error');return;}
    cache.content=result.data||[];
    fillContentFilters();
    renderContent();
  }

  function fillContentFilters(){
    const page=document.getElementById('content-page-filter');
    const section=document.getElementById('content-section-filter');
    if(page)page.innerHTML='<option value="">Todas as páginas</option>'+[...new Set(cache.content.map(x=>x.page))].sort().map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    if(section)section.innerHTML='<option value="">Todas as secções</option>'+[...new Set(cache.content.map(x=>x.section))].sort().map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    if(page)page.value=filters.contentPage;
    if(section)section.value=filters.contentSection;
  }

  function renderContent(){
    const list=document.getElementById('content-admin');
    if(!list)return;
    const data=filtered(cache.content,filters.contentSearch,[x=>x.page,x=>x.section,x=>x.field,x=>x.value]).filter(x=>!filters.contentPage||x.page===filters.contentPage).filter(x=>!filters.contentSection||x.section===filters.contentSection);
    list.innerHTML=data.map(item=>'<article class="cms-editor-card"><div class="editor-card-head"><div><span class="editor-kicker">'+esc(item.page)+' / '+esc(item.section)+'</span><h3>'+esc(item.field)+'</h3></div><small>Atualizado: '+fmtDate(item.updated_at)+'</small></div><div class="field-two cms-field-grid"><div><label>Página</label><input data-content="'+item.id+'" data-field="page" value="'+esc(item.page)+'"></div><div><label>Secção</label><input data-content="'+item.id+'" data-field="section" value="'+esc(item.section)+'"></div></div><div class="field-row"><label>Campo</label><input data-content="'+item.id+'" data-field="field" value="'+esc(item.field)+'"></div><div class="field-row"><label>Texto</label><textarea data-content="'+item.id+'" data-field="value" rows="4">'+esc(item.value||'')+'</textarea></div><div class="card-actions"><button class="btn btn-primary" type="button" data-save-content="'+item.id+'">Guardar conteúdo</button><button class="btn btn-secondary" type="button" data-delete-content="'+item.id+'">Apagar</button></div></article>').join('')||'<p>Sem conteúdos encontrados.</p>';
    bindContentEvents();
  }

  function bindContentEvents(){
    const list=document.getElementById('content-admin');
    list.querySelectorAll('[data-save-content]').forEach(button=>button.addEventListener('click',async()=>{
      const id=button.dataset.saveContent;
      const patch={updated_at:new Date().toISOString(),updated_by:window.currentAdminId};
      list.querySelectorAll('[data-content="'+id+'"]').forEach(field=>patch[field.dataset.field]=field.value.trim());
      const result=await db().from('site_content').update(patch).eq('id',id);
      if(result.error){msg('Não foi possível guardar o conteúdo.','error');return;}
      msg('Conteúdo atualizado. O site será atualizado em tempo real.','success');
      await loadContent();
    }));
    list.querySelectorAll('[data-delete-content]').forEach(button=>button.addEventListener('click',async()=>{
      if(!window.confirm('Apagar este conteúdo?'))return;
      const result=await db().from('site_content').delete().eq('id',button.dataset.deleteContent);
      if(result.error){msg('Não foi possível apagar o conteúdo.','error');return;}
      msg('Conteúdo removido.','success');
      await loadContent();
    }));
  }

  async function addContent(){
    const result=await db().from('site_content').insert({page:'home',section:'novo',field:'novo_campo_'+Date.now(),value:'Novo conteúdo',updated_at:new Date().toISOString(),updated_by:window.currentAdminId});
    if(result.error){msg('Não foi possível adicionar conteúdo.','error');return;}
    msg('Novo conteúdo criado.','success');
    await loadContent();
  }

  async function loadPayments(){
    const result=await db().from('payment_methods').select('id,code,name,description,account_details,instructions,is_active,sort_order,updated_at').order('sort_order');
    if(result.error){msg('Não foi possível carregar métodos de pagamento.','error');return;}
    cache.payments=result.data||[];
    renderPayments();
  }

  function renderPayments(){
    const list=document.getElementById('payment-methods-admin');
    if(!list)return;
    const data=filtered(cache.payments,filters.paymentsSearch,[x=>x.code,x=>x.name,x=>x.description,x=>x.account_details,x=>x.instructions]).filter(x=>!filters.paymentsActive||String(x.is_active)===filters.paymentsActive);
    const addCard='<article class="cms-editor-card payment-add-card"><div class="editor-card-head"><div><span class="editor-kicker">NOVO</span><h3>Adicionar método de pagamento</h3></div><span class="admin-chip chip-off">Não publicado</span></div><div class="field-two cms-field-grid"><div><label>Nome *</label><input id="new-payment-name" placeholder="Ex.: Transferência bancária"></div><div><label>Código *</label><input id="new-payment-code" placeholder="Ex.: transferencia"></div><div><label>Ordem</label><input id="new-payment-order" type="number" value="0" min="0" step="1"></div></div><div class="field-row"><label>Descrição</label><input id="new-payment-description" placeholder="Descrição apresentada ao cliente"></div><div class="field-row"><label>Dados de recebimento</label><textarea id="new-payment-account" rows="3" placeholder="IBAN, titular, conta ou outros dados necessários"></textarea></div><div class="field-row"><label>Instruções</label><textarea id="new-payment-instructions" rows="3" placeholder="Como o cliente deve efetuar e comprovar o pagamento"></textarea></div><div class="inline-action-row"><label class="checkbox-row"><input id="new-payment-active" type="checkbox" checked> Disponível no checkout</label><button class="btn btn-primary" type="button" data-add-payment>Adicionar método</button></div></article>';
    const cards=data.map(item=>'<article class="cms-editor-card"><div class="editor-card-head"><div><span class="editor-kicker">'+esc(item.code)+'</span><h3>'+esc(item.name)+'</h3></div><span class="admin-chip '+(item.is_active?'chip-on':'chip-off')+'">'+(item.is_active?'Ativo':'Inativo')+'</span></div><div class="field-two cms-field-grid"><div><label>Nome</label><input data-payment="'+item.id+'" data-field="name" value="'+esc(item.name)+'"></div><div><label>Código</label><input data-payment="'+item.id+'" data-field="code" value="'+esc(item.code)+'"></div><div><label>Ordem</label><input type="number" data-payment="'+item.id+'" data-field="sort_order" value="'+(item.sort_order??0)+'"></div></div><div class="field-row"><label>Descrição</label><input data-payment="'+item.id+'" data-field="description" value="'+esc(item.description||'')+'"></div><div class="field-row"><label>Dados de recebimento</label><textarea data-payment="'+item.id+'" data-field="account_details" rows="3">'+esc(item.account_details||'')+'</textarea></div><div class="field-row"><label>Instruções</label><textarea data-payment="'+item.id+'" data-field="instructions" rows="3">'+esc(item.instructions||'')+'</textarea></div><div class="inline-action-row"><label class="checkbox-row"><input type="checkbox" data-payment="'+item.id+'" data-field="is_active" '+(item.is_active?'checked':'')+'> Disponível no checkout</label><button class="btn btn-primary" type="button" data-save-payment="'+item.id+'">Guardar método</button></div></article>').join('');
    list.innerHTML=addCard+(cards||'<p>Sem métodos encontrados.</p>');
    bindPaymentEvents();
  }

  function bindPaymentEvents(){
    const list=document.getElementById('payment-methods-admin');
    list.querySelector('[data-add-payment]')?.addEventListener('click',async()=>{
      const name=list.querySelector('#new-payment-name')?.value.trim()||'';
      const rawCode=list.querySelector('#new-payment-code')?.value.trim().toLowerCase()||'';
      const code=rawCode.replace(/[^a-z0-9_-]+/g,'_').replace(/^[_-]+|[_-]+$/g,'').slice(0,80);
      const description=list.querySelector('#new-payment-description')?.value.trim()||null;
      const accountDetails=list.querySelector('#new-payment-account')?.value.trim()||null;
      const instructions=list.querySelector('#new-payment-instructions')?.value.trim()||null;
      const sortOrder=Number(list.querySelector('#new-payment-order')?.value||0);
      const isActive=Boolean(list.querySelector('#new-payment-active')?.checked);
      if(!name||!code){msg('Preencha pelo menos o nome e o código do método.','error');return;}
      if(!Number.isFinite(sortOrder)||sortOrder<0){msg('A ordem deve ser um número igual ou superior a 0.','error');return;}
      const result=await db().from('payment_methods').insert({code,name,description,account_details:accountDetails,instructions,is_active:isActive,sort_order:Math.trunc(sortOrder),updated_at:new Date().toISOString()}).select('id').single();
      if(result.error){
        console.error(result.error);
        const duplicate=result.error.code==='23505';
        msg(duplicate?'Esse código de pagamento já existe. Use outro código.':'Não foi possível adicionar o método de pagamento: '+(result.error.message||'erro desconhecido')+'.','error');
        return;
      }
      msg('Método de pagamento adicionado com sucesso.','success');
      await loadPayments();
    });

    list.querySelectorAll('[data-save-payment]').forEach(button=>button.addEventListener('click',async()=>{
      const id=button.dataset.savePayment;
      const patch={updated_at:new Date().toISOString()};
      list.querySelectorAll('[data-payment="'+id+'"]').forEach(field=>{const name=field.dataset.field;if(name==='is_active')patch[name]=field.checked;else if(name==='sort_order')patch[name]=Number(field.value||0);else patch[name]=field.value.trim();});
      if(!patch.name||!patch.code){msg('Nome e código são obrigatórios.','error');return;}
      const result=await db().from('payment_methods').update(patch).eq('id',id);
      if(result.error){
        console.error(result.error);
        msg(result.error.code==='23505'?'Esse código de pagamento já existe. Use outro código.':'Não foi possível guardar o método.','error');
        return;
      }
      msg('Método atualizado.','success');
      await loadPayments();
    }));
  }

  async function loadSettings(){
    const result=await db().from('site_settings').select('key,value,updated_at').order('key');
    if(result.error){msg('Não foi possível carregar definições.','error');return;}
    cache.settings=result.data||[];
    renderSettings();
  }

  function renderSettings(){
    const list=document.getElementById('settings-admin');
    if(!list)return;
    const data=filtered(cache.settings,filters.settingsSearch,[x=>x.key,x=>x.value]);
    list.innerHTML=data.map(item=>'<article class="cms-setting-row"><div class="field-row"><label>'+esc(item.key)+'</label><input data-setting-admin="'+esc(item.key)+'" value="'+esc(item.value||'')+'"></div><div class="card-actions"><button class="btn btn-primary" type="button" data-save-setting="'+esc(item.key)+'">Guardar</button><button class="btn btn-secondary" type="button" data-delete-setting="'+esc(item.key)+'">Apagar</button></div></article>').join('')||'<p>Sem definições.</p>';
    bindSettingEvents();
  }

  function bindSettingEvents(){
    const list=document.getElementById('settings-admin');
    list.querySelectorAll('[data-save-setting]').forEach(button=>button.addEventListener('click',async()=>{
      const key=button.dataset.saveSetting;
      const input=[...list.querySelectorAll('[data-setting-admin]')].find(node=>node.dataset.settingAdmin===key);
      const value=input?.value?.trim()||'';
      const result=await db().from('site_settings').upsert({key,value,updated_at:new Date().toISOString()});
      if(result.error){msg('Não foi possível guardar a definição.','error');return;}
      msg('Definição atualizada.','success');
      await loadSettings();
    }));
    list.querySelectorAll('[data-delete-setting]').forEach(button=>button.addEventListener('click',async()=>{
      if(!window.confirm('Apagar esta definição?'))return;
      const result=await db().from('site_settings').delete().eq('key',button.dataset.deleteSetting);
      if(result.error){msg('Não foi possível apagar a definição.','error');return;}
      msg('Definição removida.','success');
      await loadSettings();
    }));
  }

  async function addSetting(){
    const key='nova_definicao_'+Date.now();
    const result=await db().from('site_settings').insert({key,value:'',updated_at:new Date().toISOString()});
    if(result.error){msg('Não foi possível adicionar a definição.','error');return;}
    msg('Definição criada. Edite e guarde.','success');
    await loadSettings();
  }

  async function loadAdmins(){
    const result=await db().rpc('list_admins');
    const list=document.getElementById('admin-admins-list');
    if(!list)return;
    if(result.error){list.innerHTML='<p>Não foi possível carregar administradores.</p>';return;}
    list.innerHTML=(result.data||[]).map(admin=>{
      const current=admin.user_id===window.currentAdminId;
      return '<article class="admin-admin-card"><div><strong>'+esc(admin.full_name||'Administrador')+'</strong><span>'+esc(admin.email||'')+'</span><small>Administrador desde '+fmtDate(admin.created_at)+'</small></div><button class="btn btn-secondary" type="button" data-remove-admin="'+admin.user_id+'" '+(current?'disabled':'')+'>'+(current?'Administrador atual':'Remover acesso')+'</button></article>';
    }).join('')||'<p>Não existem administradores.</p>';
    list.querySelectorAll('[data-remove-admin]:not([disabled])').forEach(button=>button.addEventListener('click',async()=>{
      const email=button.closest('.admin-admin-card')?.querySelector('span')?.textContent?.trim();
      if(!email||!window.confirm('Remover o acesso de administrador de '+email+'?'))return;
      const result=await db().rpc('set_admin_role_by_email',{p_email:email,p_make_admin:false});
      if(result.error){msg('Não foi possível remover o acesso.','error');return;}
      msg('Acesso de administrador removido.','success');
      await Promise.all([loadAdmins(),loadClients()]);
    }));
  }

  async function addAdmin(){
    const input=document.getElementById('new-admin-email');
    const email=input?.value?.trim().toLowerCase();
    if(!email){msg('Introduza o email do utilizador.','error');return;}
    const button=document.getElementById('add-admin-btn'); if(button)button.disabled=true;
    const result=await db().rpc('set_admin_role_by_email',{p_email:email,p_make_admin:true});
    if(result.error){msg(result.error.message?.includes('USER_NOT_FOUND')?'O utilizador ainda não tem conta na plataforma.':'Não foi possível adicionar o administrador.','error');if(button)button.disabled=false;return;}
    input.value=''; msg('Administrador adicionado.','success'); if(button)button.disabled=false;
    await Promise.all([loadAdmins(),loadClients(),loadOverview()]);
  }

  function bindFilters(){
    const add=(id,key,event,render)=>{
      const node=document.getElementById(id);
      if(!node)return;
      node.addEventListener(event,()=>{filters[key]=node.value;render();});
    };
    add('overview-search','overviewSearch','input',renderOverview);
    add('overview-status-filter','overviewStatus','change',renderOverview);
    add('clients-search','clientsSearch','input',renderClients);
    add('clients-role-filter','clientsRole','change',renderClients);
    add('orders-search','ordersSearch','input',renderOrders);
    add('orders-status-filter','ordersStatus','change',renderOrders);
    add('orders-payment-filter','ordersPayment','change',renderOrders);
    add('services-search','servicesSearch','input',renderServices);
    add('services-type-filter','servicesType','change',renderServices);
    add('services-category-filter','servicesCategory','change',renderServices);
    add('services-active-filter','servicesActive','change',renderServices);
    add('media-search','mediaSearch','input',renderMedia);
    add('media-type-filter','mediaType','change',renderMedia);
    add('media-active-filter','mediaActive','change',renderMedia);
    add('content-search','contentSearch','input',renderContent);
    add('content-page-filter','contentPage','change',renderContent);
    add('content-section-filter','contentSection','change',renderContent);
    add('payments-search','paymentsSearch','input',renderPayments);
    add('payments-active-filter','paymentsActive','change',renderPayments);
    add('settings-search','settingsSearch','input',renderSettings);
  }

  function bindTabs(){
    document.querySelectorAll('.admin-tab').forEach(tab=>tab.addEventListener('click',()=>{
      document.querySelectorAll('.admin-section').forEach(section=>section.classList.toggle('is-visible',section.dataset.adminPanel===tab.dataset.adminSection));
      document.querySelectorAll('.admin-tab').forEach(item=>item.classList.toggle('is-active',item===tab));
    }));
  }

  async function init(){
    if(!db())return;
    const session=await requireAdmin();
    if(!session)return;
    window.currentAdminId=session.user.id;

    const profile=await db().from('profiles').select('full_name').eq('id',session.user.id).maybeSingle();
    document.getElementById('admin-name').textContent=profile.data?.full_name||'Administrador';

    await Promise.all([loadOverview(),loadClients(),loadOrders(),loadServices(),loadMedia(),loadContent(),loadPayments(),loadSettings(),loadAdmins()]);
    bindFilters();
    bindTabs();

    document.getElementById('add-service-btn')?.addEventListener('click',addService);
    document.getElementById('add-media-btn')?.addEventListener('click',addMedia);
    document.getElementById('add-content-btn')?.addEventListener('click',addContent);
    document.getElementById('add-setting-btn')?.addEventListener('click',addSetting);
    document.getElementById('add-admin-btn')?.addEventListener('click',addAdmin);
    document.querySelectorAll('[data-logout]').forEach(button=>button.addEventListener('click',async()=>{await db().auth.signOut();window.location.href='auth.html';}));

    db().channel('mukwatela-admin-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>{loadOrders();loadOverview();})
      .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>{loadClients();loadOverview();})
      .on('postgres_changes',{event:'*',schema:'public',table:'services'},loadServices)
      .on('postgres_changes',{event:'*',schema:'public',table:'site_media'},loadMedia)
      .on('postgres_changes',{event:'*',schema:'public',table:'site_content'},loadContent)
      .on('postgres_changes',{event:'*',schema:'public',table:'site_settings'},loadSettings)
      .on('postgres_changes',{event:'*',schema:'public',table:'payment_methods'},loadPayments)
      .subscribe();
  }

  document.addEventListener('DOMContentLoaded',init);
})();