import {
  auth, db,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy
} from './firebase.js';

import { initData, state, $ } from './common.js';
import { populateCategoryDropdowns, updateFltSubcat, updateQFormSubcat, updateEFormSubcat, addParentCategory, deleteParentCategory, addSubCategory, deleteSubCategory, editSubCategory, restoreDefaultCategories, renderCatManagementList } from './categories.js';
import { openQForm, closeQForm, saveQ, deleteQ, renderQuestions } from './questions.js';
import { openEForm, closeEForm, saveExam, deleteExam, toggleExamVisibility, renderExams, populateExamSelect } from './exams.js';
import { renderResults, clearResults, exportCSV } from './results.js';

async function doLogin() {
  const email = $('t-email').value.trim();
  const pass = $('t-pass').value.trim();

  if (!email || !pass) {
    $('t-err').style.display = 'block';
    $('t-err').innerText = '❌ Vui lòng nhập email và mật khẩu!';
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    $('t-err').style.display = 'none';
  } catch (error) {
    console.error(error);
    $('t-err').style.display = 'block';
    $('t-err').innerText = '❌ Email hoặc mật khẩu không đúng!';
  }
}

async function doLogout() {
  await signOut(auth);

  $('t-pass').value = '';
  $('t-err').style.display = 'none';

  if ($('current-user-email')) {
    $('current-user-email').innerText = '';
  }
}

function togglePasswordVisibility() {
  const passInput = $('t-pass');
  const btn = $('btn-toggle-pass');

  if (!passInput || !btn) return;

  if (passInput.type === 'password') {
    passInput.type = 'text';
    btn.innerText = '🙈 Ẩn';
  } else {
    passInput.type = 'password';
    btn.innerText = '👁 Hiện';
  }
}

function switchTTab(t) {
  ['q', 'e', 'r', 'c', 'cohort'].forEach(x => {
    const content = $('tc-' + x);
    if(content) content.classList.toggle('active', x === t);
    
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${x}"]`);
    if(tabBtn) tabBtn.classList.toggle('active', x === t);
  });

  if (t === 'r') renderResults();
  if (t === 'c') renderCatManagementList();
  if (t === 'cohort') {
      loadCohorts(); // Tải danh sách ca thi
      if (typeof window.populateCohortExams === 'function') {
          window.populateCohortExams(); // Tải danh sách checkbox đề thi
      }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('btn-login').addEventListener('click', doLogin);
  if ($('btn-toggle-pass')) {
  $('btn-toggle-pass').addEventListener(
    'click',
    togglePasswordVisibility
  );
}

  $('t-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  $('t-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  $('btn-logout').addEventListener('click', doLogout);

  onAuthStateChanged(auth, async user => {
  if (user) {
    $('t-login').style.display = 'none';
    $('t-panel').style.display = 'block';

    if ($('current-user-email')) {
      $('current-user-email').innerText =
        user.email || 'Không xác định';
    }

    await initData(true);

    populateCategoryDropdowns();
    updateFltSubcat();
    updateQFormSubcat();
    updateEFormSubcat();
    populateExamSelect();

    renderQuestions();
    renderExams();
    renderResults();
    renderCatManagementList();
    loadCohorts(); // THÊM DÒNG NÀY ĐỂ HIỂN THỊ CA THI KHI VỪA ĐĂNG NHẬP
    window.populateCohortExams(); // THÊM DÒNG NÀY VÀO ĐÂY LÀ XONG!

  } else {
    $('t-login').style.display = 'block';
    $('t-panel').style.display = 'none';

    if ($('current-user-email')) {
      $('current-user-email').innerText = '';
    }
  }
});

document.querySelectorAll('.tab-btn').forEach(btn =>
  btn.addEventListener('click', () => switchTTab(btn.dataset.tab))
);

$('flt-cat').addEventListener('change', () => {
  updateFltSubcat();

  const cat = $('flt-cat').value;
  $('qf-cat').value = cat;
  updateQFormSubcat();

  const subcat = $('flt-subcat').value;
  if (subcat) $('qf-subcat').value = subcat;
});

$('qf-cat').addEventListener('change', updateQFormSubcat);
$('ef-cat').addEventListener('change', updateEFormSubcat);
$('flt-r-cohort')?.addEventListener('change', renderResults);
$('btn-filter-q').addEventListener('click', () => {
  renderQuestions();

  const cat = $('flt-cat').value;
  const subcat = $('flt-subcat').value;

  if (cat) {
    $('qf-cat').value = cat;
    updateQFormSubcat();
  }

  if (subcat) {
    $('qf-subcat').value = subcat;
  }
});

$('btn-open-qform').addEventListener('click', () => {
  openQForm();

  const cat = $('flt-cat').value;
  const subcat = $('flt-subcat').value;

  if (cat) {
    $('qf-cat').value = cat;
    updateQFormSubcat();
  }

  if (subcat) {
    $('qf-subcat').value = subcat;
  }
});

$('btn-close-qform').addEventListener('click', closeQForm);
$('btn-save-q').addEventListener('click', saveQ);

$('q-list').addEventListener('click', e => {
  const btn = e.target.closest('.q-action');
  if (!btn) return;

  const id = parseInt(btn.dataset.id);
  if (btn.dataset.action === 'edit') openQForm(id);
  if (btn.dataset.action === 'delete') deleteQ(id);
});

$('btn-open-eform').addEventListener('click', openEForm);
$('btn-close-eform').addEventListener('click', closeEForm);
$('btn-save-exam').addEventListener('click', saveExam);

$('e-list').addEventListener('click', e => {
  const btn = e.target.closest('.e-action');
  if (!btn) return;

  // Lấy ID và ép kiểu an toàn (để dùng được cho cả ID dạng số lẫn chữ)
  const id = isNaN(btn.dataset.id) ? btn.dataset.id : Number(btn.dataset.id);

  if (btn.dataset.action === 'toggle') {
      toggleExamVisibility(id);
  } else if (btn.dataset.action === 'delete') {
      deleteExam(id);
  } else if (btn.dataset.action === 'edit') {
      openEForm(id); 
  } else if (btn.dataset.action === 'manage-q') {
      window.openExamQuestionManager(id);
  }
});

$('btn-add-parent').addEventListener('click', addParentCategory);
$('btn-add-sub').addEventListener('click', addSubCategory);
$('btn-restore').addEventListener('click', restoreDefaultCategories);

$('cat-management-list').addEventListener('click', e => {
  const btn = e.target.closest('.cat-action');
  if (!btn) return;

  const parent = btn.dataset.parent;
  const sub = btn.dataset.sub;

  if (btn.dataset.action === 'delete-parent') deleteParentCategory(parent);
  if (btn.dataset.action === 'edit-sub') editSubCategory(parent, sub);
  if (btn.dataset.action === 'delete-sub') deleteSubCategory(parent, sub);
});

$('btn-export').addEventListener('click', exportCSV);
$('btn-clear-results').addEventListener('click', clearResults);
});

// ==========================================
// QUẢN LÝ CA THI / LỚP HỌC (COHORTS)
// ==========================================
// Hàm hiển thị danh sách đề thi dạng Checkbox cho Form tạo Ca thi
// ==========================================
// QUẢN LÝ CA THI / LỚP HỌC (COHORTS)
// ==========================================

window.allCohortsData = {}; // Biến toàn cục lưu dữ liệu để phục vụ tính năng Sửa
let editingCohortId = null; // Lưu ID của ca thi đang được sửa

// 1. Hàm tải danh sách ca thi
async function loadCohorts() {
    const tbody = document.getElementById("t-cohort-list");
    if (!tbody) return;

    try {
        const q = query(collection(db, "cohorts"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        tbody.innerHTML = "";
        window.allCohortsData = {}; // Reset lại danh sách

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 15px;">Chưa có ca thi nào</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            window.allCohortsData[id] = data; // Lưu dữ liệu vào biến toàn cục
            const isActive = data.status === 'active';
            
            // XÁC ĐỊNH CHẾ ĐỘ THI
            const modeText = data.mode === 'exam' ? '📝 Thi thật' : '📖 Ôn luyện';
            
            // Format ngày tháng hiển thị
            const sTime = data.startTime ? new Date(data.startTime).toLocaleString('vi-VN') : 'Không giới hạn';
            const eTime = data.endTime ? new Date(data.endTime).toLocaleString('vi-VN') : 'Không giới hạn';
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 700; color:#1e293b;">${data.name}</div>
                    <div style="font-size:12px; color:#f59e0b; font-weight:600; margin-top:4px;">Chế độ: ${modeText}</div>
                    <div style="font-size:12px; color:#64748b; margin-top:4px;">Từ: ${sTime}</div>
                    <div style="font-size:12px; color:#64748b;">Đến: ${eTime}</div>
                    <div style="font-size:12px; color:#10b981; font-weight:600; margin-top:4px;">
                        Mã truy cập: <span style="background:#d1fae5; padding:2px 6px; border-radius:4px; color:#065f46;">${data.code}</span>
                        <button onclick="window.changeCohortCode('${id}', '${data.code}')" style="border:none; background:none; cursor:pointer; color:#3b82f6; text-decoration:underline;">(Đổi mã)</button>
                    </div>
                </td>
                <td>
                    <span style="color: ${isActive ? '#1D9E75' : '#ef4444'}; font-weight: 600; font-size: 13px;">
                        ${isActive ? 'Đang mở' : 'Đã đóng'}
                    </span>
                </td>
                <td style="display: flex; gap: 5px; flex-direction:column;">
                    <button class="btn" onclick="window.editCohort('${id}')" style="padding: 4px 10px; font-size: 12px; background: #e0e7ff; color: #4f46e5;">
                        ✏️ Sửa
                    </button>
                    <button class="btn" onclick="window.toggleCohort('${id}', '${data.status}')" style="padding: 4px 10px; font-size: 12px; background: #f1f5f9; color: #334155;">
                        ${isActive ? 'Khóa ca thi' : 'Mở lại'}
                    </button>
                    <button class="btn" onclick="window.deleteCohort('${id}')" style="padding: 4px 10px; font-size: 12px; background: #fee2e2; color: #ef4444;">
                        Xóa
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Lỗi tải danh sách ca thi:", error);
    }
}

// Hàm đẩy dữ liệu lên Form để Sửa
window.editCohort = (id) => {
    const data = window.allCohortsData[id];
    if (!data) return;

    editingCohortId = id;
    document.getElementById("t-cohort-name").value = data.name || '';
    document.getElementById("t-cohort-code").value = data.code || '';
    document.getElementById("t-cohort-start").value = data.startTime || '';
    document.getElementById("t-cohort-end").value = data.endTime || '';
    
    const modeSelect = document.getElementById("t-cohort-mode");
    if(modeSelect) modeSelect.value = data.mode || 'practice';

    // Đánh dấu các đề thi đã chọn
    const allowed = data.allowedExams || [];
    document.querySelectorAll('.cohort-exam-cb').forEach(cb => {
        cb.checked = allowed.includes(parseInt(cb.value));
    });

    // Đổi giao diện nút bấm
    const btn = document.getElementById("btn-add-cohort");
    btn.textContent = "💾 Cập nhật Ca thi";
    btn.style.background = "#f59e0b"; // Đổi màu vàng cam để dễ nhận diện
    
    // Nút Hủy sửa
    let cancelBtn = document.getElementById("btn-cancel-edit-cohort");
    if (!cancelBtn) {
        cancelBtn = document.createElement("button");
        cancelBtn.id = "btn-cancel-edit-cohort";
        cancelBtn.className = "btn";
        cancelBtn.style.marginTop = "10px";
        cancelBtn.style.marginLeft = "8px";
        cancelBtn.textContent = "Hủy sửa";
        cancelBtn.onclick = () => window.cancelEditCohort();
        btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
    }
    cancelBtn.style.display = "inline-block";

    // Cuộn trang lên chỗ Form
    document.getElementById("t-cohort-name").scrollIntoView({ behavior: 'smooth' });
};

// Hàm Hủy chế độ Sửa và làm sạch Form
window.cancelEditCohort = () => {
    editingCohortId = null;
    document.getElementById("t-cohort-name").value = "";
    document.getElementById("t-cohort-code").value = "";
    document.getElementById("t-cohort-start").value = "";
    document.getElementById("t-cohort-end").value = "";
    document.querySelectorAll('.cohort-exam-cb').forEach(cb => cb.checked = false);
    
    const btn = document.getElementById("btn-add-cohort");
    if(btn) {
        btn.textContent = "✅ Tạo Ca thi";
        btn.style.background = ""; // Khôi phục màu gốc
    }
    
    const cancelBtn = document.getElementById("btn-cancel-edit-cohort");
    if(cancelBtn) cancelBtn.style.display = "none";
};

// 2. Bắt sự kiện Thêm hoặc Cập nhật ca thi
const btnAddCohort = document.getElementById("btn-add-cohort");
if (btnAddCohort) {
    btnAddCohort.addEventListener("click", async () => {
        const name = document.getElementById("t-cohort-name").value.trim();
        const mode = document.getElementById("t-cohort-mode") ? document.getElementById("t-cohort-mode").value : 'practice';
        let code = document.getElementById("t-cohort-code").value.trim();
        const startTime = document.getElementById("t-cohort-start").value;
        const endTime = document.getElementById("t-cohort-end").value;
        
        const checkedExams = Array.from(document.querySelectorAll('.cohort-exam-cb:checked')).map(cb => parseInt(cb.value));

        if (!name) { alert("Vui lòng nhập tên ca thi!"); return; }
        if (!startTime || !endTime) { alert("Vui lòng chọn thời gian bắt đầu và kết thúc!"); return; }
        if (new Date(startTime) >= new Date(endTime)) { alert("Thời gian kết thúc phải lớn hơn thời gian bắt đầu!"); return; }
        if (checkedExams.length === 0) { alert("Vui lòng chọn ít nhất 1 đề thi cho ca này!"); return; }

        if (!code) code = Math.random().toString(36).substring(2, 8).toUpperCase();

        btnAddCohort.disabled = true;
        btnAddCohort.textContent = "Đang lưu...";
        
        try {
            if (editingCohortId) {
                // CẬP NHẬT CA THI ĐÃ TỒN TẠI
                await updateDoc(doc(db, "cohorts", editingCohortId), {
                    name: name,
                    code: code,
                    startTime: startTime,
                    endTime: endTime,
                    allowedExams: checkedExams,
                    mode: mode
                });
                alert("Đã cập nhật ca thi thành công!");
            } else {
                // TẠO CA THI MỚI
                await addDoc(collection(db, "cohorts"), {
                    name: name,
                    code: code,
                    startTime: startTime,
                    endTime: endTime,
                    allowedExams: checkedExams,
                    mode: mode,
                    status: "active",
                    createdAt: Date.now()
                });
                alert(`Tạo ca thi thành công!\nMã truy cập cho học viên là: ${code}`);
            }
            
            // Xóa sạch Form và tải lại bảng
            window.cancelEditCohort();
            loadCohorts(); 
        } catch (error) {
            console.error("Lỗi khi lưu ca thi:", error);
            alert("Đã có lỗi xảy ra. Vui lòng kiểm tra console.");
        } finally {
            btnAddCohort.disabled = false;
            btnAddCohort.textContent = editingCohortId ? "💾 Cập nhật Ca thi" : "✅ Tạo Ca thi";
        }
    });
}

// 3. Hàm đổi mã bảo mật
window.changeCohortCode = async (id, oldCode) => {
    const newCode = prompt(`Nhập mã truy cập mới (Mã hiện tại: ${oldCode}):`, oldCode);
    if (newCode && newCode.trim() !== oldCode) {
        try {
            await updateDoc(doc(db, "cohorts", id), { code: newCode.trim().toUpperCase() });
            loadCohorts();
            alert("Đã đổi mã bảo mật thành công!");
        } catch (error) {
            console.error(error);
            alert("Lỗi khi đổi mã!");
        }
    }
};

// 4. Bật tắt ca thi và Xóa (giữ nguyên logic cũ)
window.toggleCohort = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "closed" : "active";
    await updateDoc(doc(db, "cohorts", id), { status: newStatus });
    loadCohorts();
};

window.deleteCohort = async (id) => {
    if (confirm("Xóa ca thi này? Điểm của học viên đã thi sẽ KHÔNG bị mất.")) {
        await deleteDoc(doc(db, "cohorts", id));
        loadCohorts();
    }
};

// ==========================================
// TÍNH NĂNG CHỌN CÂU HỎI THỦ CÔNG CHO ĐỀ THI
// ==========================================
let currentEqmExamId = null;

window.openExamQuestionManager = function(examId) {
    currentEqmExamId = examId;
    const exam = state.exams.find(e => e.id === examId);
    if (!exam) return;

    // Ẩn form sửa đề (nếu đang mở), hiện form quản lý câu hỏi
    const eForm = document.getElementById('eform');
    if(eForm) eForm.style.display = 'none'; 
    document.getElementById('exam-q-manager').style.display = 'block';
    document.getElementById('eqm-name').textContent = exam.name;

    // Tạo mảng qIds nếu đề này chưa từng chọn thủ công
    if (!exam.qIds) exam.qIds = [];

    // Nạp filter danh mục
    const cats = Object.keys(state.SUBCATS).sort();
    document.getElementById('eqm-filter-cat').innerHTML = '<option value="">(Tất cả chủ đề)</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');

    renderEqmLists();
};

document.getElementById('btn-close-eqm')?.addEventListener('click', () => {
    document.getElementById('exam-q-manager').style.display = 'none';
});

document.getElementById('eqm-filter-cat')?.addEventListener('change', () => {
    renderEqmLists(); // Lọc lại cột ngân hàng khi đổi chủ đề
});

function renderEqmLists() {
    if (!currentEqmExamId) return;
    const exam = state.exams.find(e => e.id === currentEqmExamId);
    if (!exam) return;

    const filterCat = document.getElementById('eqm-filter-cat').value;
    const qIds = exam.qIds || [];

    document.getElementById('eqm-selected-count').textContent = qIds.length;

    // Lấy danh sách Đã chọn THEO ĐÚNG THỨ TỰ mà giáo viên đã xếp
    const selectedQs = qIds.map(id => state.questions.find(q => q.id === id)).filter(Boolean);
    const availableQs = state.questions.filter(q => !qIds.includes(q.id) && (filterCat === '' || q.cat === filterCat));

    // Render cột "Đã chọn" (CÓ NÚT LÊN/XUỐNG)
    const renderSelectedQItem = (q, index, total) => `
        <div style="background:#fff; border:1px solid #a7f3d0; border-radius:6px; padding:8px; display:flex; justify-content:space-between; align-items:start; gap:10px; transition: 0.2s; margin-bottom: 8px;">
            <div style="font-size:13px; color:#334155; flex:1;">
                <b style="color:#059669">[Câu ${index + 1}]</b> ${q.text.substring(0, 60)}${q.text.length > 60 ? '...' : ''}
            </div>
            <div style="display:flex; gap:4px;">
                <button class="btn btn-sm" onclick="window.moveQ(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="padding:2px 6px;">⬆️</button>
                <button class="btn btn-sm" onclick="window.moveQ(${index}, 1)" ${index === total - 1 ? 'disabled' : ''} style="padding:2px 6px;">⬇️</button>
                <button class="btn btn-sm" onclick="window.removeQFromExam(${q.id})" style="background:#fee2e2; color:#ef4444; border:none; padding:2px 6px; font-weight:bold;">✖</button>
            </div>
        </div>
    `;

    // Render cột "Ngân hàng"
    const renderAvailableQItem = (q) => `
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:8px; display:flex; justify-content:space-between; align-items:start; gap:10px; transition: 0.2s; margin-bottom: 8px;">
            <div style="font-size:13px; color:#334155; flex:1;">
                <b style="color:#64748b">[${q.subcat || q.cat || 'Chưa phân loại'}]</b> ${q.text.substring(0, 60)}${q.text.length > 60 ? '...' : ''}
            </div>
            <button class="btn btn-sm" onclick="window.addQToExam(${q.id})" style="background:#e0e7ff; color:#4f46e5; border:none; padding:4px 8px; font-weight:bold; cursor:pointer;">➕ Thêm</button>
        </div>
    `;

    document.getElementById('eqm-selected-list').innerHTML = selectedQs.length ? selectedQs.map((q, i) => renderSelectedQItem(q, i, selectedQs.length)).join('') : '<div style="font-size:13px; color:#94a3b8; text-align:center;">Đề thi chưa có câu hỏi nào</div>';
    document.getElementById('eqm-available-list').innerHTML = availableQs.length ? availableQs.map(q => renderAvailableQItem(q)).join('') : '<div style="font-size:13px; color:#94a3b8; text-align:center;">Không có câu hỏi phù hợp</div>';
}

// HÀM ĐẢM NHIỆM VIỆC ĐẢO VỊ TRÍ CÂU HỎI
window.moveQ = async (index, direction) => {
    const exam = state.exams.find(e => e.id === currentEqmExamId);
    if(!exam || !exam.qIds) return;
    
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= exam.qIds.length) return;
    
    // Hoán đổi vị trí trong mảng
    const temp = exam.qIds[index];
    exam.qIds[index] = exam.qIds[newIndex];
    exam.qIds[newIndex] = temp;
    
    // Lưu thứ tự mới lên Firebase
    await updateDoc(doc(db, "exams", String(exam.id)), { qIds: exam.qIds });
    renderEqmLists();
};

// Bấm thêm câu hỏi
window.addQToExam = async (qId) => {
    const exam = state.exams.find(e => e.id === currentEqmExamId);
    if(!exam) return;
    if(!exam.qIds) exam.qIds = [];
    
    if(!exam.qIds.includes(qId)) {
        exam.qIds.push(qId);
        exam.count = exam.qIds.length; // Tự động cập nhật số lượng câu của đề thi
        await updateDoc(doc(db, "exams", String(exam.id)), { qIds: exam.qIds, count: exam.count });
        renderEqmLists();
        renderExams(); // Cập nhật lại số lượng hiển thị trên danh sách ngoài
    }
};

// Bấm xóa câu hỏi
window.removeQFromExam = async (qId) => {
    const exam = state.exams.find(e => e.id === currentEqmExamId);
    if(!exam) return;
    if(!exam.qIds) exam.qIds = [];
    
    exam.qIds = exam.qIds.filter(id => id !== qId);
    exam.count = exam.qIds.length; // Tự động cập nhật số lượng
    await updateDoc(doc(db, "exams", String(exam.id)), { qIds: exam.qIds, count: exam.count });
    renderEqmLists();
    renderExams();
};
