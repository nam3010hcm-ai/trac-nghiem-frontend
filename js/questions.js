import { db, setDoc, doc, deleteDoc } from './firebase.js';
import { state, $, esc, KEYS } from './common.js';
import { fillSubcatSelect, updateQFormSubcat } from './categories.js';

let editQId = null;

export function openQForm(id=null){
  editQId = id;
  $('qform-title').textContent = id ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới';
  if(id){
    const q = state.questions.find(x => x.id === id);
    if(!q) return;
    $('qf-cat').value = q.cat || '';
    fillSubcatSelect('qf-subcat', q.cat, false);
    $('qf-subcat').value = q.subcat || '';
    $('qf-text').value = q.text || '';
    $('qf-a').value = q.opts?.[0] || '';
    $('qf-b').value = q.opts?.[1] || '';
    $('qf-c').value = q.opts?.[2] || '';
    $('qf-d').value = q.opts?.[3] || '';
    $('qf-ans').value = q.ans ?? 0;
  }else{
    ['qf-text','qf-a','qf-b','qf-c','qf-d'].forEach(id => $(id).value = '');
    $('qf-ans').value = '0';
    const currentFltCat = $('flt-cat').value;
    const currentFltSubcat = $('flt-subcat').value;
    if(currentFltCat){
      $('qf-cat').value = currentFltCat;
      fillSubcatSelect('qf-subcat', currentFltCat, false);
      if(currentFltSubcat) $('qf-subcat').value = currentFltSubcat;
    } else updateQFormSubcat();
  }
  $('qform').style.display = 'block';
}

export function closeQForm(){ $('qform').style.display = 'none'; editQId = null; }

export async function saveQ(){
  const text = $('qf-text').value.trim();
  const a = $('qf-a').value.trim(), b = $('qf-b').value.trim(), c = $('qf-c').value.trim(), d = $('qf-d').value.trim();
  if(!text || !a || !b || !c || !d){ alert('Vui lòng điền đầy đủ!'); return; }
  const cat = $('qf-cat').value;
  const subcat = $('qf-subcat').value;
  const ans = parseInt($('qf-ans').value);
  if(editQId){
    const q = state.questions.find(x => x.id === editQId);
    Object.assign(q,{cat,subcat,text,opts:[a,b,c,d],ans});
    await setDoc(doc(db, "questions", String(editQId)), q);
  } else {
    const newQ = {id:state.nextQId++,cat,subcat,text,opts:[a,b,c,d],ans};
    state.questions.push(newQ);
    await setDoc(doc(db, "questions", String(newQ.id)), newQ);
  }
  closeQForm();
  renderQuestions();
}

export async function deleteQ(id){
  if(!confirm('Xóa câu hỏi này?')) return;
  state.questions = state.questions.filter(q => q.id !== id);
  await deleteDoc(doc(db, "questions", String(id)));
  renderQuestions();
}

export function renderQuestions(){
  if(!$('q-count')) return;
  $('q-count').textContent = state.questions.length;
  const filterCat = $('flt-cat')?.value || '';
  const filterSC = $('flt-subcat')?.value || '';
  let qs = state.questions.slice();
  if(filterSC) qs = qs.filter(q => q.subcat === filterSC);
  else if(filterCat) qs = qs.filter(q => q.cat === filterCat);
  const groups = [...new Set(qs.map(q => q.subcat || q.cat || '(Chưa phân loại)'))].sort();
  $('q-list').innerHTML = groups.map(sc => {
    const sub = qs.filter(q => (q.subcat || q.cat || '(Chưa phân loại)') === sc);
    return `<div class="cat-hdr">${esc(sc)} (${sub.length})</div>` +
      sub.map(q => `<div class="qitem"><div class="qrow">
        <div class="qtext">${esc(q.text)}</div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-sm q-action" data-action="edit" data-id="${q.id}">Sửa</button>
          <button class="btn btn-sm btn-danger q-action" data-action="delete" data-id="${q.id}">Xóa</button>
        </div></div>
        <div style="margin-top:6px">${(q.opts||[]).map((o,i)=>`<span class="abadge${i===q.ans?' ok':''}">${KEYS[i]}. ${esc(o)}</span>`).join('')}</div>
      </div>`).join('');
  }).join('') || '<div class="empty">📭 Không có câu hỏi phù hợp.</div>';
}
