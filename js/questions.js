import { db, setDoc, doc, deleteDoc } from './firebase.js';
import { state, $, esc, KEYS, mediaHTML, audioHTML, renderRich, typesetMath, TYPE_LABELS, splitBlanks, countBlanks } from './common.js';
import { fillSubcatSelect, updateQFormSubcat } from './categories.js';

let editQId = null;
let qPage = 1;

// --- Hiển thị/ẩn khối input tương ứng với loại câu hỏi đang chọn trong form ---
function applyQTypeUI(){
  const type = $('qf-type').value;
  const isBlankBased = type === 'fill_blank' || type === 'drag_drop';
  $('qf-mcq-block').style.display = (type === 'mcq_single' || type === 'mcq_multi') ? 'block' : 'none';
  $('qf-ans-single-wrap').style.display = type === 'mcq_single' ? 'block' : 'none';
  $('qf-ans-multi-wrap').style.display = type === 'mcq_multi' ? 'block' : 'none';
  $('qf-fillblank-block').style.display = isBlankBased ? 'block' : 'none';
  $('qf-bank-wrap').style.display = type === 'drag_drop' ? 'block' : 'none';
  $('qf-matching-block').style.display = type === 'matching' ? 'block' : 'none';
  if(isBlankBased) renderBlankInputs();
}

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
  $('qf-text').addEventListener('input', () => {
    const t = $('qf-type').value;
    if(t === 'fill_blank' || t === 'drag_drop') renderBlankInputs();
  });

  // --- XỬ LÝ UPLOAD VÀ NÉN ẢNH TỪ MÁY ---
  const imgFile = $('qf-image-file');
  if (imgFile && !imgFile.dataset.bound) {
      imgFile.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) {
              $('image-preview').innerHTML = '';
              $('qf-image').value = '';
              return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 800; 
                  const MAX_HEIGHT = 800; 
                  let width = img.width;
                  let height = img.height;

                  if (width > height) {
                      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                  } else {
                      if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                  }
                  
                  canvas.width = width; canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, width, height);
                  
                  const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                  
                  $('qf-image').value = compressedBase64; 
                  $('image-preview').innerHTML = `<img src="${compressedBase64}" style="max-width:100%; max-height:200px; border-radius:8px; margin-top:10px; border: 1px solid #e2e8f0;">`;
              };
              img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
      });
      imgFile.dataset.bound = "true";
  }

  const imgInput = $('qf-image');
  if (imgInput && !imgInput.dataset.bound) {
      imgInput.addEventListener('input', (e) => {
          const val = e.target.value.trim();
          $('image-preview').innerHTML = val ? `<img src="${val}" style="max-width:100%; max-height:200px; border-radius:8px; margin-top:10px; border: 1px solid #e2e8f0;">` : '';
      });
      imgInput.dataset.bound = "true";
  }

  // --- XỬ LÝ MỞ MODAL THƯ VIỆN ẢNH KHI BẤM NÚT "CHỌN TỪ THƯ VIỆN" ---
  const btnOpenGal = $('btn-open-gallery');
  if(btnOpenGal && !btnOpenGal.dataset.bound) {
      btnOpenGal.addEventListener('click', () => {
          const modal = $('modal-select-gallery');
          if (modal) {
              modal.style.display = 'flex';
              // Tải lại dữ liệu thư viện để đảm bảo ảnh mới nhất hiển thị
              if(typeof window.loadGallery === 'function') window.loadGallery(); 
          }
      });
      btnOpenGal.dataset.bound = "true";
  }

  const btnCloseGal = $('btn-close-gallery-modal');
  if(btnCloseGal && !btnCloseGal.dataset.bound) {
      btnCloseGal.addEventListener('click', () => {
          const modal = $('modal-select-gallery');
          if (modal) modal.style.display = 'none';
      });
      btnCloseGal.dataset.bound = "true";
  }
}

export function openQForm(id = null){
  editQId = id;
  $('qform-title').textContent = id ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới';
  ['qf-ans-m0','qf-ans-m1','qf-ans-m2','qf-ans-m3'].forEach(cid => { if($(cid)) $(cid).checked = false; });
  
  // RESET TRIỆT ĐỂ KHỐI HÌNH ẢNH MỖI LẦN MỞ FORM
  if($('qf-image-file')) $('qf-image-file').value = '';
  if($('qf-image')) $('qf-image').value = '';
  if($('image-preview')) $('image-preview').innerHTML = '';

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
    
    if(q.image) {
        $('qf-image').value = q.image;
        $('image-preview').innerHTML = `<img src="${q.image}" style="max-width:100%; max-height:200px; border-radius:8px; margin-top:10px; border: 1px solid #e2e8f0;">`;
    }

    if($('qf-explain')) $('qf-explain').value = q.explain || '';
    $('qf-a').value = q.opts?.[0] || '';
    $('qf-b').value = q.opts?.[1] || '';
    $('qf-c').value = q.opts?.[2] || '';
    $('qf-d').value = q.opts?.[3] || '';
    if(type === 'mcq_multi'){
      (q.ans || []).forEach(i => { const cb = $('qf-ans-m'+i); if(cb) cb.checked = true; });
    }else{
      $('qf-ans').value = q.ans ?? 0;
    }
    if($('qf-bank')) $('qf-bank').value = (q.bank || []).join(', ');
    if($('qf-pairs')) $('qf-pairs').value = (q.pairs || []).map(p => `${p.left} = ${p.right}`).join('\n');
    applyQTypeUI();
    if(type === 'fill_blank' || type === 'drag_drop') renderBlankInputs(q.blanks || []);
  }else{
    ['qf-text','qf-audio','qf-explain','qf-a','qf-b','qf-c','qf-d','qf-bank','qf-pairs'].forEach(id => { if($(id)) $(id).value = ''; });
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
  
  // TỰ ĐỘNG CUỘN LÊN FORM MƯỢT MÀ
  $('qform').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function closeQForm(){ $('qform').style.display = 'none'; editQId = null; }

export async function saveQ(){
  const type = $('qf-type').value;
  const text = $('qf-text').value.trim();
  if(!text){ alert('Vui lòng nhập nội dung câu hỏi!'); return; }
  const image = $('qf-image') ? $('qf-image').value.trim() : '';
  const audio = $('qf-audio') ? $('qf-audio').value.trim() : '';
  const explain = $('qf-explain') ? $('qf-explain').value.trim() : ''; 
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
  }else if(type === 'fill_blank' || type === 'drag_drop'){
    const n = countBlanks(text);
    if(!n){ alert('Câu hỏi cần có ít nhất 1 dấu ___ đánh dấu chỗ trống!'); return; }
    const blanks = Array.from($('qf-blanks-wrap').querySelectorAll('.qf-blank-input')).map(i => i.value.trim());
    if(blanks.some(b => !b)){ alert('Vui lòng nhập đáp án đúng cho tất cả các chỗ trống!'); return; }
    fields.blanks = blanks;
    if(type === 'drag_drop'){
      const bank = ($('qf-bank').value || '').split(',').map(s => s.trim()).filter(Boolean);
      if(bank.length < n){ alert('Ngân hàng từ cần có ít nhất bằng số chỗ trống!'); return; }
      fields.bank = bank;
    }
  }else if(type === 'matching'){
    const lines = ($('qf-pairs').value || '').split('\n').map(l => l.trim()).filter(Boolean);
    const pairs = lines.map(l => {
      const i = l.indexOf('=');
      if(i < 0) return null;
      return { left: l.slice(0,i).trim(), right: l.slice(i+1).trim() };
    }).filter(p => p && p.left && p.right);
    if(pairs.length < 2){ alert('Cần ít nhất 2 cặp ghép hợp lệ, định dạng mỗi dòng: Trái = Phải'); return; }
    fields.pairs = pairs;
  }

  if(editQId){
    const q = state.questions.find(x => x.id === editQId);
    delete q.opts; delete q.ans; delete q.blanks; delete q.bank; delete q.pairs;
    Object.assign(q, { cat, subcat, text, image, audio, explain, ...fields }); 
    await setDoc(doc(db, "questions", String(editQId)), q);
  }else{
    const newQ = { id: state.nextQId++, cat, subcat, text, image, audio, explain, ...fields }; 
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
    }else if(type === 'fill_blank' || type === 'drag_drop'){
      answerHTML = (q.blanks || []).map((b,i) => `<span class="abadge ok">#${i+1}: ${renderRich(b)}</span>`).join('');
      if(q.bank?.length) answerHTML += `<div style="margin-top:4px;font-size:11px;color:#6b7280">Ngân hàng từ: ${esc(q.bank.join(', '))}</div>`;
    }else if(type === 'matching'){
      answerHTML = (q.pairs || []).map(p => `<span class="abadge ok">${esc(p.left)} → ${esc(p.right)}</span>`).join('');
    }

    const explainHTML = q.explain ? `<div style="margin-top:6px; font-size:12px; color:#475569; background:#f8fafc; padding:6px 10px; border-radius:4px; border-left:3px solid #059669;">💡 <b>Giải thích:</b> ${renderRich(q.explain)}</div>` : '';

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
      ${explainHTML}
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
      const explain = String(r.explain || r.Explain || r['Giải thích'] || '').trim();
      const opts = ['A','B','C','D'].map(k => String(r[k] || r[k.toLowerCase()] || '').trim());
      let ansRaw = String(r.ans || r.Answer || r.answer || r['Đáp án'] || r['Dap an'] || 'A').trim().toUpperCase();
      let ans = ['A','B','C','D'].indexOf(ansRaw);
      if(ans < 0 && /^[0-3]$/.test(ansRaw)) ans = parseInt(ansRaw);
      if(!cat || !text || opts.some(x=>!x) || ans < 0) continue;
      const q = { id: state.nextQId++, cat, subcat, text, image, explain, opts, ans };
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
