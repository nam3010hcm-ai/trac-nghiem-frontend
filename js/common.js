import { db, collection, getDocs, getDoc, setDoc, doc } from './firebase.js';

export const TEACHER_PASS = "gv2024";
export const KEYS = ['A','B','C','D'];

export const DEFAULT_SUBCATS = {
  "Word":["Word/Phần 1 - Định dạng ký tự","Word/Phần 2 - Định dạng đoạn văn","Word/Phần 3 - Định dạng trang & lề","Word/Phần 4 - Bảng biểu","Word/Phần 5 - Hình ảnh & đối tượng","Word/Phần 6 - Header, Footer & số trang","Word/Phần 7 - Styles & Heading","Word/Phần 8 - Tiện ích & phím tắt"],
  "Excel":["Excel/Phần 1 - Nhập liệu & định dạng ô","Excel/Phần 2 - Hàm tính toán cơ bản","Excel/Phần 3 - Hàm điều kiện & logic","Excel/Phần 4 - Hàm tra cứu (VLOOKUP, HLOOKUP)","Excel/Phần 5 - Hàm văn bản & ngày tháng","Excel/Phần 6 - Biểu đồ","Excel/Phần 7 - Lọc, sắp xếp & PivotTable","Excel/Phần 8 - Tiện ích & phím tắt"],
  "PowerPoint":["PowerPoint/Phần 1 - Tạo & quản lý slide","PowerPoint/Phần 2 - Định dạng văn bản & hình ảnh","PowerPoint/Phần 3 - Hiệu ứng chuyển slide","PowerPoint/Phần 4 - Hiệu ứng đối tượng (Animation)","PowerPoint/Phần 5 - Trình chiếu & xuất file"],
  "Internet & Email":["Internet & Email/Phần 1 - Trình duyệt & tìm kiếm","Internet & Email/Phần 2 - Email cơ bản","Internet & Email/Phần 3 - Bảo mật & an toàn mạng"],
  "Kiến thức chung":["Kiến thức chung/Phần 1 - Phím tắt Windows","Kiến thức chung/Phần 2 - Quản lý file & thư mục","Kiến thức chung/Phần 3 - Khái niệm tin học cơ bản"]
};

export const DEFAULT_QUESTIONS = [
  {id:1,cat:"Word",subcat:"Word/Phần 1 - Định dạng ký tự",text:"Phím tắt nào dùng để in đậm văn bản trong Word?",opts:["Ctrl+I","Ctrl+B","Ctrl+U","Ctrl+D"],ans:1},
  {id:2,cat:"Word",subcat:"Word/Phần 1 - Định dạng ký tự",text:"Phím tắt nào dùng để in nghiêng văn bản trong Word?",opts:["Ctrl+I","Ctrl+B","Ctrl+U","Ctrl+D"],ans:0},
  {id:3,cat:"Word",subcat:"Word/Phần 2 - Định dạng đoạn văn",text:"Phím tắt Ctrl+E dùng để căn chỉnh đoạn văn theo kiểu nào?",opts:["Căn trái","Căn giữa","Căn phải","Căn đều 2 bên"],ans:1},
  {id:4,cat:"Word",subcat:"Word/Phần 2 - Định dạng đoạn văn",text:"Để thay thế văn bản trong Word, dùng phím tắt nào?",opts:["Ctrl+F","Ctrl+G","Ctrl+H","Ctrl+J"],ans:2},
  {id:5,cat:"Word",subcat:"Word/Phần 3 - Định dạng trang & lề",text:"Để đặt hướng trang nằm ngang (Landscape) trong Word, vào tab nào?",opts:["Home","Insert","Layout","View"],ans:2},
  {id:6,cat:"Word",subcat:"Word/Phần 4 - Bảng biểu",text:"Để chèn bảng trong Word, ta vào tab nào?",opts:["Home","Insert","Design","Layout"],ans:1},
  {id:7,cat:"Word",subcat:"Word/Phần 6 - Header, Footer & số trang",text:"Chức năng Track Changes trong Word dùng để làm gì?",opts:["Thay đổi font chữ","Theo dõi chỉnh sửa","Kiểm tra chính tả","Chèn ảnh"],ans:1},
  {id:8,cat:"Word",subcat:"Word/Phần 8 - Tiện ích & phím tắt",text:"Phím tắt Ctrl+Z trong Word có chức năng gì?",opts:["Lưu file","Sao chép","Hoàn tác (Undo)","Dán"],ans:2},
  {id:9,cat:"Excel",subcat:"Excel/Phần 2 - Hàm tính toán cơ bản",text:"Hàm nào dùng để tính tổng trong Excel?",opts:["=COUNT()","=AVERAGE()","=SUM()","=MAX()"],ans:2},
  {id:10,cat:"Excel",subcat:"Excel/Phần 2 - Hàm tính toán cơ bản",text:"Hàm nào đếm số ô có chứa dữ liệu số trong Excel?",opts:["=COUNTA()","=COUNT()","=COUNTIF()","=COUNTBLANK()"],ans:1},
  {id:11,cat:"Excel",subcat:"Excel/Phần 1 - Nhập liệu & định dạng ô",text:"Để đóng băng hàng tiêu đề trong Excel, ta dùng chức năng nào?",opts:["Merge Cells","Freeze Panes","Split","Hide Rows"],ans:1},
  {id:12,cat:"Excel",subcat:"Excel/Phần 1 - Nhập liệu & định dạng ô",text:"Ký hiệu $ trong công thức Excel ($A$1) dùng để làm gì?",opts:["Nhân với đô la","Cố định địa chỉ ô","Ký hiệu tiền tệ","Tính phần trăm"],ans:1},
  {id:13,cat:"Excel",subcat:"Excel/Phần 4 - Hàm tra cứu (VLOOKUP, HLOOKUP)",text:"Hàm VLOOKUP dùng để làm gì?",opts:["Tính tổng theo điều kiện","Đếm ô không rỗng","Tìm kiếm giá trị theo cột","Tính trung bình"],ans:2},
  {id:14,cat:"Excel",subcat:"Excel/Phần 3 - Hàm điều kiện & logic",text:"Hàm IF trong Excel dùng để làm gì?",opts:["Tính tổng có điều kiện","Trả về giá trị dựa trên điều kiện","Đếm ô theo điều kiện","Tìm giá trị lớn nhất"],ans:1},
  {id:15,cat:"PowerPoint",subcat:"PowerPoint/Phần 1 - Tạo & quản lý slide",text:"Để thêm slide mới trong PowerPoint, dùng phím tắt nào?",opts:["Ctrl+N","Ctrl+M","Ctrl+T","Ctrl+S"],ans:1},
  {id:16,cat:"PowerPoint",subcat:"PowerPoint/Phần 5 - Trình chiếu & xuất file",text:"Chế độ Slide Show bắt đầu từ slide hiện tại dùng phím nào?",opts:["F5","F4","Shift+F5","Ctrl+F5"],ans:2},
  {id:17,cat:"PowerPoint",subcat:"PowerPoint/Phần 3 - Hiệu ứng chuyển slide",text:"Để chèn hiệu ứng chuyển slide trong PowerPoint, vào tab nào?",opts:["Insert","Design","Transitions","Animations"],ans:2},
  {id:18,cat:"Internet & Email",subcat:"Internet & Email/Phần 2 - Email cơ bản",text:"CC trong email có nghĩa là gì?",opts:["Confidential Copy","Carbon Copy","Closed Copy","Common Copy"],ans:1},
  {id:19,cat:"Internet & Email",subcat:"Internet & Email/Phần 2 - Email cơ bản",text:"BCC trong email nghĩa là gì?",opts:["Big Carbon Copy","Blind Carbon Copy","Basic Carbon Copy","Broad CC"],ans:1},
  {id:20,cat:"Kiến thức chung",subcat:"Kiến thức chung/Phần 1 - Phím tắt Windows",text:"Phím tắt nào dùng để chọn tất cả?",opts:["Ctrl+A","Ctrl+S","Ctrl+C","Ctrl+V"],ans:0},
  {id:21,cat:"Kiến thức chung",subcat:"Kiến thức chung/Phần 1 - Phím tắt Windows",text:"Phím tắt nào dùng để lưu file?",opts:["Ctrl+P","Ctrl+S","Ctrl+W","Ctrl+O"],ans:1},
  {id:22,cat:"Kiến thức chung",subcat:"Kiến thức chung/Phần 2 - Quản lý file & thư mục",text:"Phím tắt tạo thư mục mới trong Windows Explorer?",opts:["Ctrl+N","Ctrl+Shift+N","Alt+N","Shift+N"],ans:1}
];

export const DEFAULT_EXAMS = [
  {id:1,name:"Đề tổng hợp cơ bản",desc:"Kiểm tra kiến thức Word, Excel, PowerPoint",count:10,cat:"",subcat:"",timeLimit:0,isHidden:false},
  {id:2,name:"Chuyên đề Word",desc:"Kiểm tra chuyên sâu Microsoft Word",count:8,cat:"Word",subcat:"",timeLimit:0,isHidden:false},
  {id:3,name:"Chuyên đề Excel",desc:"Kiểm tra chuyên sâu Microsoft Excel",count:6,cat:"Excel",subcat:"",timeLimit:0,isHidden:false}
];

export const state = { SUBCATS:{}, questions:[], exams:[], results:[], nextQId:100, nextEId:10 };

export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
export const clone = obj => JSON.parse(JSON.stringify(obj));
export const shuffle = a => a.slice().sort(() => Math.random() - .5);

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
      state.SUBCATS = catSnap.data();
    }

    const qSnap = await getDocs(collection(db, "questions"));
    if(qSnap.empty){
      for(const q of DEFAULT_QUESTIONS) {
        await setDoc(doc(db, "questions", String(q.id)), q);
      }
      state.questions = DEFAULT_QUESTIONS.slice();
    } else {
      state.questions = qSnap.docs.map(d => d.data());
    }

    state.nextQId = state.questions.length
      ? Math.max(...state.questions.map(q => q.id), 99) + 1
      : 100;

    const eSnap = await getDocs(collection(db, "exams"));
    if(eSnap.empty){
      for(const e of DEFAULT_EXAMS) {
        await setDoc(doc(db, "exams", String(e.id)), e);
      }
      state.exams = DEFAULT_EXAMS.slice();
    } else {
      state.exams = eSnap.docs.map(d => d.data());
    }

    state.nextEId = state.exams.length
      ? Math.max(...state.exams.map(e => e.id), 9) + 1
      : 10;

    if(loadResults){
      const rSnap = await getDocs(collection(db, "results"));
      state.results = rSnap.docs
        .map(d => d.data())
        .sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    } else {
      state.results = [];
    }

  }catch(error){
    console.error("Lỗi kết nối database:", error);
    alert("Lỗi kết nối Firebase. Hãy kiểm tra API Key, Firestore Rules và Console.");

    if(Object.keys(state.SUBCATS).length === 0) {
      state.SUBCATS = clone(DEFAULT_SUBCATS);
    }
  }
}
