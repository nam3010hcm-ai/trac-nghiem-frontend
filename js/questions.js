import { db, setDoc, doc, deleteDoc } from './firebase.js';
import { state, $, esc, KEYS, mediaHTML, audioHTML, renderRich, typesetMath, TYPE_LABELS, splitBlanks, countBlanks } from './common.js';
import { fillSubcatSelect, updateQFormSubcat } from './categories.js';

let editQId = null;
let qPage = 1;

// --- Hiển thị/ẩn khối input tương ứng với loại câu hỏi đang chọn trong form ---
function applyQTypeUI(){
  const type = $('qf-type').value;
  $('qf-mcq-block').style.display = (type === 'mcq_single' || type === 'mcq_multi') ? 'block' : 'none';
  $('qf-ans-single-wrap').style.display = type === 'mcq_single' ? 'block' : 'none';
  $('qf-ans-multi-wrap').style.display = type === 'mcq_multi' ? 'block' : 'none';
  $('qf-fillblank-block').style.display = type === 'fill_blank' ? 'block' : 'none';
  if(type === 'fill_blank') renderBlankInputs();
}

// Sinh lại các ô nhập "đáp án đúng" theo số dấu ___ có trong nội dung câu hỏi,
// giữ nguyên giá trị đã nhập cho các ô còn khớp vị trí (existingVals dùng khi mở sửa câu hỏi cũ)
function renderBlankInputs(existingVals = null){
  const wrap = $('qf-blanks-wrap');
  const n = countBlanks($('qf-text').value);
  const prevVals = existingVals || Array.from(wrap.querySelectorAll('.qf-blank-input')).map(i => i.value);
  if(!n){
    wrap.innerHTML = '<div class="empty" style="padding:8px 0">Chưa có dấu ___ nào trong câu hỏi.</div>';
    return;
  }
  wrap.innerHTML = Array.from({length:n}).map((_,i) => `
    <div class="fg" style="margin:0 0 8px">
      <label>Đáp án đúng - chỗ trống #${i+1}</label>
      <input class="qf-blank-input" data-idx="${i}" value="${esc(prevVals[i] || '')}" placeholder="VD: is|'s">
    </div>`).join('');
}

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

  $('qf-type').addEventListener('change', applyQTypeUI);
  $('qf-text').addEventListener('input', () => { if($('qf-type').value === 'fill_blank') renderBlankInputs(); });
}

export function openQForm(id = null){
  editQId = id;
  $('qform-title').textContent = id ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới';
  ['qf-ans-m0','qf-ans-m1','qf-ans-m2','qf-ans-m3'].forEach(cid => { if($(cid)) $(cid).checked = false; });
  if(id){
    const q = state.questions.find(x => x.id === id);
    if(!q) return;
    const type = q.type || 'mcq_single';
    $('qf-type').value = type;
    $('qf-cat').value = q.cat || '';
    fillSubcatSelect('qf-subcat', q.cat, false);
    $('qf-subcat').value = q.subcat || '';
    $('qf-text').value = q.text || '';
    if($('qf-audio')) $('qf-audio').value = q.audio || '';
    if($('qf-image')) $('qf-image').value = q.image || '';
    $('qf-a').value = q.opts?.[0] || '';
    $('qf-b').value = q.opts?.[1] || '';
    $('qf-c').value = q.opts?.[2] || '';
    $('qf-d').value = q.opts?.[3] || '';
    if(type === 'mcq_multi'){
      (q.ans || []).forEach(i => { const cb = $('qf-ans-m'+i); if(cb) cb.checked = true; });
    }else{
      $('qf-ans').value = q.ans ?? 0;
    }
    applyQTypeUI();
    if(type === 'fill_blank') renderBlankInputs(q.blanks || []);
  }else{
    ['qf-text','qf-audio','qf-image','qf-a','qf-b','qf-c','qf-d'].forEach(id => { if($(id)) $(id).value = ''; });
    $('qf-ans').value = '0';
    $('qf-type').value = 'mcq_single';
    applyQTypeUI();
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
  const type = $('qf-type').value;
  const text = $('qf-text').value.trim();
  if(!text){ alert('Vui lòng nhập nội dung câu hỏi!'); return; }
  const image = $('qf-image') ? $('qf-image').value.trim() : '';
  const audio = $('qf-audio') ? $('qf-audio').value.trim() : '';
  const cat = $('qf-cat').value;
  const subcat = $('qf-subcat').value;

  let fields = { type };
  if(type === 'mcq_single' || type === 'mcq_multi'){
    const opts = ['qf-a','qf-b','qf-c','qf-d'].map(id => $(id).value.trim());
    if(opts.some(x => !x)){ alert('Vui lòng điền đầy đủ 4 đáp án A/B/C/D!'); return; }
    if(type === 'mcq_single'){
      fields.opts = opts;
      fields.ans = parseInt($('qf-ans').value);
    }else{
      const ans = ['qf-ans-m0','qf-ans-m1','qf-ans-m2','qf-ans-m3']
        .map((id,i) => $(id).checked ? i : -1).filter(i => i >= 0);
      if(ans.length < 2){ alert('Trắc nghiệm nhiều đáp án cần chọn ít nhất 2 ô đúng!'); return; }
      fields.opts = opts;
      fields.ans = ans;
    }
  }else if(type === 'fill_blank'){
    const n = countBlanks(text);
    if(!n){ alert('Câu hỏi điền từ cần có ít nhất 1 dấu ___ đánh dấu chỗ trống!'); return; }
    const blanks = Array.from($('qf-blanks-wrap').querySelectorAll('.qf-blank-input')).map(i => i.value.trim());
    if(blanks.some(b => !b)){ alert('Vui lòng nhập đáp án đúng cho tất cả các chỗ trống!'); return; }
    fields.blanks = blanks;
  }

  if(editQId){
    const q = state.questions.find(x => x.id === editQId);
    // Xóa field của loại cũ (vd đổi từ mcq sang fill_blank) rồi gán field mới
    delete q.opts; delete q.ans; delete q.blanks;
    Object.assign(q, { cat, subcat, text, image, audio, ...fields });
    await setDoc(doc(db, "questions", String(editQId)), q);
  }else{
    const newQ = { id: state.nextQId++, cat, subcat, text, image, audio, ...fields };
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

  $('q-list').innerHTML = pageItems.map(q => {
    const type = q.type || 'mcq_single';
    let answerHTML = '';
    if(type === 'mcq_single' || type === 'mcq_multi'){
      const correctSet = type === 'mcq_multi' ? (q.ans || []) : [q.ans];
      answerHTML = (q.opts || []).map((o,i) => `<span class="abadge ${correctSet.includes(i)?'ok':''}">${KEYS[i]}. ${renderRich(o)}</span>`).join('');
    }else if(type === 'fill_blank'){
      answerHTML = (q.blanks || []).map((b,i) => `<span class="abadge ok">#${i+1}: ${renderRich(b)}</span>`).join('');
    }
    return `
    <div class="qitem">
      <div class="qrow">
        <div class="qtext">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">
            <div class="cat-badge">${esc(q.subcat || q.cat || 'Chưa phân loại')}</div>
            <div class="cat-badge" style="background:#eef2ff;color:#4338ca">${esc(TYPE_LABELS[type] || type)}</div>
            ${q.audio ? '<div class="cat-badge" style="background:#fef3c7;color:#92400e">🔊 Nghe</div>' : ''}
          </div>
          <div>${renderRich(q.text)}</div>
          ${mediaHTML(q.image)}
          ${audioHTML(q.audio)}
        </div>
        <div>
          <button class="btn btn-sm q-action" data-action="edit" data-id="${q.id}">Sửa</button>
          <button class="btn btn-sm btn-danger q-action" data-action="delete" data-id="${q.id}">Xóa</button>
        </div>
      </div>
      <div style="margin-top:8px">${answerHTML}</div>
    </div>`;
  }).join('') || '<div class="empty">Không có câu hỏi phù hợp.</div>';

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
