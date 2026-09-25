  function renderPayments(){
    const list=document.getElementById('payment-methods-admin');
    if(!list)return;
    const data=filtered(cache.payments,filters.paymentsSearch,[x=>x.code,x=>x.name,x=>x.description,x=>x.account_details,x=>x.instructions]).filter(x=>!filters.paymentsActive||String(x.is_active)===filters.paymentsActive);
    const addCard='<article class="cms-editor-card payment-add-card"><div class="editor-card-head"><div><span class="editor-kicker">NOVO</span><h3>Adicionar ou atualizar método de pagamento</h3></div><span class="admin-chip chip-off">Não publicado</span></div><div class="field-two cms-field-grid"><div><label>Nome *</label><input id="new-payment-name" placeholder="Ex.: Transferência bancária"></div><div><label>Código *</label><input id="new-payment-code" placeholder="Ex.: transferencia"></div><div><label>Ordem</label><input id="new-payment-order" type="number" value="0" min="0" step="1"></div></div><div class="field-row"><label>Descrição</label><input id="new-payment-description" placeholder="Descrição apresentada ao cliente"></div><div class="field-row"><label>Dados de recebimento</label><textarea id="new-payment-account" rows="3" placeholder="IBAN, titular, conta ou outros dados necessários"></textarea></div><div class="field-row"><label>Instruções</label><textarea id="new-payment-instructions" rows="3" placeholder="Como o cliente deve efetuar e comprovar o pagamento"></textarea></div><div class="inline-action-row"><label class="checkbox-row"><input id="new-payment-active" type="checkbox" checked> Disponível no checkout</label><button class="btn btn-primary" type="button" data-add-payment>Guardar método</button></div></article>';
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
      const existing=cache.payments.find(item=>item.code===code);
      const payload={code,name,description,account_details:accountDetails,instructions,is_active:isActive,sort_order:Math.trunc(sortOrder),updated_at:new Date().toISOString()};
      let result;
      if(existing){
        result=await db().from('payment_methods').update(payload).eq('id',existing.id);
      }else{
        result=await db().from('payment_methods').insert(payload);
      }
      if(result.error){
        console.error(result.error);
        const duplicate=result.error.code==='23505';
        msg(duplicate?'Esse código de pagamento já existe. Verifique o código informado.':'Não foi possível guardar o método de pagamento: '+(result.error.message||'erro desconhecido')+'.','error');
        return;
      }
      msg(existing?'Método de pagamento atualizado com sucesso.':'Método de pagamento adicionado com sucesso.','success');
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