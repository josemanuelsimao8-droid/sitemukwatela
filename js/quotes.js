(() => {
  const db=()=>window.supabaseClient;
  let session=null;
  let rows=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'A definir':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const label={draft:'Em análise',sent:'Disponível',accepted:'Aceite',rejected:'Recusado',expired:'Expirado'};

  async function init(){
    session=(await db().auth.getSession()).data?.session;
    if(!session){location.href='auth.html';return;}
    await load();
    document.getElementById('quotes-search')?.addEventListener('input',render);
    document.getElementById('quotes-status')?.addEventListener('change',render);
    db().channel('customer-quotes-live').on('postgres_changes',{event:'*',schema:'public',table:'quotes',filter:'customer_id=eq.'+session.user.id},load).subscribe();
  }

  async function load(){
    const r=await db().from('quotes').select('id,order_id,amount,currency,status,notes,valid_until,created_at,updated_at').eq('customer_id',session.user.id).order('created_at',{ascending:false});
    if(r.error){show('Não foi possível carregar os orçamentos.','error');return;}
    const ids=[...new Set((r.data||[]).map(x=>x.order_id))];
    let orders=[];if(ids.length){const o=await db().from('orders').select('id,order_number').in('id',ids);orders=o.data||[];}
    const map=Object.fromEntries(orders.map(x=>[x.id,x]));
    rows=(r.data||[]).map(x=>({...x,order_number:map[x.order_id]?.order_number||'—'}));
    render();
  }

  function render(){
    const root=document.getElementById('quotes-list');if(!root)return;
    const q=(document.getElementById('quotes-search')?.value||'').toLowerCase().trim();
    const s=document.getElementById('quotes-status')?.value||'';
    const data=rows.filter(x=>(!q||x.order_number.toLowerCase().includes(q))&&(!s||x.status===s));
    root.innerHTML=data.map(x=>{
      const can=x.status==='sent';
      return '<article class="quote-card"><div class="quote-card-head"><div><span class="editor-kicker">Pedido</span><h3>'+esc(x.order_number)+'</h3></div><span class="admin-chip '+(x.status==='sent'?'chip-on':'chip-off')+'">'+esc(label[x.status]||x.status)+'</span></div><div class="quote-amount">'+esc(money(x.amount,x.currency))+'</div>'+(x.valid_until?'<small>Válido até '+esc(new Date(x.valid_until+'T00:00:00').toLocaleDateString('pt-PT'))+'</small>':'')+(x.notes?'<p>'+esc(x.notes)+'</p>':'')+'<div class="card-actions">'+(can?'<button class="btn btn-primary" type="button" data-accept="'+x.id+'">Aceitar orçamento</button><button class="btn btn-secondary" type="button" data-reject="'+x.id+'">Recusar</button>':'')+'<a class="btn btn-secondary" href="pedido.html?order='+encodeURIComponent(x.order_id)+'">Ver pedido</a></div></article>';
    }).join('')||'<div class="operations-empty">Não existem orçamentos com estes filtros.</div>';
    root.querySelectorAll('[data-accept]').forEach(b=>b.addEventListener('click',()=>respond(b.dataset.accept,true)));
    root.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>respond(b.dataset.reject,false)));
  }

  async function respond(id,accept){
    const r=await db().rpc('customer_respond_quote',{p_quote_id:id,p_accept:accept});
    if(r.error){show('Não foi possível atualizar o orçamento.','error');return;}
    show(accept?'Orçamento aceite. A Proforma está agora disponível.':'Orçamento recusado.','success');
    await load();
  }

  function show(text,type){const n=document.getElementById('quotes-message');if(!n)return;n.textContent=text;n.dataset.type=type;n.hidden=false;}
  document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-logout]').forEach(b=>b.addEventListener('click',async()=>{await db().auth.signOut();location.href='auth.html'}));init();});
})();