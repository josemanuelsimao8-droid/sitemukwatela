(() => {
  const db=()=>window.supabaseClient, cart=()=>window.MukwatelaCart;
  const money=(v,c='AOA')=>v==null?'Sob orçamento':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let catalog=[],zones=[],methods=[],hasQuote=false;

  function message(text,type='info'){const n=document.getElementById('shop-message');if(!n)return;n.textContent=text;n.dataset.type=type;n.hidden=false;}
  async function getSession(){const r=await db().auth.getUser();return r.data?.user?{user:r.data.user}:null;}
  async function loadCatalog(){
    const items=cart().getItems();if(!items.length)return [];
    const r=await db().from('services').select('id,name,slug,category,description,image_url,features,unit_price,currency,item_type,sku,unit_label,stock_quantity,is_active').in('id',items.map(x=>x.id)).eq('is_active',true);
    if(r.error)throw r.error;
    return items.map(ci=>{const fresh=(r.data||[]).find(x=>x.id===ci.id);return fresh?Object.assign({},ci,fresh):null;}).filter(Boolean);
  }
  function renderSummary(items){
    const node=document.getElementById('checkout-cart-summary'),type=document.getElementById('checkout-item-type');if(!node)return;
    hasQuote=items.some(x=>x.unit_price==null);
    node.innerHTML=items.map(x=>'<div class="checkout-cart-item"><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.item_type==='material'?'Material':'Serviço')+' · '+Number(x.quantity)+' '+esc(x.unit_label||'unidade')+'</small></div><strong>'+(x.unit_price==null?'Sob orçamento':esc(money(Number(x.unit_price)*Number(x.quantity),x.currency)))+'</strong></div>').join('');
    if(type)type.textContent=hasQuote?'O carrinho contém itens que precisam de orçamento. Os valores serão definidos pela Mukwatela.':'Todos os itens têm preço definido e podem seguir para pagamento.';
    updateTotals();
  }
  function updateTotals(){
    const subtotal=document.getElementById('checkout-subtotal'),fee=document.getElementById('checkout-delivery-fee'),total=document.getElementById('checkout-total'),method=document.getElementById('delivery-method')?.value||'pickup',zone=document.getElementById('delivery-zone')?.value;
    const known=!hasQuote;
    const base=known?catalog.reduce((s,x)=>s+Number(x.unit_price)*Number(x.quantity),0):null;
    const z=zones.find(x=>x.id===zone),deliveryFee=method==='delivery'?(Number(z?.fee||0)):0;
    if(subtotal)subtotal.textContent=base==null?'Sob orçamento':money(base,catalog[0]?.currency||'AOA');
    if(fee)fee.textContent=money(deliveryFee,catalog[0]?.currency||'AOA');
    if(total)total.textContent=base==null?'Sob orçamento':money(base+deliveryFee,catalog[0]?.currency||'AOA');
    document.getElementById('delivery-zone')?.toggleAttribute('disabled',method!=='delivery');
    const addr=document.getElementById('delivery-address');if(addr)addr.required=method==='delivery';
    const note=document.getElementById('delivery-zone-note');if(note)note.textContent=method==='delivery'?(z?z.description+' · Taxa: '+money(z.fee,catalog[0]?.currency||'AOA'):'Selecione uma zona de entrega.'):'Levantamento sem taxa de entrega.';
    const payStage=document.querySelector('.checkout-payment-stage');if(payStage)payStage.hidden=hasQuote;
    const submit=document.querySelector('#checkout-form button[type="submit"]');if(submit)submit.textContent=hasQuote?'ENVIAR PARA ORÇAMENTO':'CONTINUAR PARA PAGAMENTO';
  }
  async function loadProfile(session){
    const r=await db().from('profiles').select('full_name,phone,address').eq('id',session.user.id).maybeSingle(),p=r.data||{};
    const name=document.getElementById('checkout-name');if(name)name.value=p.full_name||'';
    const contact=document.getElementById('delivery-contact');if(contact)contact.value=p.phone||'';
    const address=document.getElementById('delivery-address');if(address)address.value=p.address||'';
  }
  async function loadPaymentMethods(){
    const r=await db().from('payment_methods').select('id,code,name,description,account_details,instructions,is_active,sort_order').eq('is_active',true).order('sort_order',{ascending:true});if(r.error)throw r.error;methods=r.data||[];
    const list=document.getElementById('payment-method-list');if(!list)return;
    const submit=document.querySelector('#checkout-form button[type="submit"]');
    if(!methods.length){
      list.innerHTML='<div class="payment-method-empty"><strong>Nenhum método de pagamento está disponível.</strong><p>O administrador precisa ativar pelo menos um método para este pedido avançar.</p></div>';
      if(submit && !hasQuote){submit.disabled=true;}
      return false;
    }
    list.innerHTML=methods.map((m,i)=>'<label class="payment-method-option"><input type="radio" name="paymentMethod" value="'+esc(m.code)+'" '+(i===0?'checked':'')+'><span><strong>'+esc(m.name)+'</strong><small>'+esc(m.description||'')+'</small></span></label>').join('');
    if(submit && !hasQuote){submit.disabled=false;}
    list.addEventListener('change',renderPaymentInstructions);
    renderPaymentInstructions();
    return true;
  }
  function renderPaymentInstructions(){const node=document.getElementById('payment-instructions'),value=document.querySelector('input[name="paymentMethod"]:checked')?.value,m=methods.find(x=>x.code===value);if(!node||!m)return;node.innerHTML='<strong>'+esc(m.name)+'</strong>'+(m.account_details?'<p>'+esc(m.account_details)+'</p>':'')+(m.instructions?'<p>'+esc(m.instructions)+'</p>':'');}
  async function loadZones(){
    const r=await db().from('delivery_zones').select('id,name,description,fee').eq('is_active',true).order('sort_order',{ascending:true});if(r.error)throw r.error;zones=r.data||[];
    const node=document.getElementById('delivery-zone');if(!node)return;
    node.innerHTML='<option value="">Selecione a zona</option>'+zones.map(z=>'<option value="'+z.id+'">'+esc(z.name)+' · '+esc(money(z.fee,catalog[0]?.currency||'AOA'))+'</option>').join('');
  }
  async function submit(form){
    const session=await getSession();if(!session){location.href='auth.html';return;}
    catalog=await loadCatalog();if(!catalog.length){message('O carrinho está vazio ou contém itens indisponíveis.','error');return;}
    for(const x of catalog){if(x.item_type==='material'&&x.stock_quantity!=null&&Number(x.quantity)>Number(x.stock_quantity)){message('O stock de '+x.name+' não é suficiente. Disponível: '+x.stock_quantity+' '+(x.unit_label||'unidade')+'.','error');return;}}
    const deliveryMethod=document.getElementById('delivery-method')?.value||'pickup',zoneId=deliveryMethod==='delivery'?document.getElementById('delivery-zone')?.value||null:null;
    const address=document.getElementById('delivery-address')?.value.trim()||null,contact=document.getElementById('delivery-contact')?.value.trim()||null;
    if(deliveryMethod==='delivery'&&(!zoneId||!address)){message('Selecione uma zona e preencha a morada de entrega.','error');return;}
    const paymentMethod=hasQuote?null:document.querySelector('input[name="paymentMethod"]:checked')?.value||null;if(!hasQuote&&!paymentMethod){message('Selecione uma forma de pagamento.','error');return;}
    const notes=document.getElementById('service-observations')?.value.trim()||null;
    const items=catalog.map(x=>({service_id:x.id,quantity:Math.max(1,Math.trunc(Number(x.quantity)||1)),specifications:x.specifications||{}}));
    const submitBtn=form.querySelector('button[type="submit"]');if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='A criar pedido...';}
    const r=await db().rpc('create_cart_order',{p_items:items,p_notes:notes,p_payment_method:paymentMethod,p_delivery_method:deliveryMethod,p_delivery_zone_id:zoneId,p_delivery_address:address,p_delivery_contact:contact});
    if(r.error){console.error(r.error);const d=String(r.error.message||'');message(d.includes('INSUFFICIENT_STOCK')?'O stock disponível não é suficiente para o carrinho.':d.includes('DELIVERY_ZONE')?'A zona de entrega deixou de estar disponível.':d.includes('PAYMENT_METHOD')?'A forma de pagamento selecionada não está disponível.':'Não foi possível criar o pedido. Tente novamente.','error');if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=hasQuote?'ENVIAR PARA ORÇAMENTO':'CONTINUAR PARA PAGAMENTO';}return;}
    const orderId=r.data?.id||r.data?.[0]?.id;cart().clear();sessionStorage.setItem('mukwatela-last-order-id',orderId||'');location.href=hasQuote?'orcamentos.html':'pagamento.html?order='+encodeURIComponent(orderId);
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    const form=document.getElementById('checkout-form');if(!form)return;
    const session=await getSession();if(!session){location.href='auth.html';return;}
    await cart().requireAuth({redirect:false});
    catalog=await loadCatalog();if(!catalog.length){message('O carrinho está vazio.','error');form.hidden=true;return;}
    renderSummary(catalog);await loadProfile(session);
    try{
      const paymentLoaded=await loadPaymentMethods();
      await loadZones();
      if(paymentLoaded===false && !hasQuote){
        message('Não há nenhum método de pagamento ativo. O pedido não pode avançar até que a Mukwatela disponibilize um método.','error');
      }
    }catch(e){
      console.error(e);
      message('Não foi possível carregar as opções de pagamento ou entrega.','error');
      const submit=document.querySelector('#checkout-form button[type="submit"]');
      if(submit && !hasQuote) submit.disabled=true;
    }
    document.getElementById('delivery-method')?.addEventListener('change',updateTotals);document.getElementById('delivery-zone')?.addEventListener('change',updateTotals);
    updateTotals();
    form.addEventListener('submit',e=>{e.preventDefault();submit(form).catch(err=>{console.error(err);message('Ocorreu um erro ao processar o pedido.','error');const b=form.querySelector('button[type="submit"]');if(b){b.disabled=false;b.textContent=hasQuote?'ENVIAR PARA ORÇAMENTO':'CONTINUAR PARA PAGAMENTO';}});});
  });
})();