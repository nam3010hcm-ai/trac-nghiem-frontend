// Thêm import các hàm Firebase để lấy danh sách Ca thi
import { db, collection, getDocs } from './firebase.js';

import { initData, state, $, KEYS, shuffle, getPool, esc, mediaHTML, audioHTML, renderRich, typesetMath, isCorrect, formatAnswer, splitBlanks } from './common.js';
import { populateExamSelect, updateExamDesc } from './exams.js';
import { saveResult } from './results.js';

let qState = {};
const STORE_KEY = 'quiz_current_attempt_v2';
let multiSelected = new Set();   // lựa chọn tạm thời của câu mcq_multi, trước khi bấm "Xác nhận"
let dragSelectedBankIdx = null;  // chip đang được chọn trong ngân hàng từ (kéo-thả)
let matchSelectedLeft = null;    // mục cột trái đang được chọn (ghép cặp)
let matchPairs = {};             // leftIdx -> rightOrigIdx (ghép cặp)
let activeCohortsData = {}; // Lưu trữ dữ liệu ca thi để đối chiếu mã bảo mật và thời gian

function showScreen(id){ document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); $(id).classList.add('active'); }
function persist(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify({...qState, timer:null})); }catch{} }
function clearPersist(){ localStorage.removeItem(STORE_KEY); }

function showStudentBadge(){
  const s = qState.student;
  const exam = qState.exam;
  if(!s) return;
  
  // Định dạng hiển thị: Mã học viên - Tên học viên - Ca thi - Đề thi
  const maHV = s.id ? s.id : '';
  const tenHV = s.name ? s.name : '';
  const caThi = s.cohort ? s.cohort : '';
  const deThi = exam ? exam.name : '';

  $('q-student').textContent = `${maHV} - ${tenHV} - ${caThi} - ${deThi}`;
}

// ==========================================
// HÀM TẢI DANH SÁCH CA THI ĐANG MỞ
// ==========================================
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
              
              // LƯU TOÀN BỘ DATA CỦA CA THI NÀY VÀO BỘ NHỚ
              activeCohortsData[data.name] = data; 
              
              const option = document.createElement("option");
              option.value = data.name;
              option.textContent = data.name;
              selectEl.appendChild(option);
          }
      });

      if (!hasActiveCohort) {
          selectEl.innerHTML = '<option value="" disabled selected>Hiện không có ca thi nào đang mở</option>';
      }
  } catch (error) {
      console.error("Lỗi tải danh sách ca thi:", error);
      selectEl.innerHTML = '<option value="" disabled selected>Lỗi tải dữ liệu. Vui lòng F5 lại trang!</option>';
  }
}
// ==========================================
// HÀM KIỂM TRA MÃ CA THI VÀ LOAD ĐỀ THI TƯƠNG ỨNG
// ==========================================
function verifyAndLoadExams() {
    const cohortName = $('s-cohort').value;
    const codeInput = $('s-cohort-code').value.trim().toUpperCase();
    const examSelect = $('s-exam');
    
    // Mặc định khóa và làm trống danh sách đề thi
    examSelect.innerHTML = '<option value="" disabled selected>-- Nhập đúng mã ca thi để tải đề --</option>';
    if ($('s-exam-desc')) $('s-exam-desc').textContent = '';

    if (!cohortName) return;
    const cohort = activeCohortsData[cohortName];
    if (!cohort) return;

    // KHI MÃ NHẬP VÀO KHỚP CHÍNH XÁC VỚI MÃ CA THI
    if (codeInput === cohort.code) {
        const allowed = cohort.allowedExams || [];
        // Lọc ra các đề thi thuộc ca thi này và không bị ẩn
        const availableExams = state.exams.filter(e => allowed.includes(e.id) && !e.isHidden);
        
        if (availableExams.length === 0) {
            examSelect.innerHTML = '<option value="" disabled selected>-- Ca thi này chưa có đề thi --</option>';
        } else {
            examSelect.innerHTML = '<option value="" disabled selected>-- Chọn đề thi --</option>' + 
                availableExams.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        }
    }
}
//Kết thúc hàm kiểm tra
function startExam(){
  const name = $('s-name').value.trim();
  if(!name){ alert('Vui lòng nhập họ tên!'); return; }
  
  const cohortName = $('s-cohort') ? $('s-cohort').value : '';
  if(!cohortName){ alert('Vui lòng chọn ca thi / lớp học!'); return; }

  // ====================================================
  // KIỂM TRA BẢO MẬT 3 LỚP CỦA CA THI
  // ====================================================
  const cohort = activeCohortsData[cohortName];
  if (cohort) {
      // LỚP 1: KIỂM TRA MÃ TRUY CẬP
      const codeInput = $('s-cohort-code') ? $('s-cohort-code').value.trim().toUpperCase() : '';
      if (codeInput !== cohort.code) {
          alert('❌ Mã truy cập ca thi không chính xác!');
          return; // Dừng lại ngay lập tức
      }

      // LỚP 2: KIỂM TRA THỜI GIAN
      const now = new Date();
      if (cohort.startTime && new Date(cohort.startTime) > now) {
          alert('⏳ Ca thi chưa mở!\nVui lòng quay lại lúc: ' + new Date(cohort.startTime).toLocaleString('vi-VN'));
          return;
      }
      if (cohort.endTime && new Date(cohort.endTime) < now) {
          alert('⌛ Ca thi đã kết thúc vào lúc: ' + new Date(cohort.endTime).toLocaleString('vi-VN'));
          return;
      }

      // LỚP 3: KIỂM TRA ĐỀ THI ĐƯỢC PHÉP CHỌN
      const eid = parseInt($('s-exam').value);
      // Nếu giáo viên có quy định danh sách đề thi (allowedExams)
      if (cohort.allowedExams && cohort.allowedExams.length > 0) {
          if (!cohort.allowedExams.includes(eid)) {
              alert('❌ Đề thi bạn chọn KHÔNG được phép làm trong Ca thi này!\nVui lòng chọn đúng đề thi được giáo viên chỉ định.');
              return;
          }
      }
  }
  // ====================================================

  const eid = parseInt($('s-exam').value); // Lấy lại eid cho code bên dưới nếu cần
  const exam = state.exams.find(e => e.id === eid);
  //
  if(!exam){ alert('Không tìm thấy đề thi hoặc chưa chọn đề!'); return; }
  
  const pool = getPool(exam);
  let qs;
  
  // KIỂM TRA: Nếu đề thi có danh sách câu hỏi thủ công từ giáo viên (qIds) thì GIỮ NGUYÊN THỨ TỰ.
  // Ngược lại nếu là đề bốc tự động thì lấy ngẫu nhiên rồi SẮP XẾP LẠI THEO PART (dựa vào subcat).
  if (exam.qIds && exam.qIds.length > 0) {
      qs = pool;
  } else {
      qs = shuffle(pool).sort((a, b) => (a.subcat || '').localeCompare(b.subcat || ''));
  }
  
  qs = qs.slice(0, Math.min(exam.count, pool.length));
  //
  if(!qs.length){ alert('Đề thi chưa có câu hỏi phù hợp!'); return; }
  
  // LƯU THÊM COHORT VÀO qState
  // LƯU THÊM COHORT VÀO qState BẰNG BIẾN CHỮ cohortName
  const examMode = cohort && cohort.mode === 'exam' ? 'exam' : 'practice';

  qState = { 
      exam, 
      student: {
          name: name, 
          id: $('s-id').value.trim(), 
          cohort: cohortName // <-- Điểm cốt lõi sửa lỗi [object Object]
      }, 
      qs, 
      idx: 0, 
      answers: [], 
      startTime: Date.now(), 
      timer: null,
      mode: examMode // <-- LƯU CHẾ ĐỘ THI
  };
  
  persist(); startTimer(); showStudentBadge(); showScreen('sc-quiz'); renderQ();
}
  //
  

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

function renderMCQSingle(q){
  const savedAns = qState.answers[qState.idx];
  $('q-opts').innerHTML = (q.opts || []).map((o,i)=>{
    const isSel = qState.mode === 'exam' && savedAns === i;
    const style = isSel ? 'border:2px solid #3b82f6; background:#eff6ff' : '';
    return `<button class="opt answer-btn" data-idx="${i}" style="${style}">
      <span class="okey">${KEYS[i]}</span>
      <span>${renderRich(o)}</span>
    </button>`;
  }).join('');
}

function renderMCQMulti(q){
  const savedAns = qState.answers[qState.idx] || [];
  if(qState.mode === 'exam' && savedAns.length) savedAns.forEach(v => multiSelected.add(v));
  
  $('q-opts').innerHTML = (q.opts || []).map((o,i)=>{
    const isSel = multiSelected.has(i);
    const style = isSel ? 'border:2px solid #3b82f6; background:#eff6ff' : '';
    return `<button class="opt answer-btn multi ${isSel ? 'selected' : ''}" data-idx="${i}" style="${style}">
      <span class="okey">${KEYS[i]}</span>
      <span>${renderRich(o)}</span>
    </button>`;
  }).join('') +
  `<div style="font-size:12px;color:#6b7280;margin:4px 0 10px">Có thể chọn nhiều đáp án đúng.</div>
  <button class="btn btn-p btn-full" id="btn-confirm-multi">Xác nhận đáp án</button>`;
}

function renderFillBlank(q){
  const parts = splitBlanks(q.text);
  const savedAns = qState.answers[qState.idx] || [];
  let html = '<div class="fillblank-sentence">';
  parts.forEach((seg,i) => {
    html += renderRich(seg);
    if(i < parts.length - 1){
      const val = savedAns[i] !== undefined ? esc(savedAns[i]) : '';
      html += `<input class="blank-input" data-idx="${i}" type="text" autocomplete="off" placeholder="..." value="${val}">`;
    }
  });
  html += '</div><button class="btn btn-p btn-full" id="btn-confirm-fill" style="margin-top:16px">Xác nhận đáp án</button>';
  $('q-opts').innerHTML = html;
}

function renderDragDrop(q){
  const parts = splitBlanks(q.text);
  let sentence = '<div class="fillblank-sentence">';
  parts.forEach((seg,i) => {
    sentence += renderRich(seg);
    if(i < parts.length - 1){
      sentence += `<button type="button" class="drop-slot" data-idx="${i}" data-filled=""></button>`;
    }
  });
  sentence += '</div>';
  const bankHTML = '<div class="word-bank">' + (q.bank || []).map((w,i) =>
    `<button type="button" class="bank-chip" data-bank-idx="${i}">${renderRich(w)}</button>`).join('') + '</div>';
  $('q-opts').innerHTML = sentence + bankHTML +
    '<button class="btn btn-p btn-full" id="btn-confirm-drag" style="margin-top:16px">Xác nhận đáp án</button>';
}

function renderMatching(q){
  const pairs = q.pairs || [];
  const rightShuffled = shuffle(pairs.map((p,i) => ({text:p.right, orig:i})));
  const leftHTML = pairs.map((p,i) =>
    `<button type="button" class="match-item match-left" data-idx="${i}">${renderRich(p.left)}</button>`).join('');
  const rightHTML = rightShuffled.map(r =>
    `<button type="button" class="match-item match-right" data-orig="${r.orig}">${renderRich(r.text)}</button>`).join('');
  $('q-opts').innerHTML = `
    <div style="font-size:12px;color:#6b7280;margin-bottom:10px">Chạm 1 mục bên trái rồi chạm mục tương ứng bên phải để ghép. Chạm lại để hủy ghép.</div>
    <div class="match-cols">
      <div class="match-col">${leftHTML}</div>
      <div class="match-col">${rightHTML}</div>
    </div>
    <button class="btn btn-p btn-full" id="btn-confirm-match" style="margin-top:16px">Xác nhận đáp án</button>`;
}

function renderQ(){
  const {qs, idx} = qState;
  const q = qs[idx];
  const type = q.type || 'mcq_single';
  multiSelected = new Set();
  dragSelectedBankIdx = null;
  matchSelectedLeft = null;
  matchPairs = {};

  const isExam = qState.mode === 'exam';
  
  if (isExam) {
      $('exam-nav-palette').style.display = 'block';
      $('q-live').style.display = 'none'; // Ẩn "Đúng/Sai" khi thi
      
      $('q-nav-grid').innerHTML = qs.map((_, i) => {
          let isAns = false;
          const a = qState.answers[i];
          if(a !== undefined && a !== null) {
              if(Array.isArray(a)) isAns = a.length > 0 && a.some(x => x !== '');
              else isAns = String(a).trim() !== '';
          }
          
          const bg = i === idx ? '#3b82f6' : (isAns ? '#10b981' : '#e2e8f0');
          const col = i === idx || isAns ? '#fff' : '#334155';
          return `<button class="btn-qnav" data-idx="${i}" style="width:36px; height:36px; border-radius:6px; border:none; cursor:pointer; font-weight:bold; background:${bg}; color:${col}">${i+1}</button>`;
      }).join('');

      $('btn-prev').style.display = idx > 0 ? 'inline-block' : 'none';
      $('btn-next').style.display = idx < qs.length - 1 ? 'inline-block' : 'none';
      $('btn-finish').style.display = 'inline-block';
  } else {
      $('exam-nav-palette').style.display = 'none';
      $('btn-prev').style.display = 'none';
  }

  $('q-progress').textContent = `Câu ${idx+1}/${qs.length}`;
  $('q-pbar').style.width = `${(idx+1)/qs.length*100}%`;
  $('q-cat').textContent = q.subcat || q.cat || '';
  const cor = qState.answers.filter((a,i)=>isCorrect(qs[i], a)).length;
  $('q-live').textContent = `Đúng: ${cor}/${idx}`;
  $('q-fb').style.display = 'none';
  if (!isExam) {
    $('btn-next').style.display = 'none';
    $('btn-finish').style.display = 'none';
  }

  if(type === 'fill_blank'){
    $('q-text').innerHTML = `<div style="font-weight:600;margin-bottom:4px">✏️ Điền vào chỗ trống:</div>${mediaHTML(q.image)}${audioHTML(q.audio)}`;
    renderFillBlank(q);
  }else if(type === 'drag_drop'){
    $('q-text').innerHTML = `<div style="font-weight:600;margin-bottom:4px">🧩 Kéo-thả từ đúng vào chỗ trống:</div>${mediaHTML(q.image)}${audioHTML(q.audio)}`;
    renderDragDrop(q);
  }else if(type === 'matching'){
    $('q-text').innerHTML = `<div style="font-weight:600;margin-bottom:4px">🔗 Ghép các cặp tương ứng:</div>${mediaHTML(q.image)}${audioHTML(q.audio)}`;
    renderMatching(q);
  }else{
    $('q-text').innerHTML = `<div>${renderRich(q.text)}</div>${mediaHTML(q.image)}${audioHTML(q.audio)}`;
    if(type === 'mcq_multi') renderMCQMulti(q);
    else renderMCQSingle(q);
  }
  typesetMath($('sc-quiz'));
}

function lockAndShowFeedback(q, userAns){
  qState.answers[qState.idx] = userAns;
  persist();
  
  // NẾU LÀ THI THẬT -> Lưu đáp án, cập nhật UI và KHÔNG KHÓA, KHÔNG HIỆN ĐÁP ÁN ĐÚNG/SAI
  if (qState.mode === 'exam') {
      renderQ(); 
      return; 
  }
  
  // NẾU LÀ ÔN LUYỆN -> Giữ nguyên logic cũ
  const ok = isCorrect(q, userAns);
  const fb = $('q-fb');
  fb.style.display = 'block';
  fb.className = 'fb ' + (ok ? 'fb-ok' : 'fb-bad');
  fb.innerHTML = ok ? '✅ Chính xác!' : `❌ Chưa đúng! Đáp án đúng: ${formatAnswer(q, null, true)}`;
  const cor = qState.answers.filter((a,i)=>isCorrect(qState.qs[i], a)).length;
  $('q-live').textContent = `Đúng: ${cor}/${qState.idx+1}`;
  if(qState.idx + 1 < qState.qs.length) $('btn-next').style.display = 'inline-block';
  else $('btn-finish').style.display = 'inline-block';
  typesetMath(fb);
}

function selectAnsSingle(idx){
  const q = qState.qs[qState.idx];
  const btns = document.querySelectorAll('.opt');
  if (qState.mode !== 'exam') {
    btns.forEach(b => b.disabled = true);
    btns[idx].classList.add(idx === q.ans ? 'correct' : 'wrong');
    if(idx !== q.ans) btns[q.ans].classList.add('correct');
  }
  lockAndShowFeedback(q, idx);
}

function toggleMulti(btn, idx){
  btn.classList.toggle('selected');
  if(multiSelected.has(idx)) multiSelected.delete(idx); else multiSelected.add(idx);
}

function confirmMulti(){
  const q = qState.qs[qState.idx];
  const chosen = Array.from(multiSelected).sort((a,b)=>a-b);
  const btns = document.querySelectorAll('.opt.multi');
  if (qState.mode !== 'exam') {
    btns.forEach((b,i) => {
      b.disabled = true;
      const isRight = (q.ans || []).includes(i);
      const isChosen = chosen.includes(i);
      if(isRight) b.classList.add('correct');
      else if(isChosen) b.classList.add('wrong');
    });
    $('btn-confirm-multi')?.remove();
  }
  lockAndShowFeedback(q, chosen);
}

function confirmFillBlank(){
  const q = qState.qs[qState.idx];
  const inputs = Array.from(document.querySelectorAll('.blank-input'));
  const vals = inputs.map(i => i.value.trim());
  if (qState.mode !== 'exam') {
    inputs.forEach((inp,i) => {
      inp.disabled = true;
      const accepted = String(q.blanks?.[i] || '').split('|').map(s => s.trim().toLowerCase());
      inp.classList.add(accepted.includes(inp.value.trim().toLowerCase()) ? 'correct' : 'wrong');
    });
    $('btn-confirm-fill')?.remove();
  }
  lockAndShowFeedback(q, vals);
}

// --- Kéo-thả (tap-to-place) ---
function selectBankChip(chip, idx){
  document.querySelectorAll('.bank-chip.selected').forEach(c => c.classList.remove('selected'));
  if(dragSelectedBankIdx === idx){ dragSelectedBankIdx = null; return; } // bấm lại để bỏ chọn
  chip.classList.add('selected');
  dragSelectedBankIdx = idx;
}

function placeInSlot(slot){
  const q = qState.qs[qState.idx];
  const idx = parseInt(slot.dataset.idx);
  if(slot.dataset.filled !== ''){
    // ô đã có từ -> chạm lại để trả từ về ngân hàng
    const bankIdx = slot.dataset.filled;
    const chip = document.querySelector(`.bank-chip[data-bank-idx="${bankIdx}"]`);
    if(chip){ chip.disabled = false; chip.classList.remove('used'); }
    slot.textContent = '';
    slot.dataset.filled = '';
    return;
  }
  if(dragSelectedBankIdx === null) return;
  const chip = document.querySelector(`.bank-chip[data-bank-idx="${dragSelectedBankIdx}"]`);
  if(!chip || chip.disabled) return;
  slot.textContent = q.bank[dragSelectedBankIdx];
  slot.dataset.filled = String(dragSelectedBankIdx);
  chip.disabled = true;
  chip.classList.add('used');
  chip.classList.remove('selected');
  dragSelectedBankIdx = null;
}

function confirmDragDrop(){
  const q = qState.qs[qState.idx];
  const slots = Array.from(document.querySelectorAll('.drop-slot'));
  const vals = slots.map(s => s.dataset.filled !== '' ? q.bank[parseInt(s.dataset.filled)] : '');
  if (qState.mode !== 'exam') {
    slots.forEach((s,i) => {
      s.disabled = true;
      const accepted = String(q.blanks?.[i] || '').split('|').map(v => v.trim().toLowerCase());
      s.classList.add(accepted.includes((vals[i] || '').trim().toLowerCase()) ? 'correct' : 'wrong');
    });
    document.querySelectorAll('.bank-chip').forEach(c => c.disabled = true);
    $('btn-confirm-drag')?.remove();
  }
  lockAndShowFeedback(q, vals);
}

// --- Ghép cặp ---
function clearMatchSelection(){
  document.querySelectorAll('.match-left.selected').forEach(b => b.classList.remove('selected'));
  matchSelectedLeft = null;
}
function unpairByLeft(leftIdx){
  const rightOrig = matchPairs[leftIdx];
  delete matchPairs[leftIdx];
  const leftBtn = document.querySelector(`.match-left[data-idx="${leftIdx}"]`);
  const rightBtn = document.querySelector(`.match-right[data-orig="${rightOrig}"]`);
  [leftBtn, rightBtn].forEach(b => { if(b){ b.classList.remove('paired'); b.querySelector('.match-badge')?.remove(); } });
}
function pairSelection(leftIdx, rightOrig){
  matchPairs[leftIdx] = rightOrig;
  const leftBtn = document.querySelector(`.match-left[data-idx="${leftIdx}"]`);
  const rightBtn = document.querySelector(`.match-right[data-orig="${rightOrig}"]`);
  [leftBtn, rightBtn].forEach(b => { if(b) b.classList.add('paired'); });
  const badge = `<span class="match-badge">${leftIdx+1}</span>`;
  if(leftBtn) leftBtn.insertAdjacentHTML('afterbegin', badge);
  if(rightBtn) rightBtn.insertAdjacentHTML('afterbegin', badge);
}
function confirmMatching(){
  const q = qState.qs[qState.idx];
  const n = (q.pairs || []).length;
  const answer = Array.from({length:n}).map((_,i) => matchPairs[i] !== undefined ? matchPairs[i] : -1);
  if (qState.mode !== 'exam') {
    document.querySelectorAll('.match-left').forEach((b,i) => {
      b.disabled = true;
      b.classList.add(matchPairs[i] === i ? 'correct' : 'wrong');
    });
    document.querySelectorAll('.match-right').forEach(b => {
      b.disabled = true;
      const orig = parseInt(b.dataset.orig);
      const leftIdx = Object.keys(matchPairs).find(k => matchPairs[k] === orig);
      if(leftIdx !== undefined) b.classList.add(parseInt(leftIdx) === orig ? 'correct' : 'wrong');
    });
    $('btn-confirm-match')?.remove();
  }
  lockAndShowFeedback(q, answer);
}

function nextQ(){ qState.idx++; persist(); renderQ(); }

async function finishExam(){
  if(!qState.qs) return;
  clearInterval(qState.timer);
  const {qs, answers, student, exam} = qState;
  const cor = answers.filter((a,i)=>isCorrect(qs[i], a)).length;
  const total = qs.length;
  const pct = Math.round(cor / total * 100);
  const score = Math.round(cor / total * 100) / 10;
  const elapsed = Math.round((Date.now() - qState.startTime) / 1000);
  
  // LƯU KÈM TRƯỜNG COHORT VÀO KẾT QUẢ ĐẨY LÊN FIREBASE
  const result = {
    student: student.name, 
    sid: student.id, 
    cohort: student.cohort, // Đã có mặt!
    exam: exam.name, 
    correct: cor, 
    total, 
    score, 
    pct, 
    time: elapsed, 
    at: new Date().toLocaleString('vi-VN'), 
    timestamp: Date.now()
  };
  
  await saveResult(result); // Đẩy lên Firebase thông qua file results.js
  
  clearPersist();
  // Hiển thị thông tin sau khi thi xong ca thi
  $('r-name').innerHTML = `
    <div style="font-size: 15px; font-weight: 500; line-height: 1.6; color: #334155; margin-top: 8px;">
        Mã học viên: <b style="color: #0f172a;">${student.id || 'N/A'}</b><br>
        Tên học viên: <b style="color: #0f172a;">${student.name || 'N/A'}</b><br>
        Ca thi: <b style="color: #0f172a;">${student.cohort || 'N/A'}</b><br>
        Đề thi: <b style="color: #0f172a;">${exam.name || 'N/A'}</b>
    </div>
`;
  //
  $('r-score').textContent = score;
  $('r-cor').textContent = cor;
  $('r-wrg').textContent = total - cor;
  $('r-time').textContent = (elapsed>=60 ? Math.floor(elapsed/60)+'p ' : '') + (elapsed%60) + 's';
  $('r-pct').textContent = pct + '%';
  const c = $('r-circle'), sn = $('r-score');
  if(pct>=80){ c.style.borderColor='#1D9E75'; c.style.background='#f0fdf8'; sn.style.color='#0F6E56'; }
  else if(pct>=60){ c.style.borderColor='#f59e0b'; c.style.background='#fffbeb'; sn.style.color='#b45309'; }
  else{ c.style.borderColor='#ef4444'; c.style.background='#fef2f2'; sn.style.color='#b91c1c'; }
  $('r-msg').textContent = pct>=80 ? 'Xuất sắc! Tiếp tục phát huy!' : pct>=60 ? 'Khá tốt! Cần ôn tập thêm.' : 'Cần cố gắng hơn nhé!';
  $('r-review').innerHTML = qs.map((q,i)=>{
    const ua = answers[i], ok = isCorrect(q, ua);
    return `<div class="ri">
      <b>${i+1}. ${renderRich(q.text)}</b>${mediaHTML(q.image)}${audioHTML(q.audio)}
      <div>Bạn chọn: ${formatAnswer(q, ua, false)}</div>
      ${ok ? '<div style="color:#15803d">✓ Đúng</div>' : `<div style="color:#15803d">✓ Đúng: ${formatAnswer(q, ua, true)}</div>`}
    </div>`;
  }).join('');
  showScreen('sc-result');
  typesetMath($('sc-result'));
}

function goHome(){ clearInterval(qState.timer); clearPersist(); showScreen('sc-home'); }
function retake(){
  qState.idx = 0; qState.answers = [];
  const pool = getPool(qState.exam);
  
  // Áp dụng chung logic giữ nguyên thứ tự Part như lúc mới bắt đầu thi
  if (qState.exam.qIds && qState.exam.qIds.length > 0) {
      qState.qs = pool;
  } else {
      qState.qs = shuffle(pool).sort((a, b) => (a.subcat || '').localeCompare(b.subcat || ''));
  }
  
  qState.qs = qState.qs.slice(0, Math.min(qState.exam.count, pool.length));
  
  qState.startTime = Date.now(); persist(); startTimer(); showStudentBadge(); showScreen('sc-quiz'); renderQ();
}

function maybeResume(){
  const raw = localStorage.getItem(STORE_KEY);
  if(!raw) return;
  try{
    const saved = JSON.parse(raw);
    if(saved?.qs?.length && confirm('Phát hiện bài làm chưa hoàn thành. Đồng chí có muốn tiếp tục không?')){
      qState = saved; startTimer(); showStudentBadge(); showScreen('sc-quiz'); renderQ();
    }
  }catch{ clearPersist(); }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initData(false);
  
  // TẢI DANH SÁCH CA THI NGAY KHI VÀO TRANG
  loadActiveCohorts(); 
  maybeResume();
  // THÊM 2 DÒNG NÀY: Lắng nghe sự kiện gõ mã bảo mật hoặc đổi ca thi
  $('s-cohort').addEventListener('change', verifyAndLoadExams);
  $('s-cohort-code').addEventListener('input', verifyAndLoadExams);
  
  $('s-exam').addEventListener('change', updateExamDesc);
  $('btn-start').addEventListener('click', startExam);
  $('btn-next').addEventListener('click', nextQ);
  $('btn-finish').addEventListener('click', finishExam);
  $('btn-home').addEventListener('click', goHome);
  $('btn-retake').addEventListener('click', retake);
  $('btn-prev')?.addEventListener('click', () => { qState.idx--; persist(); renderQ(); });
  
  // Lắng nghe click vào bảng số
  $('exam-nav-palette')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-qnav');
      if(btn) {
          qState.idx = parseInt(btn.dataset.idx);
          persist(); renderQ();
      }
  });

  $('q-opts').addEventListener('click', e => {
    const btn = e.target.closest('.answer-btn');
    if(btn){
      if(btn.disabled) return;
      const idx = parseInt(btn.dataset.idx);
      if(btn.classList.contains('multi')) toggleMulti(btn, idx);
      else selectAnsSingle(idx);
      return;
    }
    if(e.target.id === 'btn-confirm-multi') confirmMulti();
    if(e.target.id === 'btn-confirm-fill') confirmFillBlank();
    if(e.target.id === 'btn-confirm-drag') confirmDragDrop();
    if(e.target.id === 'btn-confirm-match') confirmMatching();

    const chip = e.target.closest('.bank-chip');
    if(chip){
      if(chip.disabled) return;
      selectBankChip(chip, parseInt(chip.dataset.bankIdx));
      return;
    }
    const slot = e.target.closest('.drop-slot');
    if(slot){
      if(slot.disabled) return;
      placeInSlot(slot);
      return;
    }
    const mLeft = e.target.closest('.match-left');
    if(mLeft){
      if(mLeft.disabled) return;
      const idx = parseInt(mLeft.dataset.idx);
      if(mLeft.classList.contains('paired')){ unpairByLeft(idx); return; }
      clearMatchSelection();
      mLeft.classList.add('selected');
      matchSelectedLeft = idx;
      return;
    }
    const mRight = e.target.closest('.match-right');
    if(mRight){
      if(mRight.disabled) return;
      const orig = parseInt(mRight.dataset.orig);
      if(mRight.classList.contains('paired')){
        const leftIdx = Object.keys(matchPairs).find(k => matchPairs[k] === orig);
        if(leftIdx !== undefined) unpairByLeft(parseInt(leftIdx));
        return;
      }
      if(matchSelectedLeft !== null){
        pairSelection(matchSelectedLeft, orig);
        clearMatchSelection();
      }
      return;
    }
  });
});
