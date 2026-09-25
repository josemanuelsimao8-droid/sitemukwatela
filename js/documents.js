(() => {
  const db=()=>window.supabaseClient;
  let session=null;
  let rows=[];

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'Sob orçamento':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});

  async function init(){
    session=(await db().auth.getSession()).data?.session;
    if(!session){window.location.href='auth.html';return;}
    await load();
    document.getElementById('documents-search')?.addEventListener('input',render);
  }

  async function load(){
    const result=await db().from('documents')
      .select('id,order_id,document_type,document_number,amount,currency,status,issue_date,due_date,notes,created_at')
      .eq('customer_id',session.user.id)
      .order('created_at',{ascending:false});
    if(result.error){show('Não foi possível carregar os documentos.','error');return;}
    const orderIds=[...new Set((result.data||[]).map(x=>x.order_id))];
    let orders=[];
    if(orderIds.length){
      const o=await db().from('orders').select('id,order_number').in('id',orderIds);
      orders=o.data||[];
    }
    const map=Object.fromEntries(orders.map(x=>[x.id,x]));
    rows=(result.data||[]).map(x=>({...x,order_number:map[x.order_id]?.order_number||'—'}));
    render();
  }

  function render(){
    const root=document.getElementById('documents-list');
    if(!root)return;
    const q=(document.getElementById('documents-search')?.value||'').toLowerCase().trim();
    const data=rows.filter(x=>!q||[x.document_number,x.order_number,x.document_type].join(' ').toLowerCase().includes(q));
    root.innerHTML=data.map(x=>{
      const type=x.document_type==='proforma'?'Factura Proforma':'Factura';
      return '<article class="document-card"><div><span class="editor-kicker">'+esc(type)+'</span><h3>'+esc(x.document_number)+'</h3><p>Pedido '+esc(x.order_number)+'</p></div><div class="document-card-meta"><strong>'+esc(money(x.amount,x.currency))+'</strong><small>Emitido em '+esc(new Date(x.issue_date).toLocaleDateString('pt-PT'))+'</small><span class="admin-chip '+(x.status==='issued'?'chip-on':'chip-off')+'">'+esc(x.status==='issued'?'Emitido':'Cancelado')+'</span></div><div class="card-actions"><a class="btn btn-primary" href="documento.html?id='+encodeURIComponent(x.id)+'">Ver documento</a></div></article>';
    }).join('')||'<div class="operations-empty">Não existem documentos para mostrar.</div>';
  }

  function show(text,type){
    const n=document.getElementById('documents-message');if(!n)return;
    n.textContent=text;n.dataset.type=type;n.hidden=false;
  }

  document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-logout]').forEach(b=>b.addEventListener('click',async()=>{await db().auth.signOut();location.href='auth.html'}));init();});
})();