# Gói nâng cấp trac-nghiem-frontend v2

## Cách cài

1. Copy các file trong thư mục `js/` của gói này và ghi đè vào repo:
   - `js/firebase.js`
   - `js/common.js`
   - `js/questions.js`
   - `js/student.js`

2. Mở `student.html` và `teacher.html`, thêm MathJax trước thẻ script module cuối trang:

```html
<script>
  window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\(', '\\)']] } };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
```

3. Mở `css/style.css`, copy toàn bộ nội dung trong `css/style-v2-additions.css` và dán xuống cuối file.

4. Commit lên GitHub:

```bash
git add .
git commit -m "Upgrade quiz app v2: latex image pagination import"
git push
```

## Tính năng đã thêm

- Sửa hàm escape HTML an toàn hơn.
- Hiển thị LaTeX ở câu hỏi và đáp án.
- Hiển thị ảnh minh họa câu hỏi bằng URL hoặc Base64.
- Tìm kiếm câu hỏi trong ngân hàng.
- Phân trang câu hỏi: 10, 20, 50, 100 câu/trang.
- Import câu hỏi từ Excel/CSV.
- Tải file mẫu CSV.
- Tự lưu bài làm vào `localStorage`, học viên F5 có thể tiếp tục.
- Bổ sung đề Toán mặc định nếu chưa có.

## Cấu trúc file import

Các cột nên đặt tên:

| cat | subcat | text | image | A | B | C | D | ans |
|---|---|---|---|---|---|---|---|---|
| Toán | Toán/Phần 1 - Số học | Tính $2^5+3^2$ |  | $32$ | $41$ | $25$ | $64$ | B |

Cột `ans` dùng A, B, C, D hoặc 0, 1, 2, 3.
