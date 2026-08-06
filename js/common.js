import { db, collection, getDocs, getDoc, setDoc, doc } from './firebase.js';

export const TEACHER_PASS = "gv2024";
export const KEYS = ['A','B','C','D'];

export const DEFAULT_SUBCATS = {
  "Word":["Word/Phần 1 - Định dạng ký tự","Word/Phần 2 - Định dạng đoạn văn","Word/Phần 3 - Định dạng trang & lề","Word/Phần 4 - Bảng biểu","Word/Phần 5 - Hình ảnh & đối tượng","Word/Phần 6 - Header, Footer & số trang","Word/Phần 7 - Styles & Heading","Word/Phần 8 - Tiện ích & phím tắt"],
  "Excel":["Excel/Phần 1 - Nhập liệu & định dạng ô","Excel/Phần 2 - Hàm tính toán cơ bản","Excel/Phần 3 - Hàm điều kiện & logic","Excel/Phần 4 - Hàm tra cứu (VLOOKUP, HLOOKUP)","Excel/Phần 5 - Hàm văn bản & ngày tháng","Excel/Phần 6 - Biểu đồ","Excel/Phần 7 - Lọc, sắp xếp & PivotTable","Excel/Phần 8 - Tiện ích & phím tắt"],
  "PowerPoint":["PowerPoint/Phần 1 - Tạo & quản lý slide","PowerPoint/Phần 2 - Định dạng văn bản & hình ảnh","PowerPoint/Phần 3 - Hiệu ứng chuyển slide","PowerPoint/Phần 4 - Hiệu ứng đối tượng (Animation)","PowerPoint/Phần 5 - Trình chiếu & xuất file"],
  "Internet & Email":["Internet & Email/Phần 1 - Trình duyệt & tìm kiếm","Internet & Email/Phần 2 - Email cơ bản","Internet & Email/Phần 3 - Bảo mật & an toàn mạng"],
  "Kiến thức chung":["Kiến thức chung/Phần 1 - Phím tắt Windows","Kiến thức chung/Phần 2 - Quản lý file & thư mục","Kiến thức chung/Phần 3 - Khái niệm tin học cơ bản"],
  "Toán":["Toán/Phần 1 - Số học","Toán/Phần 2 - Đại số","Toán/Phần 3 - Hình học","Toán/Phần 4 - Hàm số","Toán/Phần 5 - Phương trình","Toán/Phần 6 - Bất phương trình","Toán/Phần 7 - Xác suất - Thống kê"]
};

export const DEFAULT_QUESTIONS = [
  {id:1,cat:"Word",subcat:"Word/Phần 1 - Định dạng ký tự",text:"Phím tắt nào dùng để in đậm văn bản trong Word?",opts:["Ctrl+I","Ctrl+B","Ctrl+U","Ctrl+D"],ans:1},
  {id:2,cat:"Excel",subcat:"Excel/Phần 2 - Hàm tính toán cơ bản",text:"Hàm nào dùng để tính tổng trong Excel?",opts:["=COUNT()","=AVERAGE()","=SUM()","=MAX()"],ans:2},
  {id:3,cat:"Toán",subcat:"Toán/Phần 1 - Số học",text:"Tính giá trị của biểu thức $2^5 + 3^2$",opts:["$32$","$41$","$25$","$64$"],ans:1}
];

export const DEFAULT_EXAMS = [
  {id:1,name:"Đề tổng hợp cơ bản",desc:"Kiểm tra kiến thức Word, Excel, PowerPoint",count:10,cat:"",subcat:"",timeLimit:0,isHidden:false},
  {id:2,name:"Chuyên đề Word",desc:"Kiểm tra chuyên sâu Microsoft Word",count:8,cat:"Word",subcat:"",timeLimit:0,isHidden:false},
  {id:3,name:"Chuyên đề Excel",desc:"Kiểm tra chuyên sâu Microsoft Excel",count:6,cat:"Excel",subcat:"",timeLimit:0,isHidden:false},
  {id:4,name:"Chuyên đề Toán",desc:"Kiểm tra câu hỏi Toán có LaTeX",count:10,cat:"Toán",subcat:"",timeLimit:0,isHidden:false}
];

export const state = { SUBCATS:{}, questions:[], exams:[], results:[], nextQId:100, nextEId:10 };
export const $ = id => document.getElementById(id);
export const clone = obj => JSON.parse(JSON.stringify(obj));
export const shuffle = a => a.slice().sort(() => Math.random() - .5);

export const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[m]));

export function mediaHTML(url, cls='q-img'){
  const u = String(url || '').trim();
  if(!u) return '';
  if(!/^https?:\/\//i.test(u) && !/^data:image\//i.test(u)) return '';
  return `<img class="${cls}" src="${esc(u)}" alt="Hình minh họa" loading="lazy">`;
}

export function audioHTML(url){
  const u = String(url || '').trim();
  if(!u) return '';
  if(!/^https?:\/\//i.test(u) && !/^data:audio\//i.test(u)) return '';
  return `<audio class="q-audio" controls preload="none" src="${esc(u)}">Trình duyệt không hỗ trợ phát audio.</audio>`;
}

export const TYPE_LABELS = {
  mcq_single: 'Trắc nghiệm - 1 đáp án',
  mcq_multi: 'Trắc nghiệm - nhiều đáp án',
  fill_blank: 'Điền từ vào chỗ trống',
  drag_drop: 'Kéo-thả vào chỗ trống',
  matching: 'Ghép cặp'
};

// Tách nội dung câu hỏi điền-từ theo dấu ___ thành các đoạn text xen kẽ chỗ trống
export function splitBlanks(text){
  return String(text || '').split(/_{3,}/);
}
export function countBlanks(text){
  return Math.max(0, splitBlanks(text).length - 1);
}
function normAns(s){ return String(s ?? '').trim().toLowerCase(); }

// So khớp 1 câu trả lời của học viên với đáp án đúng của câu hỏi q, theo từng loại (type)
export function isCorrect(q, userAns){
  const type = q.type || 'mcq_single';
  if(type === 'mcq_single'){
    return userAns === q.ans;
  }
  if(type === 'mcq_multi'){
    const ua = Array.isArray(userAns) ? userAns.slice().sort() : [];
    const ca = (q.ans || []).slice().sort();
    return ua.length === ca.length && ua.every((v,i) => v === ca[i]);
  }
  if(type === 'fill_blank' || type === 'drag_drop'){
    const ua = Array.isArray(userAns) ? userAns : [];
    return (q.blanks || []).every((accepted, i) => {
      const opts = String(accepted || '').split('|').map(normAns).filter(Boolean);
      return opts.includes(normAns(ua[i]));
    });
  }
  if(type === 'matching'){
    const ua = Array.isArray(userAns) ? userAns : [];
    return (q.pairs || []).every((_, i) => ua[i] === i);
  }
  return false;
}

// Hiển thị đáp án (của học viên hoặc đáp án đúng) dạng text để show ở màn hình kết quả
export function formatAnswer(q, userAns, showCorrect=false){
  const type = q.type || 'mcq_single';
  if(type === 'mcq_single'){
    const i = showCorrect ? q.ans : userAns;
    return (i === undefined || i === null || !q.opts?.[i]) ? 'Chưa chọn' : `${KEYS[i]}. ${q.opts[i]}`;
  }
  if(type === 'mcq_multi'){
    const arr = showCorrect ? (q.ans || []) : (Array.isArray(userAns) ? userAns : []);
    if(!arr.length) return 'Chưa chọn';
    return arr.slice().sort().map(i => `${KEYS[i]}. ${q.opts[i]}`).join('; ');
  }
  if(type === 'fill_blank' || type === 'drag_drop'){
    if(showCorrect) return (q.blanks || []).map(b => String(b||'').split('|')[0]).join(', ');
    const arr = Array.isArray(userAns) ? userAns : [];
    return arr.length ? arr.map(v => v || '(bỏ trống)').join(', ') : 'Chưa điền';
  }
  if(type === 'matching'){
    const pairs = q.pairs || [];
    if(!pairs.length) return '';
    const ua = showCorrect ? pairs.map((_,i)=>i) : (Array.isArray(userAns) ? userAns : []);
    return pairs.map((p,i) => {
      const r = ua[i];
      const rightText = (r === undefined || r === null || r === -1 || !pairs[r]) ? '(chưa ghép)' : pairs[r].right;
      return `${p.left} → ${rightText}`;
    }).join('; ');
  }
  return '';
}

export function renderRich(txt) {
    if (!txt) return '';
    
    // 1. Tự mã hóa HTML để kiểm soát 100% (Không dùng hàm esc cũ nữa)
    let s = String(txt)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // 2. Mở khóa (Khôi phục) riêng cho các thẻ định dạng B, I, U
    s = s.replace(/&lt;b&gt;/gi, '<b>').replace(/&lt;\/b&gt;/gi, '</b>');
    s = s.replace(/&lt;i&gt;/gi, '<i>').replace(/&lt;\/i&gt;/gi, '</i>');
    s = s.replace(/&lt;u&gt;/gi, '<u>').replace(/&lt;\/u&gt;/gi, '</u>');
    
    // 3. Mở khóa cho thẻ SPAN đổi màu (Bao trọn mọi loại dấu nháy)
    s = s.replace(/&lt;span style=(&#39;|&quot;|&apos;|"|')color:\s*([a-zA-Z0-9#]+)\1&gt;/gi, '<span style="color:$2">');
    s = s.replace(/&lt;\/span&gt;/gi, '</span>');
    
    // 4. Trả lại thẻ xuống dòng
    return s.replace(/\n/g, '<br>');
}

export function typesetMath(root=document.body){
  if(window.MathJax?.typesetPromise){
    window.MathJax.typesetPromise([root]).catch(console.error);
  }
}

export function getPool(exam){
  // 1. NẾU GIÁO VIÊN SOẠN THỦ CÔNG -> Trích xuất chính xác theo mảng thứ tự qIds
  if(exam.qIds && exam.qIds.length > 0){
      return exam.qIds.map(id => state.questions.find(q => q.id === id)).filter(Boolean);
  }
  
  // 2. NẾU LÀ ĐỀ TỰ ĐỘNG -> Lọc tất cả từ trong kho
  let pool = state.questions.slice();
  if(exam.subcat) pool = pool.filter(q => q.subcat === exam.subcat);
  else if(exam.cat) pool = pool.filter(q => q.cat === exam.cat);
  return pool;
}

export async function initData(loadResults = false){
  try{
    const catSnap = await getDoc(doc(db, "metadata", "categories"));
    if(!catSnap.exists()){
      // Chỉ nạp dữ liệu gốc ở lần đầu tiên khởi tạo (khi chưa có Document trên Firebase)
      state.SUBCATS = clone(DEFAULT_SUBCATS);
      await setDoc(doc(db, "metadata", "categories"), state.SUBCATS);
    } else {
      // Bắt buộc sử dụng 100% dữ liệu từ Firebase trả về. 
      // Không gộp (merge) với DEFAULT_SUBCATS để tránh việc các chủ đề đã xóa bị hiện lại.
      state.SUBCATS = catSnap.data();
    }

    const qSnap = await getDocs(collection(db, "questions"));
    if(qSnap.empty){
      for(const q of DEFAULT_QUESTIONS) await setDoc(doc(db, "questions", String(q.id)), q);
      state.questions = DEFAULT_QUESTIONS.slice();
    } else {
      state.questions = qSnap.docs.map(d => d.data());
    }
    state.nextQId = state.questions.length ? Math.max(...state.questions.map(q => Number(q.id)||0), 99) + 1 : 100;

    const eSnap = await getDocs(collection(db, "exams"));
    if(eSnap.empty){
      for(const e of DEFAULT_EXAMS) await setDoc(doc(db, "exams", String(e.id)), e);
      state.exams = DEFAULT_EXAMS.slice();
    } else {
      state.exams = eSnap.docs.map(d => d.data());
      if(!state.exams.some(e => e.cat === 'Toán')){
        const mathExam = DEFAULT_EXAMS.find(e => e.cat === 'Toán');
        if (mathExam) {
            state.exams.push(mathExam);
            await setDoc(doc(db, "exams", String(mathExam.id)), mathExam);
        }
      }
    }
    state.nextEId = state.exams.length ? Math.max(...state.exams.map(e => Number(e.id)||0), 9) + 1 : 10;

    if(loadResults){
      const rSnap = await getDocs(collection(db, "results"));
      state.results = rSnap.docs.map(d => d.data()).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    } else {
        state.results = [];
    }
  }catch(error){
    console.error("Lỗi kết nối database:", error);
    alert("Lỗi kết nối Firebase. Hãy kiểm tra API Key, Firestore Rules và Console.");
    if(Object.keys(state.SUBCATS).length === 0) state.SUBCATS = clone(DEFAULT_SUBCATS);
  }
}
