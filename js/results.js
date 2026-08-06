import { db, collection, getDocs, addDoc, deleteDoc } from './firebase.js';
import { state, $, esc } from './common.js';

export async function saveResult(result){
  state.results.unshift(result);
  try{ await addDoc(collection(db, "results"), result); }catch(e){ console.error(e); }
}

export function renderResults(){
  if(!$('r-count')) return;
  const statsDiv = $('stats-summary');
  const listTbody = $('r-tbody') || $('r-list');
  
  // 1. Tải danh sách Ca thi vào ô Dropdown lọc (nếu chưa tải)
  const cohortSel = $('flt-r-cohort');
  if (cohortSel && cohortSel.getAttribute('data-loaded') !== 'true') {
      const uniqueCohorts = [...new Set(state.results.map(r => r.cohort).filter(Boolean))];
      cohortSel.innerHTML = '<option value="">(Tất cả Ca thi)</option>' + 
          uniqueCohorts.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      cohortSel.setAttribute('data-loaded', 'true');
  }

  // 2. Lấy giá trị bộ lọc
  const fCohort = $('flt-r-cohort')?.value || '';

  // 3. Tiến hành lọc mảng kết quả
  let arr = state.results;
  if (fCohort) arr = arr.filter(r => r.cohort === fCohort);

  // Cập nhật số lượng hiển thị trên tiêu đề
  $('r-count').textContent = arr.length;

  if(!arr.length){
    listTbody.innerHTML = '<tr><td colspan="9" class="empty" style="text-align:center; padding:20px; color:#64748b;">📭 Không tìm thấy kết quả nào phù hợp</td></tr>';
    statsDiv.innerHTML = '';
    return;
  }

  // 4. Cập nhật bảng thống kê (Dựa trên danh sách đã lọc)
  const avg = Math.round(arr.reduce((s,r)=>s+(r.score||0),0)/arr.length*10)/10;
  const passed = arr.filter(r => r.pct >= 50).length;
  const excellent = arr.filter(r => r.pct >= 80).length;
  statsDiv.innerHTML = `<div class="card" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
    <div class="stat"><div class="stat-n">${arr.length}</div><div class="stat-l">Lượt thi</div></div>
    <div class="stat"><div class="stat-n" style="color:#1D9E75">${avg}</div><div class="stat-l">Điểm TB</div></div>
    <div class="stat"><div class="stat-n" style="color:#f59e0b">${passed}</div><div class="stat-l">Đạt (≥50%)</div></div>
    <div class="stat"><div class="stat-n" style="color:#1D9E75">${excellent}</div><div class="stat-l">Giỏi (≥80%)</div></div>
  </div>`;

  // 5. Vẽ bảng 9 cột chuẩn khớp với file HTML
  listTbody.innerHTML = arr.map((r, i) => {
    const color = r.pct >= 80 ? '#1D9E75' : r.pct >= 60 ? '#f59e0b' : '#ef4444';
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${esc(r.sid || '')}</td>
      <td><div style="font-weight:600;color:#1e293b">${esc(r.student)}</div></td>
      <td style="color:#059669; font-weight:600;">${esc(r.cohort || 'Thi tự do')}</td>
      <td><div style="font-size:13px">${esc(r.exam)}</div></td>
      <td style="text-align:center"><div style="font-weight:700;color:${color};font-size:15px">${r.score}đ</div><div style="font-size:11px;color:#64748b">${r.pct}%</div></td>
      <td style="text-align:center"><div style="font-size:13px;color:#475569">${r.correct} / ${r.total}</div></td>
      <td style="text-align:center"><div style="font-size:12px;color:#475569">${r.time ? Math.floor(r.time / 60) + 'p ' + (r.time % 60) + 's' : ''}</div></td>
      <td><div style="font-size:12px;color:#64748b">${esc(r.at || 'N/A')}</div></td>
    </tr>`;
  }).join('');
}

export async function clearResults(){
  if(!confirm('Xóa toàn bộ kết quả? Thao tác này không thể hoàn tác!')) return;
  const snap = await getDocs(collection(db, "results"));
  for(const docSnap of snap.docs) await deleteDoc(docSnap.ref);
  state.results = [];
  renderResults();
}

export function exportCSV(){
  // Chỉ xuất ra Excel những kết quả đang được lọc
  const fCohort = $('flt-r-cohort')?.value || '';
  let arr = state.results;
  if (fCohort) arr = arr.filter(r => r.cohort === fCohort);

  if(!arr.length){ alert('Chưa có kết quả để xuất!'); return; }
  
  // Thêm các cột mới (STT, Ca thi) vào file CSV
  const csv = '\uFEFFSTT,Ca thi,Mã HV,Họ tên,Đề thi,Câu đúng,Tổng câu,Điểm,Tỷ lệ %,Thời gian(s),Thời điểm\n' +
    arr.map((r, i) => [i+1, r.cohort||'Thi tự do', r.sid||'', r.student, r.exam, r.correct, r.total, r.score, r.pct, r.time, r.at||''].map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = `ket_qua_thi_${new Date().toLocaleDateString('vi-VN').replace(/\//g,'-')}.csv`;
  a.click();
}
