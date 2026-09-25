(() => {
  const db=()=>window.supabaseClient, cart=()=>window.MukwatelaCart;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'Sob orçamento':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  let item=null;
  function msg(t,type='info'){const n=document.getElementById('product-message');if(!n)return;n.textContent=t;n.dataset.type=type;n.hidden=false;}
  async function init(){
    const p=new URLSearchParams(location.search),id=p.get('id'),slug=p.get('slug');
    let q=db().from('services').select('id,name,slug,category,description,image_url,features,unit_price,currency,is_active,item_type,sku,unit_label,stock_quantity,is_featured').eq('is_active',true);
    if(id)q=q.eq('id',id);else if(slug)q=q.eq('slug',slug);else{msg('Produto não encontrado.','error');return;}
    const r=await q.maybeSingle();if(r.error||!r.data){msg('Produto não encontrado ou indisponível.','error');return;}item=r.data;render();
  }
  function render(){
    const root=document.getElementById('product-detail'),mat=item.item_type==='material';
    const stock=item.stock_quantity==null?'Stock não controlado':Number(item.stock_quantity).toLocaleString('pt-PT')+' '+(item.unit_label||'unidade')+' disponíveis';
    const specs=mat?'':'<div class="product-specs"><label>Formato<select id="pd-format"><option>Padrão</option><option>Médio</option><option>Grande</option></select></label><label>Material<input id="pd-material" placeholder="Material pretendido"></label><label>Dimensões<input id="pd-dimensions" placeholder="Ex.: A4"></label><label>Prazo pretendido<input id="pd-deadline" placeholder="Ex.: 7 dias úteis"></label></div>';
    const features=Array.isArray(item.features)?item.features.map(x=>'<span>'+esc(x)+'</span>').join(''):'';
    root.innerHTML='<div class="product-detail-media">'+(item.image_url?'<img src="'+encodeURI(item.image_url)+'" alt="'+esc(item.name)+'">':'')+'</div><div class="product-detail-copy"><span class="eyebrow">'+esc(mat?'Material':item.category||'Serviço')+'</span><h1>'+esc(item.name)+'</h1><p>'+esc(item.description||'')+'</p><div class="detail-feature-list">'+features+'</div><div class="product-detail-price">'+esc(money(item.unit_price,item.currency))+(item.unit_price!=null?' / '+esc(item.unit_label||'unidade'):'')+'</div><small class="catalog-stock">'+esc(stock)+'</small><div class="product-specs"><label>Quantidade<input id="pd-qty" type="number" min="1" step="1" value="1" '+(item.stock_quantity!=null?'max="'+Number(item.stock_quantity)+'"':'')+'></label></div>'+specs+'<div class="product-actions"><button class="btn btn-primary" id="pd-add" type="button">Adicionar ao carrinho</button><a class="btn btn-secondary" href="carrinho.html">Ver carrinho</a></div><p class="cart-note">Pode reunir vários serviços e materiais num só pedido. O stock volta a ser validado no checkout.</p></div>';
    document.getElementById('pd-add').addEventListener('click',add);
  }
  function add(){
    let q=Math.max(1,Math.trunc(Number(document.getElementById('pd-qty')?.value)||1));
    if(item.stock_quantity!=null)q=Math.min(q,Number(item.stock_quantity));
    if(item.stock_quantity!=null&&Number(item.stock_quantity)<1){msg('Este material está sem stock.','error');return;}
    let specifications={};
    if(item.item_type!=='material')specifications={format:document.getElementById('pd-format')?.value||'',material:document.getElementById('pd-material')?.value.trim()||'',dimensions:document.getElementById('pd-dimensions')?.value.trim()||'',deadline:document.getElementById('pd-deadline')?.value.trim()||''};
    cart().add(item,q,specifications);
    const toast=document.getElementById('cart-toast');if(toast){toast.textContent='Item adicionado ao carrinho.';toast.hidden=false;setTimeout(()=>toast.hidden=true,2200);}
  }
  document.addEventListener('DOMContentLoaded',init);
})();