import { db, setDoc, doc } from './firebase.js';
import { state, $, esc, clone, DEFAULT_SUBCATS } from './common.js';
import { renderQuestions } from './questions.js';
import { renderExams, populateExamSelect } from './exams.js';

export function fillSubcatSelect(selId, cat, addAll=true, allLabel='(Tất cả phần)'){
  const sel = $(selId);
  if(!sel) return;
  const scs = state.SUBCATS[cat] || [];
  sel.innerHTML = (addAll ? `<option value="">${esc(allLabel)}</option>` : '') +
    scs.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
}

export function populateCategoryDropdowns(){
  const cats = Object.keys(state.SUBCATS).sort();
  const setOptions = (id, prefix='') => { const el=$(id); if(el) el.innerHTML = prefix + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join(''); };
  setOptions('flt-cat','<option value="">(Tất cả chủ đề)</option>');
  setOptions('qf-cat');
  setOptions('ef-cat','<option value="">(Tất cả chủ đề)</option>');
  setOptions('add-sub-parent');
}

export function updateFltSubcat(){ fillSubcatSelect('flt-subcat', $('flt-cat')?.value || '', true, '(Tất cả phần)'); }
export function updateQFormSubcat(){ fillSubcatSelect('qf-subcat', $('qf-cat')?.value || '', false); }
export function updateEFormSubcat(){ fillSubcatSelect('ef-subcat', $('ef-cat')?.value || '', true, '(Không lọc theo phần)'); }

export async function addParentCategory(){
  const name = $('new-parent-cat').value.trim();
  if(!name){ alert('Vui lòng nhập tên chủ đề cha!'); return; }
  const exists = Object.keys(state.SUBCATS).some(c => c.toLowerCase() === name.toLowerCase());
  if(exists){ alert('Chủ đề cha này đã tồn tại!'); return; }
  state.SUBCATS[name] = [];
  await setDoc(doc(db, "metadata", "categories"), state.SUBCATS);
  $('new-parent-cat').value = '';
  refreshCategoryUI();
  alert('✅ Đã thêm chủ đề cha!');
}

export async function deleteParentCategory(parent){
  if(!confirm(`Xóa chủ đề cha "${parent}"? Các câu hỏi/đề thi thuộc chủ đề này sẽ bị bỏ liên kết.`)) return;
  const subs = state.SUBCATS[parent] || [];
  delete state.SUBCATS[parent];

  for(const q of state.questions){
    if(q.cat === parent || subs.includes(q.subcat)){ q.cat=''; q.subcat=''; await setDoc(doc(db, "questions", String(q.id)), q); }
  }
  for(const e of state.exams){
    if(e.cat === parent || subs.includes(e.subcat)){ e.cat=''; e.subcat=''; await setDoc(doc(db, "exams", String(e.id)), e); }
  }
  await setDoc(doc(db, "metadata", "categories"), state.SUBCATS);
  refreshCategoryUI();
  renderQuestions();
  renderExams();
  alert('✅ Đã xóa chủ đề cha!');
}

export async function addSubCategory(){
  const parent = $('add-sub-parent').value;
  let subName = $('new-sub-cat').value.trim();
  if(!parent || !subName){ alert('Vui lòng chọn chủ đề cha và nhập tên chủ đề con!'); return; }
  if(!state.SUBCATS[parent]) state.SUBCATS[parent] = [];
  if(!subName.startsWith(parent + '/')) subName = parent + '/' + subName;
  const exists = state.SUBCATS[parent].some(s => s.trim().toLowerCase() === subName.trim().toLowerCase());
  if(exists){ alert('Phần con này đã tồn tại!'); return; }
  state.SUBCATS[parent].push(subName);
  await setDoc(doc(db, "metadata", "categories"), state.SUBCATS);
  $('new-sub-cat').value = '';
  refreshCategoryUI();
  alert('✅ Đã thêm chủ đề con!');
}

export async function deleteSubCategory(parent, sub){
  if(!confirm(`Xóa phần con "${sub}"? Các câu hỏi/đề thi thuộc phần này sẽ bị bỏ liên kết.`)) return;
  state.SUBCATS[parent] = (state.SUBCATS[parent] || []).filter(s => s !== sub);
  for(const q of state.questions){
    if(q.subcat === sub){ q.subcat = ''; await setDoc(doc(db, "questions", String(q.id)), q); }
  }
  for(const e of state.exams){
    if(e.subcat === sub){ e.subcat = ''; await setDoc(doc(db, "exams", String(e.id)), e); }
  }
  await setDoc(doc(db, "metadata", "categories"), state.SUBCATS);
  refreshCategoryUI();
  renderQuestions();
  renderExams();
  alert('✅ Đã xóa chủ đề con!');
}

export async function editSubCategory(parent, oldSub){
  const defaultName = oldSub.startsWith(parent + '/') ? oldSub.substring(parent.length + 1) : oldSub;
  let newNamePart = prompt(`Nhập tên mới cho phần con (thuộc chủ đề ${parent}):`, defaultName);
  if(newNamePart === null) return;
  newNamePart = newNamePart.trim();
  if(!newNamePart) return;
  const newSub = parent + '/' + newNamePart;
  if(newSub === oldSub) return;
  if((state.SUBCATS[parent] || []).some(s => s.toLowerCase() === newSub.toLowerCase())){ alert('Tên phần con này đã tồn tại!'); return; }

  const idx = state.SUBCATS[parent].indexOf(oldSub);
  if(idx === -1) return;
  state.SUBCATS[parent][idx] = newSub;
  await setDoc(doc(db, "metadata", "categories"), state.SUBCATS);

  let qCount = 0, eCount = 0;
  for(const q of state.questions){
    if(q.subcat === oldSub){ q.subcat = newSub; await setDoc(doc(db, "questions", String(q.id)), q); qCount++; }
  }
  for(const e of state.exams){
    if(e.subcat === oldSub){ e.subcat = newSub; await setDoc(doc(db, "exams", String(e.id)), e); eCount++; }
  }
  refreshCategoryUI();
  renderQuestions();
  renderExams();
  populateExamSelect();
  alert(`✅ Đổi tên thành công!\nĐồng bộ: ${qCount} câu hỏi, ${eCount} đề thi`);
}

export async function restoreDefaultCategories(){
  if(!confirm('Khôi phục danh mục gốc? Các chủ đề bạn tạo thêm có thể bị xóa.')) return;
  state.SUBCATS = clone(DEFAULT_SUBCATS);
  await setDoc(doc(db, "metadata", "categories"), state.SUBCATS);
  refreshCategoryUI();
  alert('✅ Đã khôi phục danh mục gốc!');
}

export function renderCatManagementList(){
  const listDiv = $('cat-management-list');
  if(!listDiv) return;
  const cats = Object.keys(state.SUBCATS).sort();
  if(!cats.length){ listDiv.innerHTML = '<div class="empty">📭 Hệ thống chưa có danh mục nào.</div>'; return; }
  listDiv.innerHTML = cats.map(parent => {
    const subs = state.SUBCATS[parent] || [];
    return `<div class="qitem">
      <div class="qrow" style="border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px">
        <strong>📁 Chủ đề cha: ${esc(parent)} (${subs.length} phần con)</strong>
        <button class="btn btn-sm btn-danger cat-action" data-action="delete-parent" data-parent="${esc(parent)}">Xóa Cha</button>
      </div>
      <div style="padding-left:16px">
        ${subs.length === 0 ? '<span style="font-size:12px;color:#94a3b8;font-style:italic">(Chưa có phần con)</span>' :
          subs.map(sub => `<div class="qrow" style="padding:5px 0;border-bottom:1px dashed #f1f5f9">
            <span>🔹 ${esc(sub)}</span>
            <div>
              <button class="btn btn-sm cat-action" data-action="edit-sub" data-parent="${esc(parent)}" data-sub="${esc(sub)}">Sửa</button>
              <button class="btn btn-sm btn-danger cat-action" data-action="delete-sub" data-parent="${esc(parent)}" data-sub="${esc(sub)}">Xóa</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

export function refreshCategoryUI(){
  populateCategoryDropdowns();
  updateFltSubcat();
  updateQFormSubcat();
  updateEFormSubcat();
  renderCatManagementList();
}
