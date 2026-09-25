(() => {
  const db=()=>window.supabaseClient;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(v,c='AOA')=>v==null?'—':c+' '+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  async function init(){
    const session=(await db().auth.getSession()).data?.session;if(!session){location.href='auth.html';return;}
    const id=new URLSearchParams(location.search).get('id');if(!id)return;
    const d=await db().from('documents').select('id,order_id,customer_id,document_type,document_number,amount,currency,status,issue_date,due_date,notes').eq('id',id).maybeSingle();
    if(d.error||!d.data){document.getElementById('document-sheet').innerHTML='<h1>Documento não encontrado.</h1>';return;}
    const [settings,order]=await Promise.all([
      db().from('site_settings').select('key,value').in('key',['company_name','nif','address','email','phone']),
      db().from('orders').select('order_number,notes,order_items(service_name,quantity,unit_price,line_total,specifications)').eq('id',d.data.order_id).maybeSingle()
    ]);
    const s=Object.fromEntries((settings.data||[]).map(x=>[x.key,x.value]));
    const o=order.data||{};
    const items=o.order_items||[];
    const type=d.data.document_type==='proforma'?'FACTURA PROFORMA':'FACTURA';
    document.title='Mukwatela | '+type+' '+d.data.document_number;
    document.getElementById('document-sheet').innerHTML='<header class="document-header"><div><h1>'+esc(s.company_name||'Mukwatela')+'</h1><p>'+esc(s.address||'')+'</p><p>'+esc(s.email||'')+' · '+esc(s.phone||'')+'</p><p>NIF: '+esc(s.nif||'')+'</p></div><div class="document-title"><span>'+esc(type)+'</span><strong>'+esc(d.data.document_number)+'</strong><small>Data: '+esc(new Date(d.data.issue_date).toLocaleDateString('pt-PT'))+'</small>'+(d.data.due_date?'<small>Vencimento: '+esc(new Date(d.data.due_date+'T00:00:00').toLocaleDateString('pt-PT'))+'</small>':'')+'</div></header><section class="document-customer"><strong>Documento associado ao pedido</strong><span>'+esc(o.order_number||'—')+'</span></section><table class="document-table"><thead><tr><th>Descrição</th><th>Qtd.</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>'+items.map(i=>'<tr><td>'+esc(i.service_name)+'</td><td>'+esc(i.quantity)+'</td><td>'+esc(money(i.unit_price,d.data.currency))+'</td><td>'+esc(money(i.line_total,d.data.currency))+'</td></tr>').join('')+'</tbody></table><div class="document-total"><span>Total</span><strong>'+esc(money(d.data.amount,d.data.currency))+'</strong></div><div class="document-notes"><strong>Observações</strong><p>'+esc(d.data.notes||o.notes||'—')+'</p></div><footer class="document-footer"><p>Documento gerado pela plataforma Mukwatela.</p><p>Para efeitos fiscais, a empresa deverá emitir o documento através do seu sistema de facturação aplicável, quando exigido.</p></footer>';
  }
  document.addEventListener('DOMContentLoaded',init);
})();