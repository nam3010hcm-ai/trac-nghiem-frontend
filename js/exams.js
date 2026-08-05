import { db, setDoc, doc, deleteDoc } from './firebase.js';
import { state, $, esc, getPool } from './common.js';
import { updateEFormSubcat } from './categories.js';

export function populateExamSelect(){
  const sel = $('s-exam');
  if(!sel) return;
  const visibleExams = state.exams.filter(e => !e.isHidden);
  if(!visibleExams.length){
    sel.innerHTML = '<option value="">(Không có đề thi nào đang mở)</option>';
    const desc = $('s-exam-desc'); if(desc) desc.textContent = '';
    return;
  }
  sel.innerHTML = visibleExams.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  updateExamDesc();
}

export function updateExamDesc(){
  const sel = $('s-exam');
  if(!sel || !sel.value) return;
  const e = state.exams.find(x => x.id === parseInt(sel.value));
  const pool = e ? getPool(e).length : 0;
  $('s-exam-desc').textContent = e ? `${e.desc || ''} • ${e.count} câu • Ngân hàng: ${pool} câu${e.timeLimit>0?' • ⏱ '+e.timeLimit+' phút':''}` : '';
}

export function openEForm(id = null) {
    $('eform').style.display = 'block';
    
    if (id) {
        // --- TRƯỜNG HỢP: SỬA ĐỀ THI ---
        const exam = state.exams.find(e => e.id === id);
        if (exam) {
            // Đổ dữ liệu cũ vào form
            $('ef-name').value = exam.name || '';
            $('ef-desc').value = exam.desc || '';
            $('ef-count').value = exam.count || 10;
            $('ef-time').value = exam.timeLimit || 0;
            
            // Xử lý Category và Sub-category
            $('ef-cat').value = exam.cat || '';
            updateEFormSubcat(); // Bắt buộc gọi hàm này để load danh sách phần con
            $('ef-subcat').value = exam.subcat || '';
            
            // Đổi giao diện để giáo viên biết đang ở chế độ Sửa
            document.querySelector('#eform .sec-title').innerText = '✏️ Sửa đề thi';
            $('btn-save-exam').innerText = '✅ Cập nhật';
            
            // Gắn ID của đề thi vào nút Lưu để lát nữa hàm saveExam biết đường cập nhật
            $('btn-save-exam').dataset.editId = id; 
        }
    } else {
        // --- TRƯỜNG HỢP: TẠO MỚI ---
        $('ef-name').value = '';
        $('ef-desc').value = '';
        $('ef-count').value = 10;
        $('ef-time').value = 0;
        $('ef-cat').value = '';
        updateEFormSubcat();
        $('ef-subcat').value = '';
        
        document.querySelector('#eform .sec-title').innerText = 'Tạo đề thi mới';
        $('btn-save-exam').innerText = '✅ Tạo đề thi';
        
        // Xóa ID cũ (nếu trước đó vừa bấm sửa đề khác)
        delete $('btn-save-exam').dataset.editId; 
    }
}

export function closeEForm(){ $('eform').style.display='none'; }

export async function saveExam(){
  const name = $('ef-name').value.trim();
  if(!name){ alert('Nhập tên đề thi!'); return; }
  const count = parseInt($('ef-count').value) || 10;
  const cat = $('ef-cat').value;
  const subcat = $('ef-subcat').value;
  const desc = $('ef-desc').value.trim();
  const timeLimit = parseInt($('ef-time').value) || 0;
  const newE = {id:state.nextEId++,name,desc,count,cat,subcat,timeLimit,isHidden:false};
  state.exams.push(newE);
  await setDoc(doc(db, "exams", String(newE.id)), newE);
  closeEForm();
  renderExams();
  populateExamSelect();
}

export async function deleteExam(id){
  if(!confirm('Xóa đề thi này?')) return;
  state.exams = state.exams.filter(e => e.id !== id);
  await deleteDoc(doc(db, "exams", String(id)));
  renderExams();
  populateExamSelect();
}

export async function toggleExamVisibility(id){
  const e = state.exams.find(x => x.id === id);
  if(!e) return;
  e.isHidden = !e.isHidden;
  await setDoc(doc(db, "exams", String(id)), e);
  renderExams();
  populateExamSelect();
}

export function renderExams(){
  const list = $('e-list');
  if(!list) return;
  list.innerHTML = state.exams.map(e => {
    const pool = getPool(e).length;
    const hideClass = e.isHidden ? 'btn-warn' : 'btn-p';
    const hideText = e.isHidden ? '🙈 Đang ẩn' : '👁️ Đang hiện';
    const statusBadge = e.isHidden ? '<span class="badge-status status-hidden">Đã ẩn</span>' : '<span class="badge-status status-active">Đang mở</span>';
    return `<div class="qitem"><div class="qrow">
      <div>
        <div style="font-size:14px;font-weight:600">${esc(e.name)} ${statusBadge}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:2px">${esc(e.desc || '')}</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px">${e.count} câu • ${esc(e.subcat || e.cat || 'Tất cả chủ đề')} • Ngân hàng: ${pool} câu${e.timeLimit>0?' • ⏱ '+e.timeLimit+'p':''}</div>
      </div>
      <div style="display:flex;gap:4px;flex-direction:column;align-items:flex-end">
        <button class="btn btn-sm ${hideClass} e-action" data-action="toggle" data-id="${e.id}">${hideText}</button>
        <button class="btn btn-sm e-action" data-action="edit" data-id="${e.id}" style="color: #3b82f6; border: 1px solid #bfdbfe; background: #eff6ff; margin-right: 6px;">✏️ Sửa</button>
        <button class="btn btn-sm btn-danger e-action" data-action="delete" data-id="${e.id}">× Xóa</button>
      </div>
    </div></div>`;
  }).join('') || '<div class="empty">📭 Chưa có đề thi.</div>';
}
