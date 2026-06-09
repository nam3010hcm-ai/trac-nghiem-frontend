import { initData, state, $, KEYS, shuffle, getPool, esc } from './common.js';
import { populateExamSelect, updateExamDesc } from './exams.js';
import { saveResult } from './results.js';

let qState = {};

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function startExam(){
  const name = $('s-name').value.trim();
  if(!name){ alert('Vui lòng nhập họ tên!'); return; }
  const eid = parseInt($('s-exam').value);
  const exam = state.exams.find(e => e.id === eid);
  if(!exam){ alert('Không tìm thấy đề thi hoặc chưa chọn đề!'); return; }
  const pool = getPool(exam);
  const qs = shuffle(pool).slice(0, Math.min(exam.count, pool.length));
  if(!qs.length){ alert('Đề thi chưa có câu hỏi phù hợp!'); return; }
  qState = { exam, student:{name, id:$('s-id').value.trim()}, qs, idx:0, answers:[], startTime:Date.now(), timer:null };
  startTimer();
  showScreen('sc-quiz');
  renderQ();
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

function renderQ(){
  const {qs, idx} = qState;
  const q = qs[idx];
  $('q-progress').textContent = `Câu ${idx+1}/${qs.length}`;
  $('q-pbar').style.width = `${(idx+1)/qs.length*100}%`;
  $('q-cat').textContent = q.subcat || q.cat || '';
  $('q-text').textContent = q.text;
  const cor = qState.answers.filter((a,i)=>a===qs[i].ans).length;
  $('q-live').textContent = `Đúng: ${cor}/${idx}`;
  $('q-opts').innerHTML = q.opts.map((o,i)=>`<button class="opt answer-btn" data-idx="${i}"><span class="okey">${KEYS[i]}</span>${esc(o)}</button>`).join('');
  $('q-fb').style.display = 'none';
  $('btn-next').style.display = 'none';
  $('btn-finish').style.display = 'none';
}

function selectAns(idx){
  const q = qState.qs[qState.idx];
  qState.answers[qState.idx] = idx;
  document.querySelectorAll('.opt').forEach(b => b.disabled = true);
  const btns = document.querySelectorAll('.opt');
  btns[idx].classList.add(idx === q.ans ? 'correct' : 'wrong');
  if(idx !== q.ans) btns[q.ans].classList.add('correct');
  const fb = $('q-fb');
  fb.style.display = 'block';
  fb.className = 'fb ' + (idx === q.ans ? 'fb-ok' : 'fb-bad');
  fb.innerHTML = idx === q.ans ? '✅ Chính xác!' : `❌ Sai rồi! Đáp án đúng: <strong>${KEYS[q.ans]}. ${esc(q.opts[q.ans])}</strong>`;
  const cor = qState.answers.filter((a,i)=>a===qState.qs[i].ans).length;
  $('q-live').textContent = `Đúng: ${cor}/${qState.idx+1}`;
  if(qState.idx + 1 < qState.qs.length) $('btn-next').style.display = 'inline-block';
  else $('btn-finish').style.display = 'inline-block';
}

function nextQ(){ qState.idx++; renderQ(); }

async function finishExam(){
  if(!qState.qs) return;
  clearInterval(qState.timer);
  const {qs, answers, student, exam} = qState;
  const cor = answers.filter((a,i)=>a===qs[i].ans).length;
  const total = qs.length;
  const pct = Math.round(cor / total * 100);
  const score = Math.round(cor / total * 100) / 10;
  const elapsed = Math.round((Date.now() - qState.startTime) / 1000);
  const result = {student:student.name, sid:student.id, exam:exam.name, correct:cor, total, score, pct, time:elapsed, at:new Date().toLocaleString('vi-VN'), timestamp:Date.now()};
  await saveResult(result);

  $('r-name').textContent = student.name;
  $('r-score').textContent = score;
  $('r-cor').textContent = cor;
  $('r-wrg').textContent = total - cor;
  $('r-time').textContent = (elapsed>=60 ? Math.floor(elapsed/60)+'p ' : '') + (elapsed%60) + 's';
  $('r-pct').textContent = pct + '%';
  const c = $('r-circle'), sn = $('r-score');
  if(pct>=80){ c.style.borderColor='#1D9E75'; c.style.background='#f0fdf8'; sn.style.color='#0F6E56'; }
  else if(pct>=60){ c.style.borderColor='#f59e0b'; c.style.background='#fffbeb'; sn.style.color='#b45309'; }
  else{ c.style.borderColor='#ef4444'; c.style.background='#fef2f2'; sn.style.color='#b91c1c'; }
  $('r-msg').textContent = pct>=80 ? '🎉 Xuất sắc! Tiếp tục phát huy!' : pct>=60 ? '👍 Khá tốt! Cần ôn tập thêm.' : '💪 Cần cố gắng hơn nhé!';
  $('r-review').innerHTML = qs.map((q,i)=>{
    const ua = answers[i], ok = ua === q.ans;
    const userAnswer = ua === undefined ? 'Chưa chọn' : `${KEYS[ua]}. ${esc(q.opts[ua])}`;
    return `<div class="ri"><div style="display:flex;gap:8px;align-items:flex-start">
      <div class="dot" style="background:${ok?'#1D9E75':'#ef4444'}"></div>
      <div><div style="font-size:13px;font-weight:600;margin-bottom:3px">${esc(q.text)}</div>
      <div style="font-size:12px;color:${ok?'#1D9E75':'#ef4444'}">Bạn chọn: ${userAnswer}</div>
      ${ok ? '' : `<div style="font-size:12px;color:#1D9E75">✓ Đúng: ${KEYS[q.ans]}. ${esc(q.opts[q.ans])}</div>`}
      </div></div></div>`;
  }).join('');
  showScreen('sc-result');
}

function goHome(){ clearInterval(qState.timer); showScreen('sc-home'); }
function retake(){
  qState.idx = 0; qState.answers = [];
  qState.qs = shuffle(getPool(qState.exam)).slice(0, Math.min(qState.exam.count, getPool(qState.exam).length));
  qState.startTime = Date.now();
  startTimer();
  showScreen('sc-quiz');
  renderQ();
}

document.addEventListener('DOMContentLoaded', async () => {
  await initData();
  populateExamSelect();
  $('s-exam').addEventListener('change', updateExamDesc);
  $('btn-start').addEventListener('click', startExam);
  $('btn-next').addEventListener('click', nextQ);
  $('btn-finish').addEventListener('click', finishExam);
  $('btn-home').addEventListener('click', goHome);
  $('btn-retake').addEventListener('click', retake);
  $('q-opts').addEventListener('click', e => {
    const btn = e.target.closest('.answer-btn');
    if(btn) selectAns(parseInt(btn.dataset.idx));
  });
});
