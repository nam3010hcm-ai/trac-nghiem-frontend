import { db, setDoc, doc, deleteDoc } from './firebase.js';
import { state, $, esc, KEYS, mediaHTML, renderRich, typesetMath } from './common.js';
import { fillSubcatSelect, updateQFormSubcat } from './categories.js';

let editQId = null;
let qPage = 1;

function getPageSize(){ return parseInt($('q-page-size')?.value || '10') || 10; }
function getSearch(){ return ($('q-search')?.value || '').trim().toLowerCase(); }

function ensureQuestionTools(){
  const list = $('q-list');
  if(!list || $('q-search')) return;
  const box = document.createElement('div');
  box.className = 'q-tools card-lite';
  box.innerHTML = `
    <div class="grid2">
      <div class="fg"><label>Tìm kiếm</label><input id="q-search" placeholder="Nhập từ khóa trong câu hỏi/đáp án..."></div>
      <div class="fg"><label>Số câu/trang</label><select id="q-page-size"><option>10</option><option>20</option><option>50</option><option>100</option></select></div>
    </div>
    <div class="import-row">
      <input id="q-import-file" type="file" accept=".xlsx,.xls,.csv" style="display:none">
      <button class="btn" id="btn-import-xlsx" type="button">⬆ Import Excel/CSV</button>
      <button class="btn" id="btn-download-template" type="button">⬇ Tải mẫu CSV</button>
      <span class="math-note">Cột hỗ trợ: cat, subcat, text, image, A, B, C, D, ans</span>
    </div>`;
  list.parentNode.insertBefore(box, list);
  $('q-search').addEventListener('input', () => { qPage = 1; renderQuestions(); });
  $('q-page-size').addEventListener('change', () => { qPage = 1; renderQuestions(); });
  $('btn-import-xlsx').addEventListener('click', () => $('q-import-file').click());
  $('q-import-file').addEventListener('change', importQuestionsFromFile);
  $('btn-download-template').addEventListener('click', downloadTemplateCSV);
}

export function openQForm(id = null){
  editQId = id;
  $('qform-title').textContent = id ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới';
  if(id){
    const q = state.questions.find(x => x.id === id);
    if(!q) return;
    $('qf-cat').value = q.cat || '';
    fillSubcatSelect('qf-subcat', q.cat, false);
    $('qf-subcat').value = q.subcat || '';
    $('qf-text').value = q.text || '';
    if($('qf-image')) $('qf-image').value = q.image || '';
    $('qf-a').value = q.opts?.[0] || '';
    $('qf-b').value = q.opts?.[1] || '';
    $('qf-c').value = q.opts?.[2] || '';
    $('qf-d').value = q.opts?.[3] || '';
    $('qf-ans').value = q.ans ?? 0;
  }else{
    ['qf-text','qf-image','qf-a','qf-b','qf-c','qf-d'].forEach(id => { if($(id)) $(id).value = ''; });
    $('qf-ans').value = '0';
    const currentFltCat = $('flt-cat')?.value || '';
    const currentFltSubcat = $('flt-subcat')?.value || '';
    if(currentFltCat){
      $('qf-cat').value = currentFltCat;
      fillSubcatSelect('qf-subcat', currentFltCat, false);
      if(currentFltSubcat) $('qf-subcat').value = currentFltSubcat;
    }else updateQFormSubcat();
  }
  $('qform').style.display = 'block';
  typesetMath($('qform'));
}

export function closeQForm(){ $('qform').style.display = 'none'; editQId = null; }

export async function saveQ(){
  const text = $('qf-text').value.trim();
  const image = $('qf-image') ? $('qf-image').value.trim() : '';
  const opts = ['qf-a','qf-b','qf-c','qf-d'].map(id => $(id).value.trim());
  if(!text || opts.some(x => !x)){ alert('Vui lòng điền đầy đủ nội dung câu hỏi và 4 đáp án!'); return; }
  const cat = $('qf-cat').value;
  const subcat = $('qf-subcat').value;
  const ans = parseInt($('qf-ans').value);
  if(editQId){
    const q = state.questions.find(x => x.id === editQId);
    Object.assign(q, { cat, subcat, text, image, opts, ans });
    await setDoc(doc(db, "questions", String(editQId)), q);
  }else{
    const newQ = { id: state.nextQId++, cat, subcat, text, image, opts, ans };
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

function filteredQuestions(){
  const filterCat = $('flt-cat')?.value || '';
  const filterSC = $('flt-subcat')?.value || '';
  const kw = getSearch();
  let qs = state.questions.slice();
  if(filterSC) qs = qs.filter(q => q.subcat === filterSC);
  else if(filterCat) qs = qs.filter(q => q.cat === filterCat);
  if(kw){
    qs = qs.filter(q => [q.text, q.cat, q.subcat, ...(q.opts||[])].join(' ').toLowerCase().includes(kw));
  }
  return qs.sort((a,b)=>(b.id||0)-(a.id||0));
}

export function renderQuestions(){
  ensureQuestionTools();
  if(!$('q-count')) return;
  $('q-count').textContent = state.questions.length;
  const qs = filteredQuestions();
  const pageSize = getPageSize();
  const totalPages = Math.max(1, Math.ceil(qs.length / pageSize));
  qPage = Math.min(Math.max(qPage, 1), totalPages);
  const pageItems = qs.slice((qPage-1)*pageSize, qPage*pageSize);

  $('q-list').innerHTML = pageItems.map(q => `
    <div class="qitem">
      <div class="qrow">
        <div class="qtext">
          <div class="cat-badge">${esc(q.subcat || q.cat || 'Chưa phân loại')}</div>
          <div>${renderRich(q.text)}</div>
          ${mediaHTML(q.image)}
        </div>
        <div>
          <button class="btn btn-sm q-action" data-action="edit" data-id="${q.id}">Sửa</button>
          <button class="btn btn-sm btn-danger q-action" data-action="delete" data-id="${q.id}">Xóa</button>
        </div>
      </div>
      <div style="margin-top:8px">
        ${(q.opts || []).map((o,i) => `<span class="abadge ${i===q.ans?'ok':''}">${KEYS[i]}. ${renderRich(o)}</span>`).join('')}
      </div>
    </div>`).join('') || '<div class="empty">Không có câu hỏi phù hợp.</div>';

  let pager = $('q-pager');
  if(!pager){
    pager = document.createElement('div');
    pager.id = 'q-pager';
    pager.className = 'pager';
    $('q-list').after(pager);
  }
  pager.innerHTML = `
    <button class="btn btn-sm" id="q-prev" ${qPage<=1?'disabled':''}>← Trước</button>
    <span>Trang ${qPage}/${totalPages} • Đang hiển thị ${pageItems.length}/${qs.length} câu phù hợp</span>
    <button class="btn btn-sm" id="q-next" ${qPage>=totalPages?'disabled':''}>Sau →</button>`;
  $('q-prev').onclick = () => { qPage--; renderQuestions(); };
  $('q-next').onclick = () => { qPage++; renderQuestions(); };
  typesetMath($('q-list'));
}

function downloadTemplateCSV(){
  const csv = '\uFEFFcat,subcat,text,image,A,B,C,D,ans\nToán,Toán/Phần 1 - Số học,"Tính $2^5+3^2$",,"$32$","$41$","$25$","$64$",B';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  a.download = 'mau_import_cau_hoi.csv';
  a.click();
}

async function loadSheetJS(){
  if(window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.XLSX;
}

async function importQuestionsFromFile(e){
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const XLSX = await loadSheetJS();
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type:'array'});
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
    let added = 0;
    for(const r of rows){
      const cat = String(r.cat || r.Cat || r['Chủ đề'] || r['Chu de'] || '').trim();
      const subcat = String(r.subcat || r.Subcat || r['Phần'] || r['Phan'] || '').trim();
      const text = String(r.text || r.Question || r.question || r['Câu hỏi'] || r['Cau hoi'] || '').trim();
      const image = String(r.image || r.Image || r['Hình ảnh'] || '').trim();
      const opts = ['A','B','C','D'].map(k => String(r[k] || r[k.toLowerCase()] || '').trim());
      let ansRaw = String(r.ans || r.Answer || r.answer || r['Đáp án'] || r['Dap an'] || 'A').trim().toUpperCase();
      let ans = ['A','B','C','D'].indexOf(ansRaw);
      if(ans < 0 && /^[0-3]$/.test(ansRaw)) ans = parseInt(ansRaw);
      if(!cat || !text || opts.some(x=>!x) || ans < 0) continue;
      const q = { id: state.nextQId++, cat, subcat, text, image, opts, ans };
      state.questions.push(q);
      await setDoc(doc(db, "questions", String(q.id)), q);
      added++;
    }
    alert(`✅ Đã import ${added} câu hỏi.`);
    e.target.value = '';
    renderQuestions();
  }catch(err){
    console.error(err);
    alert('Không import được file. Hãy kiểm tra định dạng cột hoặc kết nối mạng để tải thư viện XLSX.');
  }
}
