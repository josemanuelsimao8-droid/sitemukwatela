(() => {
  const db=()=>window.supabaseClient;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>c+' '+Number(v||0).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const date=v=>v?new Date(v).toLocaleString('pt-PT'):'—';

  async function isAdmin(){
    const s=(await db().auth.getSession()).data?.session;if(!s)return false;
    const r=await db().from('user_roles').select('role').eq('user_id',s.user.id).maybeSingle();
    return r.data?.role==='admin';
  }
  function msg(text,type='info'){const n=document.getElementById('admin-message');if(!n)return;n.textContent=text;n.dataset.type=type;n.hidden=false;}

  async function loadStock(){
    const root=document.getElementById('admin-stock-list'), alertBox=document.getElementById('admin-stock-alerts'), hist=document.getElementById('admin-inventory-list');
    if(!root)return;
    const r=await db().from('services').select('id,name,sku,category,unit_label,stock_quantity,low_stock_threshold,is_active').eq('item_type','material').order('name');
    if(r.error){msg('Não foi possível carregar o stock.','error');return;}
    const items=r.data||[], low=items.filter(x=>x.stock_quantity!=null&&Number(x.stock_quantity)<=Number(x.low_stock_threshold||0));
    if(alertBox){
      alertBox.hidden=low.length===0;
      alertBox.innerHTML=low.length?'<h3>Atenção: stock baixo</h3><div>'+low.map(x=>'<div><strong>'+esc(x.name)+'</strong> · '+Number(x.stock_quantity).toLocaleString('pt-PT')+' '+esc(x.unit_label||'unidade')+' (limite '+Number(x.low_stock_threshold||0).toLocaleString('pt-PT')+')</div>').join('')+'</div>':'';
    }
    root.innerHTML=items.map(x=>{
      const controlled=x.stock_quantity!=null;
      const lowNow=controlled&&Number(x.stock_quantity)<=Number(x.low_stock_threshold||0);
      return '<article class="cms-editor-card"><div class="editor-card-head"><div><span class="editor-kicker">'+esc(x.category||'Material')+'</span><h3>'+esc(x.name)+'</h3><small>'+esc(x.sku||'Sem SKU')+' · '+esc(x.unit_label||'unidade')+'</small></div><span class="admin-chip '+(lowNow?'chip-low':controlled?'chip-ok':'chip-off')+'">'+(controlled?(lowNow?'Stock baixo':'Stock controlado'):'Sem controlo')+'</span></div>'+
        '<div class="stock-item-row"><div><span>Stock atual</span><strong>'+(controlled?Number(x.stock_quantity).toLocaleString('pt-PT')+' '+esc(x.unit_label||'unidade'):'Não controlado')+'</strong></div><div><label>Alteração <input data-stock-delta="'+x.id+'" type="number" step="0.01" placeholder="+10 / -2" '+(controlled?'':'disabled')+'></label></div><div><label>Nota <input data-stock-note="'+x.id+'" placeholder="Motivo do ajuste" '+(controlled?'':'disabled')+'></label></div><button class="btn btn-secondary" type="button" data-adjust-stock="'+x.id+'" '+(controlled?'':'disabled')+'>Registar</button></div></article>';
    }).join('')||'<p>Não existem materiais no catálogo.</p>';

    root.querySelectorAll('[data-adjust-stock]').forEach(b=>b.addEventListener('click',async()=>{
      const id=b.dataset.adjustStock, delta=Number(root.querySelector('[data-stock-delta="'+id+'"]')?.value||0), note=root.querySelector('[data-stock-note="'+id+'"]')?.value.trim()||null;
      if(!Number.isFinite(delta)||delta===0){msg('Indique uma alteração de stock diferente de zero.','error');return;}
      b.disabled=true;
      const r=await db().rpc('admin_adjust_stock',{p_service_id:id,p_quantity_delta:delta,p_note:note});
      b.disabled=false;
      if(r.error){msg(r.error.message?.includes('STOCK_CANNOT')?'O stock não pode ficar negativo.':'Não foi possível registar o movimento de stock.','error');return;}
      msg('Stock atualizado e movimento registado.','success');await Promise.all([loadStock(),loadOverviewPatch()]);
    }));

    const h=await db().from('inventory_movements').select('id,service_id,order_id,movement_type,quantity_delta,stock_before,stock_after,note,created_at,services(name,unit_label)').order('created_at',{ascending:false}).limit(150);
    if(hist){
      hist.innerHTML=(h.data||[]).map(x=>'<tr><td>'+esc(date(x.created_at))+'</td><td>'+esc(x.services?.name||'Material')+'</td><td>'+esc(x.movement_type)+'</td><td>'+esc((Number(x.quantity_delta)>=0?'+':'')+Number(x.quantity_delta).toLocaleString('pt-PT'))+' '+esc(x.services?.unit_label||'')+'</td><td>'+esc(x.stock_before==null?'—':Number(x.stock_before).toLocaleString('pt-PT'))+'</td><td>'+esc(x.stock_after==null?'—':Number(x.stock_after).toLocaleString('pt-PT'))+'</td><td>'+esc(x.note||'')+'</td></tr>').join('')||'<tr><td colspan="7">Ainda não existem movimentos.</td></tr>';
    }
  }

  async function loadZones(){
    const root=document.getElementById('admin-delivery-zones');if(!root)return;
    const r=await db().from('delivery_zones').select('id,name,description,fee,is_active,sort_order,updated_at').order('sort_order').order('name');
    if(r.error){msg('Não foi possível carregar zonas de entrega.','error');return;}
    const add='<article class="cms-editor-card"><div class="editor-card-head"><div><span class="editor-kicker">NOVA ZONA</span><h3>Adicionar zona de entrega</h3></div></div><div class="zone-row"><label>Nome<input id="new-zone-name" placeholder="Ex.: Zona 1"></label><label>Descrição<input id="new-zone-description" placeholder="Área ou condição"></label><label>Taxa (AOA)<input id="new-zone-fee" type="number" min="0" step="0.01" value="0"></label><label>Ordem<input id="new-zone-order" type="number" min="0" step="1" value="0"></label><button class="btn btn-primary" type="button" id="save-new-zone">Adicionar</button></div></article>';
    const cards=(r.data||[]).map(z=>'<article class="cms-editor-card"><div class="zone-row"><label>Nome<input data-zone="'+z.id+'" data-field="name" value="'+esc(z.name)+'"></label><label>Descrição<input data-zone="'+z.id+'" data-field="description" value="'+esc(z.description||'')+'"></label><label>Taxa (AOA)<input data-zone="'+z.id+'" data-field="fee" type="number" min="0" step="0.01" value="'+Number(z.fee||0)+'"></label><label>Ordem<input data-zone="'+z.id+'" data-field="sort_order" type="number" min="0" step="1" value="'+Number(z.sort_order||0)+'"></label><div><label>Ativa<input data-zone="'+z.id+'" data-field="is_active" type="checkbox" '+(z.is_active?'checked':'')+'></label><div class="card-actions"><button class="btn btn-primary btn-small" type="button" data-save-zone="'+z.id+'">Guardar</button><button class="btn btn-secondary btn-small" type="button" data-delete-zone="'+z.id+'">Apagar</button></div></div></div></article>').join('');
    root.innerHTML=add+(cards||'<p>Sem zonas configuradas.</p>');
    root.querySelector('#save-new-zone')?.addEventListener('click',async()=>{
      const name=root.querySelector('#new-zone-name')?.value.trim()||'',description=root.querySelector('#new-zone-description')?.value.trim()||null,fee=Number(root.querySelector('#new-zone-fee')?.value||0),sort_order=Math.trunc(Number(root.querySelector('#new-zone-order')?.value||0));
      if(!name||!Number.isFinite(fee)||fee<0){msg('Indique o nome e uma taxa válida.','error');return;}
      const x=await db().from('delivery_zones').insert({name,description,fee,sort_order,is_active:true});
      if(x.error){msg('Não foi possível criar a zona.','error');return;}msg('Zona de entrega adicionada.','success');loadZones();
    });
    root.querySelectorAll('[data-save-zone]').forEach(b=>b.addEventListener('click',async()=>{
      const id=b.dataset.saveZone,patch={updated_at:new Date().toISOString()};
      root.querySelectorAll('[data-zone="'+id+'"]').forEach(f=>patch[f.dataset.field]=f.type==='checkbox'?f.checked:(f.dataset.field==='fee'?Number(f.value||0):f.dataset.field==='sort_order'?Math.trunc(Number(f.value||0)):f.value.trim()));
      if(!patch.name||!Number.isFinite(patch.fee)||patch.fee<0){msg('Nome e taxa são obrigatórios.','error');return;}
      const x=await db().from('delivery_zones').update(patch).eq('id',id);if(x.error){msg('Não foi possível guardar a zona.','error');return;}msg('Zona atualizada.','success');loadZones();
    }));
    root.querySelectorAll('[data-delete-zone]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Apagar esta zona de entrega?'))return;
      const x=await db().from('delivery_zones').delete().eq('id',b.dataset.deleteZone);if(x.error){msg('Não foi possível apagar a zona.','error');return;}msg('Zona removida.','success');loadZones();
    }));
  }

  async function loadOverviewPatch(){
    const r=await db().from('services').select('id').eq('is_active',true);
    const n=document.getElementById('admin-services-active');if(n)n.textContent=String(r.data?.length||0);
  }

  async function init(){
    if(!db()||!await isAdmin())return;
    await Promise.all([loadStock(),loadZones()]);
    db().channel('mukwatela-admin-advanced-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'services'},()=>{loadStock();loadOverviewPatch();})
      .on('postgres_changes',{event:'*',schema:'public',table:'inventory_movements'},loadStock)
      .on('postgres_changes',{event:'*',schema:'public',table:'delivery_zones'},loadZones)
      .subscribe();
  }
  document.addEventListener('DOMContentLoaded',init);
})();