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

// 1. Hàm tải danh sách ca thi
async function loadCohorts() {
    const tbody = document.getElementById("t-cohort-list");
    if (!tbody) return; // Tránh lỗi nếu chưa load giao diện

    try {
        // Lấy danh sách, sắp xếp theo thời gian tạo mới nhất lên đầu
        const q = query(collection(db, "cohorts"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        tbody.innerHTML = ""; // Xóa thông báo "Đang tải..."

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 15px; color: #64748b;">Chưa có ca thi nào được tạo</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const isActive = data.status === 'active';
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: 500;">${data.name}</td>
                <td>
                    <span style="color: ${isActive ? '#1D9E75' : '#ef4444'}; font-weight: 600; font-size: 13px;">
                        ${isActive ? 'Đang mở' : 'Đã đóng'}
                    </span>
                </td>
                <td style="display: flex; gap: 5px;">
                    <button class="btn" onclick="window.toggleCohort('${id}', '${data.status}')" style="padding: 4px 10px; font-size: 12px; background: #f1f5f9; color: #334155;">
                        ${isActive ? 'Đóng ca thi' : 'Mở lại'}
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
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: #ef4444; padding: 15px;">Lỗi tải dữ liệu! Vui lòng F5 lại trang.</td></tr>';
    }
}

// 2. Bắt sự kiện Thêm ca thi mới
const btnAddCohort = document.getElementById("btn-add-cohort");
if (btnAddCohort) {
    btnAddCohort.addEventListener("click", async () => {
        const input = document.getElementById("t-cohort-name");
        const name = input.value.trim();
        
        if (!name) {
            alert("Vui lòng nhập tên ca thi (VD: Lớp TH 1 - Sáng Thứ 3)!");
            input.focus();
            return;
        }
        
        // Hiệu ứng loading nút bấm
        btnAddCohort.disabled = true;
        btnAddCohort.textContent = "Đang thêm...";
        
        try {
            await addDoc(collection(db, "cohorts"), {
                name: name,
                status: "active", // Mặc định mở
                createdAt: Date.now()
            });
            input.value = ""; // Xóa trắng ô nhập
            loadCohorts();    // Cập nhật lại bảng ngay lập tức
        } catch (error) {
            console.error("Lỗi khi thêm ca thi:", error);
            alert("Lỗi khi thêm ca thi! Xem console để biết chi tiết.");
        } finally {
            // Trả lại trạng thái nút bấm
            btnAddCohort.disabled = false;
            btnAddCohort.textContent = "Thêm Ca thi";
        }
    });
}

// 3. Hàm bật/tắt (Đóng/Mở) ca thi
window.toggleCohort = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "closed" : "active";
    try {
        await updateDoc(doc(db, "cohorts", id), { status: newStatus });
        loadCohorts();
    } catch (error) {
        console.error("Lỗi khi cập nhật trạng thái:", error);
        alert("Không thể đổi trạng thái. Vui lòng thử lại!");
    }
};

// 4. Hàm xóa ca thi
window.deleteCohort = async (id) => {
    if (confirm("Xóa ca thi này?\nLưu ý: Điểm của những sinh viên đã thi trong ca này vẫn được giữ nguyên an toàn trong bảng kết quả.")) {
        try {
            await deleteDoc(doc(db, "cohorts", id));
            loadCohorts();
        } catch (error) {
            console.error("Lỗi khi xóa ca thi:", error);
            alert("Không thể xóa ca thi. Vui lòng thử lại!");
        }
    }
};
