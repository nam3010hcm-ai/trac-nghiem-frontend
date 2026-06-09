import { db, collection, getDocs, addDoc, deleteDoc } from './firebase.js';
import { state, $, esc } from './common.js';

export async function saveResult(result){
  state.results.unshift(result);
  try{ await addDoc(collection(db, "results"), result); }catch(e){ console.error(e); }
}

export function renderResults(){
  if(!$('r-count')) return;
  $('r-count').textContent = state.results.length;
  const statsDiv = $('stats-summary');
  const listTbody = $('r-list');
  if(!state.results.length){
    listTbody.innerHTML = '<tr><td colspan="5" class="empty">📭 Chưa có bài nộp nào</td></tr>';
    statsDiv.innerHTML = '';
    return;
  }
  const avg = Math.round(state.results.reduce((s,r)=>s+(r.score||0),0)/state.results.length*10)/10;
  const passed = state.results.filter(r => r.pct >= 50).length;
  const excellent = state.results.filter(r => r.pct >= 80).length;
  statsDiv.innerHTML = `<div class="card" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
    <div class="stat"><div class="stat-n">${state.results.length}</div><div class="stat-l">Lượt thi</div></div>
    <div class="stat"><div class="stat-n" style="color:#1D9E75">${avg}</div><div class="stat-l">Điểm TB</div></div>
    <div class="stat"><div class="stat-n" style="color:#f59e0b">${passed}</div><div class="stat-l">Đạt (≥50%)</div></div>
    <div class="stat"><div class="stat-n" style="color:#1D9E75">${excellent}</div><div class="stat-l">Giỏi (≥80%)</div></div>
  </div>`;
  listTbody.innerHTML = state.results.map(r => {
    const color = r.pct >= 80 ? '#1D9E75' : r.pct >= 60 ? '#f59e0b' : '#ef4444';
    return `<tr>
      <td><div style="font-weight:600;color:#1e293b">${esc(r.student)}</div>${r.sid ? `<div style="font-size:11px;color:#64748b">Mã: ${esc(r.sid)}</div>` : ''}</td>
      <td><div style="font-size:13px">${esc(r.exam)}</div></td>
      <td><div style="font-weight:700;color:${color};font-size:15px">${r.score}đ</div><div style="font-size:11px;color:#64748b">${r.pct}%</div></td>
      <td><div style="font-size:13px;color:#475569">${r.correct} / ${r.total}</div></td>
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
  if(!state.results.length){ alert('Chưa có kết quả!'); return; }
  const csv = '\uFEFFHọ tên,Mã HV/CS,Đề thi,Câu đúng,Tổng câu,Điểm,Tỷ lệ %,Thời gian(s),Thời điểm\n' +
    state.results.map(r => [r.student,r.sid||'',r.exam,r.correct,r.total,r.score,r.pct,r.time,r.at||''].map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = `ket_qua_thi_${new Date().toLocaleDateString('vi-VN').replace(/\//g,'-')}.csv`;
  a.click();
}
