(() => {
  const client=()=>window.supabaseClient, cart=()=>window.MukwatelaCart;
  const money=(v,c='AOA')=>v==null?'Sob orçamento':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  async function getSession(){const r=await client().auth.getUser();return r.data?.user?{user:r.data.user}:null;}
  async function getRole(uid){if(!uid)return'guest';const r=await client().from('profiles').select('role').eq('id',uid).maybeSingle();return r.data?.role||'customer';}

  async function loadMaterials(){
    const list=document.getElementById('materials-list');if(!list)return;
    const r=await client().from('services').select('id,name,slug,category,description,image_url,features,unit_price,currency,is_active,sort_order,item_type,sku,unit_label,stock_quantity,is_featured').eq('is_active',true).eq('item_type','material').order('sort_order',{ascending:true});
    if(r.error){console.error(r.error);list.innerHTML='<p>Não foi possível carregar os materiais neste momento.</p>';return;}
    const materials=r.data||[],search=document.getElementById('materials-search'),category=document.getElementById('materials-category'),sort=document.getElementById('materials-sort');
    if(category)category.innerHTML='<option value="">Todas as categorias</option>'+[...new Set(materials.map(x=>x.category).filter(Boolean))].sort().map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    const session=await getSession(),role=await getRole(session?.user?.id);

    function render(){
      const term=String(search?.value||'').trim().toLowerCase(),cat=category?.value||'';
      let data=materials.filter(x=>{const hay=[x.name,x.slug,x.category,x.description,x.sku].join(' ').toLowerCase();return(!term||hay.includes(term))&&(!cat||x.category===cat);});
      if(sort?.value==='name')data.sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt'));
      if(sort?.value==='price_asc')data.sort((a,b)=>Number(a.unit_price??Infinity)-Number(b.unit_price??Infinity));
      if(sort?.value==='price_desc')data.sort((a,b)=>Number(b.unit_price??-1)-Number(a.unit_price??-1));
      if(!data.length){list.innerHTML='<div class="operations-empty">Nenhum material corresponde aos filtros.</div>';return;}
      list.innerHTML=data.map(item=>{
        const stock=item.stock_quantity==null?'': '<small class="catalog-stock">'+Number(item.stock_quantity).toLocaleString('pt-PT')+' '+esc(item.unit_label||'unidade')+' disponíveis</small>';
        const features=Array.isArray(item.features)?item.features.map(f=>'<span>'+esc(f)+'</span>').join(''):'';
        const action=role==='admin'?'<a class="btn btn-primary" href="admin.html">Gerir no painel</a>':'<button class="btn btn-primary" type="button" data-buy-material="'+item.id+'">Adicionar ao carrinho</button>';
        return '<article class="service-catalog-card"><a class="service-catalog-media" href="produto.html?id='+encodeURIComponent(item.id)+'">'+(item.image_url?'<img src="'+esc(item.image_url)+'" alt="'+esc(item.name)+'" loading="lazy">':'')+'</a><div class="service-catalog-body"><span class="eyebrow">Material</span><h2>'+esc(item.name)+'</h2><p>'+esc(item.description||'')+'</p><div class="service-feature-list">'+features+'</div><div class="service-catalog-footer"><div><strong>'+money(item.unit_price,item.currency)+'</strong>'+(item.unit_price!=null?'<small>/ '+esc(item.unit_label||'unidade')+'</small>':'')+stock+'</div><div class="catalog-card-actions">'+action+'<a class="catalog-detail-link" href="produto.html?id='+encodeURIComponent(item.id)+'">Detalhes</a></div></div></div></article>';
      }).join('');
      list.querySelectorAll('[data-buy-material]').forEach(btn=>btn.addEventListener('click',async()=>{const item=materials.find(x=>x.id===btn.dataset.buyMaterial);if(!item||!cart())return;if(item.stock_quantity!=null&&Number(item.stock_quantity)<1){alert('Este material está sem stock.');return;}btn.disabled=true;const added=await cart().add(item,1,{});if(added){btn.textContent='Adicionado';setTimeout(()=>{btn.textContent='Adicionar ao carrinho';btn.disabled=false;},1600);}else{btn.disabled=false;}}));
    }
    search?.addEventListener('input',render);category?.addEventListener('change',render);sort?.addEventListener('change',render);render();
  }
  document.addEventListener('DOMContentLoaded',loadMaterials);
  window.addEventListener('cms:services-updated',loadMaterials);
})();