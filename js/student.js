import { db, collection, getDocs } from './firebase.js';
import { initData, state, $, KEYS, shuffle, getPool, esc, mediaHTML, audioHTML, renderRich, typesetMath, isCorrect, formatAnswer, splitBlanks } from './common.js';
import { populateExamSelect, updateExamDesc } from './exams.js';
import { saveResult } from './results.js';

let qState = {};
const STORE_KEY = 'quiz_current_attempt_v2';
let activeCohortsData = {}; 
let uiState = { multiSelected: {} }; 

function showScreen(id){ document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); $(id).classList.add('active'); }
function persist(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify({...qState, timer:null})); }catch{} }
function clearPersist(){ localStorage.removeItem(STORE_KEY); }

function showStudentBadge(){
  const s = qState.student;
  $('q-student').textContent = `${s.id || ''} - ${s.name || ''} - ${s.cohort || ''} - ${qState.exam?.name || ''}`;
}

async function loadActiveCohorts() {
  const selectEl = $('s-cohort');
  if (!selectEl) return;
  try {
      const snapshot = await getDocs(collection(db, "cohorts"));
      selectEl.innerHTML = '<option value="" disabled selected>-- Vui lòng chọn ca thi --</option>';
      let hasActiveCohort = false;
      snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === 'active') {
              hasActiveCohort = true;
              activeCohortsData[data.name] = data; 
              selectEl.insertAdjacentHTML('beforeend', `<option value="${data.name}">${data.name}</option>`);
          }
      });
      if (!hasActiveCohort) selectEl.innerHTML = '<option value="" disabled selected>Hiện không có ca thi đang mở</option>';
  } catch (e) { selectEl.innerHTML = '<option value="" disabled selected>Lỗi tải dữ liệu!</option>'; }
}

async function startExam(){
  const name = $('s-name').value.trim();
  const studentId = $('s-id').value.trim();
  const cohortName = $('s-cohort')?.value;
  if(!name || !studentId || !cohortName){ alert('Vui lòng điền đủ Họ tên, Mã HV và chọn Ca thi!'); return; }

  const cohort = activeCohortsData[cohortName];
  if (cohort) {
      const codeInput = $('s-cohort-code')?.value.trim().toUpperCase() || '';
      if (codeInput !== cohort.code) { alert('❌ Mã truy cập ca thi không chính xác!'); return; }

      const now = new Date();
      if (cohort.startTime && new Date(cohort.startTime) > now) { alert('⏳ Ca thi chưa mở!'); return; }
      if (cohort.endTime && new Date(cohort.endTime) < now) { alert('⌛ Ca thi đã kết thúc!'); return; }

      const eid = parseInt($('s-exam').value);
      if (cohort.allowedExams && cohort.allowedExams.length > 0 && !cohort.allowedExams.includes(eid)) {
          alert('❌ Đề thi này không được phép làm trong Ca thi này!'); return;
      }
      
      if (cohort.mode === 'exam') {
          $('btn-start').disabled = true; $('btn-start').textContent = 'Đang kiểm tra lịch sử...';
          try {
              const snapshot = await getDocs(collection(db, "results"));
              const hasTaken = snapshot.docs.some(d => d.data().cohort === cohortName && d.data().sid === studentId);
              if (hasTaken) {
                  alert('❌ Bạn đã thi Ca này rồi. Thi Thật chỉ cho phép 1 lần duy nhất!');
                  $('btn-start').disabled = false; $('btn-start').textContent = 'Bắt đầu làm bài →';
                  return;
              }
          } catch (error) {
              alert('⚠️ Lỗi máy chủ!'); $('btn-start').disabled = false; $('btn-start').textContent = 'Bắt đầu làm bài →';
              return;
          }
          $('btn-start').disabled = false; $('btn-start').textContent = 'Bắt đầu làm bài →';
      }
  }

  const eid = parseInt($('s-exam').value);
  const exam = state.exams.find(e => e.id === eid);
  if(!exam) return;
  
  const pool = getPool(exam);
  let qs = (exam.qIds && exam.qIds.length > 0) ? pool : shuffle(pool).sort((a, b) => (a.subcat || '').localeCompare(b.subcat || ''));
  qs = qs.slice(0, Math.min(exam.count, pool.length));
  if(!qs.length){ alert('Đề thi trống!'); return; }

  // THUẬT TOÁN GOM NHÓM (GROUP BY PART)
  let parts = [];
  let currentPart = null;
  qs.forEach((q, i) => {
      q.globalIdx = i; // Gắn ID toàn cục cho câu hỏi
      const pName = q.subcat || 'General Part';
      if (!currentPart || currentPart.name !== pName) {
          currentPart = { name: pName, questions: [] };
          parts.push(currentPart);
      }
      currentPart.questions.push(q);
  });

  qState = { 
      exam, student: { name, id: studentId, cohort: cohortName }, 
      qs, parts, partIdx: 0, answers: [], startTime: Date.now(), timer: null,
      mode: cohort?.mode === 'exam' ? 'exam' : 'practice'
  };
  
  persist(); startTimer(); showStudentBadge(); showScreen('sc-quiz'); renderPart();
}

function startTimer(){
  clearInterval(qState.timer);
  const tl = (qState.exam.timeLimit || 0) * 60;
  qState.timer = setInterval(() => {
    const el = Math.floor((Date.now() - qState.startTime) / 1000);
    const t = $('q-timer');
    if(tl > 0){
      const rem = tl - el;
      if(rem <= 0){ finishExam(); return; }
      const m = Math.floor(rem/60), s = rem % 60;
      t.textContent = `⏱ ${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }else{
      const m = Math.floor(el/60), s = el % 60;
      t.textContent = `⏱ ${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
  }, 1000);
}

// ==== HỆ THỐNG RENDER CÂU HỎI ĐỘNG (DẠNG CHUỖI HTML) ====
function getMCQSingleHTML(q){
    const savedAns = qState.answers[q.globalIdx];
    return (q.opts || []).map((o,i)=>{
        const isSel = qState.mode === 'exam' && savedAns === i;
        const style = isSel ? 'border:2px solid #3b82f6; background:#eff6ff' : '';
        return `<button class="opt answer-btn" data-qidx="${q.globalIdx}" data-idx="${i}" style="${style}">
            <span class="okey">${KEYS[i]}</span><span>${renderRich(o)}</span>
        </button>`;
    }).join('');
}

function getMCQMultiHTML(q){
    const savedAns = qState.answers[q.globalIdx] || [];
    uiState.multiSelected[q.globalIdx] = new Set(savedAns); // Phục hồi state đa lựa chọn
    return (q.opts || []).map((o,i)=>{
        const isSel = savedAns.includes(i);
        const style = isSel ? 'border:2px solid #3b82f6; background:#eff6ff' : '';
        return `<button class="opt answer-btn multi ${isSel ? 'selected' : ''}" data-qidx="${q.globalIdx}" data-idx="${i}" style="${style}">
            <span class="okey">${KEYS[i]}</span><span>${renderRich(o)}</span>
        </button>`;
    }).join('') + (qState.mode !== 'exam' ? `<button class="btn btn-p btn-full btn-confirm-multi" data-qidx="${q.globalIdx}" style="margin-top:10px;">Xác nhận đáp án</button>` : '');
}

function getFillBlankHTML(q){
    const parts = splitBlanks(q.text);
    const savedAns = qState.answers[q.globalIdx] || [];
    let html = '<div class="fillblank-sentence" style="line-height:2;">';
    parts.forEach((seg,i) => {
        html += renderRich(seg);
        if(i < parts.length - 1){
            const val = savedAns[i] !== undefined ? esc(savedAns[i]) : '';
            html += `<input class="blank-input" data-qidx="${q.globalIdx}" data-idx="${i}" type="text" autocomplete="off" placeholder="..." value="${val}" style="margin:0 5px; padding:4px 8px; border:1px solid #94a3b8; border-radius:4px;">`;
        }
    });
    html += '</div>';
    if(qState.mode !== 'exam') html += `<button class="btn btn-p btn-full btn-confirm-fill" data-qidx="${q.globalIdx}" style="margin-top:16px">Xác nhận đáp án</button>`;
    return html;
}

function getEssayHTML(q){
    const savedAns = qState.answers[q.globalIdx] || '';
    return `<textarea class="essay-input" data-qidx="${q.globalIdx}" style="width:100%; height:150px; padding:15px; border:2px solid #cbd5e1; border-radius:8px; font-size:15px; resize:vertical;" placeholder="Nhập bài viết của bạn tại đây...">${esc(savedAns)}</textarea>
            <div style="font-size:12px; color:#64748b; margin-top:8px;">Số từ: <b class="word-count" data-qidx="${q.globalIdx}" style="color:#3b82f6;">${savedAns ? savedAns.trim().split(/\s+/).length : 0}</b></div>
            ${qState.mode !== 'exam' ? `<button class="btn btn-p btn-full btn-confirm-essay" data-qidx="${q.globalIdx}" style="margin-top:16px">Lưu tự luận</button>` : ''}`;
}
// =======================================================

function renderPart(){
  const part = qState.parts[qState.partIdx];
  $('q-progress').textContent = `${part.name}`;
  $('q-pbar').style.width = `${(qState.partIdx+1)/qState.parts.length*100}%`;
  
  let html = `<div style="font-size:18px; font-weight:800; color:#1e293b; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">${part.name}</div>`;
  
  part.questions.forEach((q) => {
      const type = q.type || 'mcq_single';
      html += `<div class="card" style="margin-bottom: 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 20px;">`;
      html += `<div style="font-weight:700; margin-bottom:12px; color:#3b82f6;">Câu ${q.globalIdx + 1}:</div>`;
      if(type !== 'fill_blank' && type !== 'essay') html += `<div style="font-size:15px; margin-bottom:15px;">${renderRich(q.text)}</div>`;
      html += mediaHTML(q.image) + audioHTML(q.audio);
      
      html += `<div class="q-opts" id="q-opts-${q.globalIdx}">`;
      if (type === 'fill_blank') html += getFillBlankHTML(q);
      else if (type === 'essay') html += getEssayHTML(q);
      else if (type === 'mcq_multi') html += getMCQMultiHTML(q);
      else html += getMCQSingleHTML(q);
      html += `</div>`;
      html += `<div id="q-fb-${q.globalIdx}" class="fb" style="display:none; margin-top:10px;"></div>`;
      html += `</div>`;
  });
  
  $('part-container').innerHTML = html;
  $('btn-prev').style.display = qState.partIdx > 0 ? 'inline-block' : 'none';
  $('btn-next').style.display = qState.partIdx < qState.parts.length - 1 ? 'inline-block' : 'none';
  $('btn-finish').style.display = qState.partIdx === qState.parts.length - 1 ? 'inline-block' : 'none';
  typesetMath($('part-container'));

  // Lắng nghe gõ phím cho Điền từ & Tự luận
  document.querySelectorAll('.blank-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
          if (qState.mode === 'exam') {
              const qIdx = parseInt(e.target.dataset.qidx);
              const inputs = Array.from(document.querySelectorAll(`.blank-input[data-qidx="${qIdx}"]`));
              qState.answers[qIdx] = inputs.map(i => i.value.trim());
              persist();
          }
      });
  });
  document.querySelectorAll('.essay-input').forEach(ta => {
      ta.addEventListener('input', (e) => {
          const qIdx = parseInt(e.target.dataset.qidx);
          const text = e.target.value;
          document.querySelector(`.word-count[data-qidx="${qIdx}"]`).textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
          if (qState.mode === 'exam') { qState.answers[qIdx] = text; persist(); }
      });
  });
}

function lockAndShowFeedback(qIdx, userAns){
  const q = qState.qs[qIdx];
  qState.answers[qIdx] = userAns;
  persist();
  if (qState.mode === 'exam') return; // Không khóa, không show đáp án khi thi thật
  
  const ok = isCorrect(q, userAns);
  const fb = document.getElementById(`q-fb-${qIdx}`);
  if(fb) {
      fb.style.display = 'block'; fb.className = 'fb ' + (ok ? 'fb-ok' : 'fb-bad');
      let html = ok ? '✅ Chính xác!' : `❌ Chưa đúng! Đáp án: ${formatAnswer(q, null, true)}`;

      // THÊM: Hiện giải thích nếu có
      if (q.explain) {
          html += `<div style="margin-top: 10px; font-size: 13px; color: #334155; padding-top: 10px; border-top: 1px dashed ${ok ? '#86efac' : '#fca5a5'}; line-height: 1.5;">💡 <b>Giải thích:</b> ${renderRich(q.explain)}</div>`;
      }

      fb.innerHTML = html;
      typesetMath(fb);
  }
}

// BẮT SỰ KIỆN TOÀN CỤC TRONG KHUNG PART
$('part-container').addEventListener('click', e => {
  const ansBtn = e.target.closest('.answer-btn');
  if (ansBtn && !ansBtn.disabled) {
      const qIdx = parseInt(ansBtn.dataset.qidx);
      const idx = parseInt(ansBtn.dataset.idx);
      const q = qState.qs[qIdx];
      
      if (q.type === 'mcq_multi') {
          ansBtn.classList.toggle('selected');
          if (!uiState.multiSelected[qIdx]) uiState.multiSelected[qIdx] = new Set();
          if (uiState.multiSelected[qIdx].has(idx)) uiState.multiSelected[qIdx].delete(idx);
          else uiState.multiSelected[qIdx].add(idx);
          if (qState.mode === 'exam') { qState.answers[qIdx] = Array.from(uiState.multiSelected[qIdx]); persist(); }
      } else {
          if (qState.mode !== 'exam') {
              const container = document.getElementById(`q-opts-${qIdx}`);
              container.querySelectorAll('.answer-btn').forEach(b => b.disabled = true);
              ansBtn.classList.add(idx === q.ans ? 'correct' : 'wrong');
              if (idx !== q.ans) container.querySelector(`.answer-btn[data-idx="${q.ans}"]`)?.classList.add('correct');
          } else {
              const container = document.getElementById(`q-opts-${qIdx}`);
              container.querySelectorAll('.answer-btn').forEach(b => { b.style.border = ''; b.style.background = ''; });
              ansBtn.style.border = '2px solid #3b82f6'; ansBtn.style.background = '#eff6ff';
          }
          lockAndShowFeedback(qIdx, idx);
      }
      return;
  }
  
  // Xác nhận bài tập cho ÔN LUYỆN
  const btnM = e.target.closest('.btn-confirm-multi');
  if(btnM) { const qIdx = parseInt(btnM.dataset.qidx); lockAndShowFeedback(qIdx, Array.from(uiState.multiSelected[qIdx] || [])); btnM.remove(); }
  
  const btnF = e.target.closest('.btn-confirm-fill');
  if(btnF) { 
      const qIdx = parseInt(btnF.dataset.qidx);
      const inputs = Array.from(document.querySelectorAll(`.blank-input[data-qidx="${qIdx}"]`));
      inputs.forEach(i => i.disabled = true);
      lockAndShowFeedback(qIdx, inputs.map(i => i.value.trim())); btnF.remove(); 
  }

  const btnE = e.target.closest('.btn-confirm-essay');
  if(btnE) {
      const qIdx = parseInt(btnE.dataset.qidx);
      const val = document.querySelector(`.essay-input[data-qidx="${qIdx}"]`).value;
      qState.answers[qIdx] = val; persist();
      const fb = document.getElementById(`q-fb-${qIdx}`);
      fb.style.display = 'block'; fb.className = 'fb fb-ok'; fb.innerHTML = '💾 Đã lưu bài Tự Luận thành công.';
      btnE.remove();
  }
});

async function finishExam(){
  if(!qState.qs) return;
  clearInterval(qState.timer);
  const {qs, answers, student, exam, parts} = qState;
  
  let autoScore = 0; // Điểm trắc nghiệm tự động chấm
  let totalMaxScore = 0; // Tổng điểm tối đa của đề (Bao gồm cả Tự luận)
  let cor = 0; // Tổng số câu trắc nghiệm đúng

  // THUẬT TOÁN TÍNH ĐIỂM THEO TỪNG PART
  parts.forEach(part => {
      // 1. Quét tìm [số điểm] ở cuối tên Part (Ví dụ: "PART I: LISTENING [2.5]" -> lấy số 2.5)
      const match = part.name.match(/\[(\d+(?:\.\d+)?)\]/);
      const partPoints = match ? parseFloat(match[1]) : 0;
      totalMaxScore += partPoints;

      // 2. Lọc các câu KHÔNG phải tự luận trong Part này để chấm tự động
      const objectiveQs = part.questions.filter(q => q.type !== 'essay');
      const totalObjInPart = objectiveQs.length;

      if (totalObjInPart > 0 && partPoints > 0) {
          let correctInPart = 0;
          objectiveQs.forEach(q => {
              const ua = answers[q.globalIdx];
              if (isCorrect(q, ua)) {
                  correctInPart++;
                  cor++; // Cộng dồn vào tổng câu đúng toàn bài
              }
          });
          
          // 3. Tính điểm đạt được cho Part này = (Số câu đúng / Tổng câu của Part) * Điểm quy định
          const earnedInPart = (correctInPart / totalObjInPart) * partPoints;
          autoScore += earnedInPart;
      }
  });

  const totalObjQs = qs.filter(q => q.type !== 'essay').length || 1; // Tổng số câu trắc nghiệm toàn bài
  
  // NẾU GIÁO VIÊN QUÊN GHI [ĐIỂM]: Hệ thống tự động quay về thang điểm 10 mặc định chia đều
  if (totalMaxScore === 0) {
      autoScore = (cor / totalObjQs) * 10;
      totalMaxScore = 10;
  }

  // Làm tròn điểm số đến 2 chữ số thập phân
  const score = Math.round(autoScore * 100) / 100;
  const pct = Math.round((cor / totalObjQs) * 100);
  const elapsed = Math.round((Date.now() - qState.startTime) / 1000);
  
  const result = {
    student: student.name, sid: student.id, cohort: student.cohort, exam: exam.name, 
    correct: cor, total: totalObjQs, score, manualScore: 0, pct, time: elapsed, 
    at: new Date().toLocaleString('vi-VN'), timestamp: Date.now(),
    answers: answers // LƯU TOÀN BỘ ĐÁP ÁN (Bao gồm bài Writing) LÊN SERVER
  };
  await saveResult(result); 
  clearPersist();

  // ----- HIỂN THỊ KẾT QUẢ -----
  $('r-name').innerHTML = `
    <div style="font-size: 15px; font-weight: 500; line-height: 1.6; color: #334155; margin-top: 8px;">
        Mã HV: <b style="color: #0f172a;">${student.id}</b><br>
        Tên: <b style="color: #0f172a;">${student.name}</b><br>
        Ca thi: <b style="color: #0f172a;">${student.cohort}</b>
    </div>`;
  $('r-score').textContent = score; 
  
  // Đổi chữ "điểm/10" thành tổng điểm cấu trúc của đề thi
  const lbl = document.querySelector('.score-lbl');
  if(lbl) lbl.textContent = `điểm / ${totalMaxScore}`;

  $('r-cor').textContent = cor; $('r-wrg').textContent = totalObjQs - cor;
  $('r-time').textContent = (elapsed>=60 ? Math.floor(elapsed/60)+'p ' : '') + (elapsed%60) + 's';
  $('r-pct').textContent = pct + '%';
  $('r-msg').textContent = "Bài làm đã được nộp! (Chờ GV chấm điểm phần Tự Luận nếu có).";
  
  $('btn-retake').style.display = (qState.mode === 'exam') ? 'none' : 'block';
  $('r-review').innerHTML = qs.map((q,i)=>{
    const ua = answers[i], ok = isCorrect(q, ua);
    
    // THÊM: Gắn thêm phần giải thích khi xem lại bài
    let expHtml = q.explain ? `<div style="margin-top:6px; font-size:13px; color:#475569; background:#f8fafc; padding:8px; border-radius:6px; border-left:3px solid #3b82f6;">💡 <b>Giải thích:</b> ${renderRich(q.explain)}</div>` : '';

    return `<div class="ri"><b>Câu ${i+1}: ${renderRich(q.text)}</b>
      <div>Bạn chọn/Viết: ${q.type==='essay' ? `<pre style="white-space:pre-wrap; background:#f1f5f9; padding:10px;">${esc(ua)}</pre>` : formatAnswer(q, ua, false)}</div>
      ${expHtml}
    </div>`;
  }).join('');
  showScreen('sc-result'); typesetMath($('sc-result'));
}

document.addEventListener('DOMContentLoaded', async () => {
  await initData(false);
  loadActiveCohorts(); 
  const raw = localStorage.getItem(STORE_KEY);
  if(raw) {
    try{
      const saved = JSON.parse(raw);
      if(saved?.qs?.length && confirm('Phát hiện bài làm chưa hoàn thành. Đồng chí có muốn tiếp tục không?')){
        qState = saved; startTimer(); showStudentBadge(); showScreen('sc-quiz'); renderPart();
      }
    }catch{ clearPersist(); }
  }

  $('s-cohort').addEventListener('change', () => {
      const cohortName = $('s-cohort').value;
      const codeInput = $('s-cohort-code').value.trim().toUpperCase();
      const examSelect = $('s-exam');
      examSelect.innerHTML = '<option value="" disabled selected>-- Nhập đúng mã ca thi để tải đề --</option>';
      if ($('s-exam-desc')) $('s-exam-desc').textContent = '';
      if (!cohortName) return;
      const cohort = activeCohortsData[cohortName];
      if (cohort && codeInput === cohort.code) {
          const allowed = cohort.allowedExams || [];
          const availableExams = state.exams.filter(e => allowed.includes(e.id) && !e.isHidden);
          examSelect.innerHTML = availableExams.length === 0 ? '<option value="" disabled selected>-- Chưa có đề thi --</option>' : '<option value="" disabled selected>-- Chọn đề thi --</option>' + availableExams.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
      }
  });
  
  $('s-cohort-code').addEventListener('input', () => $('s-cohort').dispatchEvent(new Event('change')));
  $('s-exam').addEventListener('change', updateExamDesc);
  $('btn-start').addEventListener('click', startExam);
  $('btn-next').addEventListener('click', () => { qState.partIdx++; persist(); renderPart(); window.scrollTo(0,0); });
  $('btn-prev').addEventListener('click', () => { qState.partIdx--; persist(); renderPart(); window.scrollTo(0,0); });
  $('btn-finish').addEventListener('click', finishExam);
  $('btn-home').addEventListener('click', () => { clearInterval(qState.timer); clearPersist(); showScreen('sc-home'); });
  $('btn-retake').addEventListener('click', () => {
      qState.partIdx = 0; qState.answers = []; qState.startTime = Date.now();
      persist(); startTimer(); showScreen('sc-quiz'); renderPart();
  });
});
