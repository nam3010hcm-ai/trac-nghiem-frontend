import {
  auth, db,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy
} from './firebase.js';

import { initData, $ } from './common.js';
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
  // Bổ sung thêm 'cohort' vào mảng dưới đây
  ['q', 'e', 'r', 'c', 'cohort'].forEach(x => {
    $('tc-' + x).classList.toggle('active', x === t);
    
    // Đảm bảo nút tab cũng được highlight
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${x}"]`);
    if (tabBtn) {
        tabBtn.classList.toggle('active', x === t);
    }
  });

  if (t === 'r') renderResults();
  if (t === 'c') renderCatManagementList();
  if (t === 'cohort') loadCohorts(); // Tự động tải lại danh sách khi mở tab Ca thi
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

  const id = parseInt(btn.dataset.id);
  if (btn.dataset.action === 'toggle') toggleExamVisibility(id);
  if (btn.dataset.action === 'delete') deleteExam(id);
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
window.populateCohortExams = function() {
    const container = document.getElementById("t-cohort-exams");
    if (!container || !state.exams) return;
    
    if (state.exams.length === 0) {
        container.innerHTML = '<div style="color:#ef4444; font-size:13px;">Chưa có đề thi nào trong hệ thống! Hãy tạo đề thi trước.</div>';
        return;
    }

    container.innerHTML = state.exams.map(e => `
        <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:500; font-size:14px; cursor:pointer;">
            <input type="checkbox" class="cohort-exam-cb" value="${e.id}"> 
            ${e.name}
        </label>
    `).join('');
};

// 1. Hàm tải danh sách ca thi
async function loadCohorts() {
    const tbody = document.getElementById("t-cohort-list");
    if (!tbody) return;

    try {
        const q = query(collection(db, "cohorts"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        tbody.innerHTML = "";
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 15px;">Chưa có ca thi nào</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const isActive = data.status === 'active';
            
            // Format ngày tháng hiển thị
            const sTime = data.startTime ? new Date(data.startTime).toLocaleString('vi-VN') : 'Không giới hạn';
            const eTime = data.endTime ? new Date(data.endTime).toLocaleString('vi-VN') : 'Không giới hạn';
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 700; color:#1e293b;">${data.name}</div>
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

// 2. Bắt sự kiện Thêm ca thi mới
const btnAddCohort = document.getElementById("btn-add-cohort");
if (btnAddCohort) {
    btnAddCohort.addEventListener("click", async () => {
        const name = document.getElementById("t-cohort-name").value.trim();
        let code = document.getElementById("t-cohort-code").value.trim();
        const startTime = document.getElementById("t-cohort-start").value;
        const endTime = document.getElementById("t-cohort-end").value;
        
        // Lấy danh sách ID các đề thi được check
        const checkedExams = Array.from(document.querySelectorAll('.cohort-exam-cb:checked')).map(cb => parseInt(cb.value));

        if (!name) { alert("Vui lòng nhập tên ca thi!"); return; }
        if (!startTime || !endTime) { alert("Vui lòng chọn thời gian bắt đầu và kết thúc!"); return; }
        if (new Date(startTime) >= new Date(endTime)) { alert("Thời gian kết thúc phải lớn hơn thời gian bắt đầu!"); return; }
        if (checkedExams.length === 0) { alert("Vui lòng chọn ít nhất 1 đề thi cho ca này!"); return; }

        // Tự tạo mã 6 ký tự nếu giáo viên để trống
        if (!code) code = Math.random().toString(36).substring(2, 8).toUpperCase();

        btnAddCohort.disabled = true;
        btnAddCohort.textContent = "Đang tạo...";
        
        try {
            await addDoc(collection(db, "cohorts"), {
                name: name,
                code: code,
                startTime: startTime, // Lưu định dạng ISO
                endTime: endTime,
                allowedExams: checkedExams, // Mảng ID đề thi
                status: "active",
                createdAt: Date.now()
            });
            
            // Reset Form
            document.getElementById("t-cohort-name").value = "";
            document.getElementById("t-cohort-code").value = "";
            document.getElementById("t-cohort-start").value = "";
            document.getElementById("t-cohort-end").value = "";
            document.querySelectorAll('.cohort-exam-cb').forEach(cb => cb.checked = false);
            
            loadCohorts(); 
            alert(`Tạo ca thi thành công!\nMã truy cập cho học viên là: ${code}`);
        } catch (error) {
            console.error("Lỗi tạo ca thi:", error);
        } finally {
            btnAddCohort.disabled = false;
            btnAddCohort.textContent = "✅ Tạo Ca thi";
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
