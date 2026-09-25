(() => {
  const db=()=>window.supabaseClient;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'Sob orçamento':String(c||'AOA')+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const statuses={pending:'Pendente',pending_payment:'A aguardar pagamento',pending_quote:'A aguardar orçamento',processing:'Em processamento',received:'Recebido',production:'Em produção',ready:'Pronto',completed:'Concluído',delivered:'Entregue',cancelled:'Cancelado'};
  const pays={unpaid:'Não pago',submitted:'Comprovativo enviado',confirmed:'Confirmado',rejected:'Rejeitado',pending:'Pendente',paid:'Pago',failed:'Falhou',refunded:'Reembolsado'};
  const deliveries={pending:'A preparar',preparing:'Em preparação',ready:'Pronto',out_for_delivery:'Em entrega',delivered:'Entregue',picked_up:'Levantado',cancelled:'Cancelado'};
  const msg=(t,type='info')=>{const n=document.getElementById('admin-order-message');if(n){n.textContent=t;n.dataset.type=type;n.hidden=false;}};
  async function requireAdmin(){
    const s=(await db().auth.getSession()).data?.session;
    if(!s){location.href='auth.html';return null;}
    const r=await db().from('profiles').select('role').eq('id',s.user.id).maybeSingle();
    if(r.data?.role!=='admin'){location.href='dashboard.html';return null;}
    return s;
  }
  async function load(){
    const id=new URLSearchParams(location.search).get('order');
    if(!id){msg('Pedido não selecionado.','error');return;}
    const r=await db().from('orders').select('id,order_number,user_id,status,total,currency,payment_method,payment_status,notes,delivery_method,delivery_zone_id,delivery_fee,delivery_address,delivery_contact,delivery_status,created_at,updated_at,profiles(full_name,phone,company,address),order_items(id,service_id,service_name,quantity,unit_price,subtotal,item_type,unit_label,specifications)').eq('id',id).maybeSingle();
    if(r.error||!r.data){msg('Pedido não encontrado.','error');return;}
    const o=r.data;
    const [z,pay,quote]=await Promise.all([
      o.delivery_zone_id?db().from('delivery_zones').select('name,fee').eq('id',o.delivery_zone_id).maybeSingle():Promise.resolve({data:null}),
      db().from('payments').select('id,amount,status,provider,transaction_reference,customer_note,proof_path,created_at').eq('order_id',id).order('created_at',{ascending:false}),
      db().from('quotes').select('id,amount,currency,status,notes,valid_until,created_at,updated_at').eq('order_id',id).order('created_at',{ascending:false}).limit(1)
    ]);
    const root=document.getElementById('admin-order-detail');
    const items=o.order_items||[];
    root.innerHTML='<div class="order-detail-head"><div><span class="eyebrow">Pedido</span><h1>'+esc(o.order_number)+'</h1><p>'+esc(new Date(o.created_at).toLocaleString('pt-PT'))+'</p></div><div class="card-actions"><a class="btn btn-secondary" href="admin.html">Painel</a><span class="admin-chip">'+esc(statuses[o.status]||o.status)+'</span></div></div>'+
      '<div class="order-detail-grid"><section class="panel-card"><h2>Cliente</h2><div class="detail-list"><div><span>Nome</span><strong>'+esc(o.profiles?.full_name||'—')+'</strong></div><div><span>Empresa</span><strong>'+esc(o.profiles?.company||'—')+'</strong></div><div><span>Telefone</span><strong>'+esc(o.profiles?.phone||'—')+'</strong></div><div><span>Morada</span><strong>'+esc(o.profiles?.address||'—')+'</strong></div></div></section>'+
      '<section class="panel-card"><h2>Estado</h2><div class="detail-list"><div><span>Pedido</span><strong>'+esc(statuses[o.status]||o.status)+'</strong></div><div><span>Pagamento</span><strong>'+esc(pays[o.payment_status]||o.payment_status)+'</strong></div><div><span>Entrega</span><strong>'+esc(deliveries[o.delivery_status]||o.delivery_status||'—')+'</strong></div></div></section></div>'+
      '<section class="panel-card order-block"><h2>Itens</h2><div class="table-responsive"><table class="order-items-table"><thead><tr><th>Item</th><th>Tipo</th><th>Qtd.</th><th>Preço</th><th>Total</th></tr></thead><tbody>'+items.map(i=>'<tr><td>'+esc(i.service_name)+'</td><td>'+esc(i.item_type==='material'?'Material':'Serviço')+'</td><td>'+esc(i.quantity)+'</td><td>'+esc(money(i.unit_price,o.currency))+'</td><td>'+esc(i.unit_price==null?'Sob orçamento':money(i.subtotal,o.currency))+'</td></tr>').join('')+'</tbody></table><div class="document-total"><span>Entrega</span><strong>'+esc(money(o.delivery_fee,o.currency))+'</strong><span>Total</span><strong>'+esc(money(o.total,o.currency))+'</strong></div></div></section>'+
      '<section class="panel-card order-block"><h2>Entrega / levantamento</h2><div class="detail-list"><div><span>Método</span><strong>'+esc(o.delivery_method==='delivery'?'Entrega':'Levantamento')+'</strong></div><div><span>Zona</span><strong>'+esc(z.data?.name||'—')+'</strong></div><div><span>Morada</span><strong>'+esc(o.delivery_address||'—')+'</strong></div><div><span>Contacto</span><strong>'+esc(o.delivery_contact||'—')+'</strong></div></div></section>'+
      '<section class="panel-card order-block"><h2>Pagamento</h2><div class="table-responsive"><table class="order-items-table"><thead><tr><th>Estado</th><th>Valor</th><th>Método</th><th>Referência</th><th>Data</th></tr></thead><tbody>'+((pay.data||[]).map(x=>'<tr><td>'+esc(pays[x.status]||x.status)+'</td><td>'+esc(money(x.amount,o.currency))+'</td><td>'+esc(x.provider||o.payment_method||'—')+'</td><td>'+esc(x.transaction_reference||'—')+'</td><td>'+esc(new Date(x.created_at).toLocaleString('pt-PT'))+'</td></tr>').join('')||'<tr><td colspan="5">Sem registos de pagamento.</td></tr>')+'</tbody></table></div></section>'+
      (quote.data?.[0]?'<section class="panel-card order-block"><h2>Orçamento</h2><div class="detail-list"><div><span>Estado</span><strong>'+esc(quote.data[0].status)+'</strong></div><div><span>Valor</span><strong>'+esc(money(quote.data[0].amount,quote.data[0].currency||o.currency))+'</strong></div><div><span>Validade</span><strong>'+esc(quote.data[0].valid_until||'—')+'</strong></div></div><p>'+esc(quote.data[0].notes||'')+'</p></section>':'')+
      '<section class="panel-card order-block"><h2>Gestão</h2><div class="field-two cms-field-grid"><div><label>Estado do pedido<select id="admin-order-status">'+Object.entries(statuses).map(([k,v])=>'<option value="'+k+'" '+(o.status===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label></div><div><label>Estado do pagamento<select id="admin-payment-status">'+Object.entries(pays).map(([k,v])=>'<option value="'+k+'" '+(o.payment_status===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label></div><div><label>Estado da entrega<select id="admin-delivery-status">'+Object.entries(deliveries).map(([k,v])=>'<option value="'+k+'" '+(o.delivery_status===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label></div></div><label>Nota para o histórico<textarea id="admin-order-note" rows="4" placeholder="Ex.: produção iniciada, cliente contactado..."></textarea></label><button class="btn btn-primary" id="save-admin-order" type="button">Guardar atualização</button></section>';
    document.getElementById('save-admin-order').addEventListener('click',async()=>{
      const b=document.getElementById('save-admin-order');b.disabled=true;
      const x=await db().rpc('admin_update_order',{p_order_id:id,p_status:document.getElementById('admin-order-status').value,p_payment_status:document.getElementById('admin-payment-status').value,p_delivery_status:document.getElementById('admin-delivery-status').value,p_admin_note:document.getElementById('admin-order-note').value.trim()||null});
      if(x.error){msg('Não foi possível atualizar o pedido. '+(x.error.message||''),'error');b.disabled=false;return;}
      msg('Pedido atualizado com sucesso.','success');await load();
    });
  }
  document.addEventListener('DOMContentLoaded',async()=>{if(await requireAdmin())load();});
})();