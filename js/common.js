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

export function renderRich(text){
  // Cho phép MathJax xử lý $...$, \(...\), \[...\]. Nội dung vẫn được escape HTML để an toàn.
  return esc(text).replace(/\n/g, '<br>');
}

export function typesetMath(root=document.body){
  if(window.MathJax?.typesetPromise){
    window.MathJax.typesetPromise([root]).catch(console.error);
  }
}

export function getPool(exam){
  let pool = state.questions.slice();
  if(exam.subcat) pool = pool.filter(q => q.subcat === exam.subcat);
  else if(exam.cat) pool = pool.filter(q => q.cat === exam.cat);
  return pool;
}

export async function initData(loadResults = false){
  try{
    const catSnap = await getDoc(doc(db, "metadata", "categories"));
    if(!catSnap.exists() || Object.keys(catSnap.data()).length === 0){
      state.SUBCATS = clone(DEFAULT_SUBCATS);
      await setDoc(doc(db, "metadata", "categories"), state.SUBCATS);
    } else {
      state.SUBCATS = {...clone(DEFAULT_SUBCATS), ...catSnap.data()};
      await setDoc(doc(db, "metadata", "categories"), state.SUBCATS);
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
        state.exams.push(mathExam);
        await setDoc(doc(db, "exams", String(mathExam.id)), mathExam);
      }
    }
    state.nextEId = state.exams.length ? Math.max(...state.exams.map(e => Number(e.id)||0), 9) + 1 : 10;

    if(loadResults){
      const rSnap = await getDocs(collection(db, "results"));
      state.results = rSnap.docs.map(d => d.data()).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    } else state.results = [];
  }catch(error){
    console.error("Lỗi kết nối database:", error);
    alert("Lỗi kết nối Firebase. Hãy kiểm tra API Key, Firestore Rules và Console.");
    if(Object.keys(state.SUBCATS).length === 0) state.SUBCATS = clone(DEFAULT_SUBCATS);
  }
}
