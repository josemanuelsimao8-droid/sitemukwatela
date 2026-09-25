(() => {
  const db=()=>window.supabaseClient, esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'Sob orçamento':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  function msg(t,type='info'){const n=document.getElementById('admin-client-message');if(!n)return;n.textContent=t;n.dataset.type=type;n.hidden=false;}
  async function auth(){
    const s=(await db().auth.getSession()).data?.session;if(!s){location.href='auth.html';return null;}
    const r=await db().from('user_roles').select('role').eq('user_id',s.user.id).maybeSingle();if(r.data?.role!=='admin'){location.href='dashboard.html';return null;}return s;
  }
  async function init(){
    const s=await auth();if(!s)return;
    const id=new URLSearchParams(location.search).get('user');if(!id){msg('Cliente não selecionado.','error');return;}
    const p=await db().from('profiles').select('id,full_name,phone,company,address,role,created_at,terms_accepted_at').eq('id',id).maybeSingle();
    if(p.error||!p.data){msg('Cliente não encontrado.','error');return;}
    const o=await db().from('orders').select('id,order_number,status,total,currency,payment_status,created_at,order_items(service_name,quantity,item_type)').eq('customer_id',id).order('created_at',{ascending:false}).limit(100);
    const root=document.getElementById('admin-client-detail'),x=p.data,orders=o.data||[];
    root.innerHTML='<div class="order-detail-head"><div><span class="eyebrow">Cliente</span><h1>'+esc(x.full_name||'Sem nome')+'</h1><p>Registado em '+new Date(x.created_at).toLocaleString('pt-PT')+'</p></div><a class="btn btn-secondary" href="admin.html">Voltar</a></div>'+
      '<section class="panel-card order-block"><h2>Dados do cliente</h2><form id="client-edit-form" class="checkout-form"><div class="field-row field-two"><div><label>Nome<input id="client-name" value="'+esc(x.full_name||'')+'" required></label></div><div><label>Telefone<input id="client-phone" value="'+esc(x.phone||'')+'"></label></div><div><label>Empresa<input id="client-company" value="'+esc(x.company||'')+'"></label></div><div><label>Morada<input id="client-address" value="'+esc(x.address||'')+'"></label></div></div><button class="btn btn-primary" type="submit">Guardar dados</button></form></section>'+
      '<section class="panel-card order-block"><h2>Pedidos do cliente</h2><div class="table-responsive"><table class="order-items-table"><thead><tr><th>Pedido</th><th>Itens</th><th>Estado</th><th>Pagamento</th><th>Total</th><th>Data</th></tr></thead><tbody>'+orders.map(o=>'<tr><td><a class="link-button" href="admin-pedido.html?order='+encodeURIComponent(o.id)+'">'+esc(o.order_number)+'</a></td><td>'+esc((o.order_items||[]).map(i=>i.service_name).join(', '))+'</td><td>'+esc(o.status)+'</td><td>'+esc(o.payment_status)+'</td><td>'+esc(money(o.total,o.currency))+'</td><td>'+esc(new Date(o.created_at).toLocaleDateString('pt-PT'))+'</td></tr>').join('')+'</tbody></table></div></section>';
    document.getElementById('client-edit-form').addEventListener('submit',async e=>{
      e.preventDefault();const patch={full_name:document.getElementById('client-name').value.trim(),phone:document.getElementById('client-phone').value.trim()||null,company:document.getElementById('client-company').value.trim()||null,address:document.getElementById('client-address').value.trim()||null,updated_at:new Date().toISOString()};
      const r=await db().from('profiles').update(patch).eq('id',id);if(r.error){msg('Não foi possível atualizar o cliente.','error');return;}msg('Dados do cliente atualizados.','success');
    });
  }
  document.addEventListener('DOMContentLoaded',init);
})();