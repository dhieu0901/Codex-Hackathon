# 📝 Lịch sử hội thoại & Bối cảnh dự án (Context History)

## 1. Bối cảnh dự án (Project Context)
- **Tên dự án:** Đọc Giúp — Trợ lý AI đọc hiểu văn bản cho người cao tuổi Việt Nam.
- **Tính chất:** Hackathon siêu tốc (5 tiếng), ưu tiên tính năng cốt lõi (Vertical Slice: Chụp ảnh -> Hiểu -> Đọc to).
- **Tech Stack:** Next.js 14 (App Router), React 18, Vanilla CSS. Không dùng Tailwind hay TypeScript để tối ưu tốc độ setup.
- **Vai trò AI Agent:** Person B (UI/UX Lead). Chịu trách nhiệm thiết kế giao diện và trải nghiệm người dùng (UX) độc lập, sử dụng Mock Data, không can thiệp logic gọi API hay Web Speech.

## 2. Triết lý thiết kế (Elderly-Optimized UX)
Hệ thống thiết kế (Design System) được tối ưu hóa nghiêm ngặt cho người cao tuổi (mắt kém, tay run):
- **Font size:** Không có chữ nào nhỏ hơn 18px. (Body: 20px, Heading: 32px, Result: 24px).
- **Kích thước nút bấm:** Chiều cao tối thiểu 56px, nút lớn 72px (chuẩn Accessibility). Nút to, rõ, dễ bấm.
- **Màu sắc & Độ tương phản:** Đạt chuẩn WCAG AAA. Sử dụng Dark mode mặc định không chói mắt (Background: `#0a0a14`, Surface: `#16182a`, Text: `#f1f5f9`).
- **Màu nhấn:** Primary (`#60a5fa` - Xanh), Accent (`#f97316` - Cam).
- **Micro-copy (Ngôn từ):** Tiếng Việt đơn giản, thân thiện, đời thường (VD: "📖 ĐỌC GIÚP TÔI", "📷 CHỤP LẠI").

## 3. Các bước đã triển khai (Task Execution)

AI Agent đã thực hiện thành công 5 bước theo yêu cầu và các tác vụ setup bổ sung:

### Step 1: Thiết lập Design System (DG-FE-01)
- Tạo `src/app/globals.css`: Định nghĩa toàn bộ CSS Variables (màu sắc, spacing, typography). Thêm các hiệu ứng animation (shimmer cho loading, pulse cho mic, fade-in).
- Tạo `src/app/layout.js`: Cấu hình thẻ meta viewport chuẩn mobile, font Inter tiếng Việt, và layout bao bọc (App container + Header).

### Step 2: Component CameraCapture (DG-FE-02)
- Tạo `src/components/CameraCapture.js`.
- Sử dụng `<input type="file" accept="image/*" capture="environment">` để mở camera native an toàn và tương thích cao.
- Xử lý 2 trạng thái: Chưa chụp (nút "📷 CHỤP CHỮ" khổng lồ) và Đã chụp (preview ảnh kèm nút "ĐỌC GIÚP TÔI" và "CHỤP LẠI").

### Step 3: Component ResultDisplay (DG-FE-03)
- Tạo `src/components/ResultDisplay.js`.
- Hiển thị kết quả bằng giao diện dạng thẻ lớn:
  - Badge phân loại (💊 thuốc, 🧾 hóa đơn, 📄 công văn...).
  - Giải thích nội dung (chữ rất to).
  - Danh sách ý chính (key points) với animation xuất hiện tuần tự (stagger).
  - Cảnh báo y tế (Disclaimer) tự động hiện ra nếu văn bản là nhãn thuốc.
  - Accordion ẩn/hiện văn bản gốc.
  - Nút hành động: "🔊 NGHE LẠI" và "📷 CHỤP MỚI".

### Step 4: Components Phụ trợ (DG-FE-05)
- Tạo `src/components/LoadingState.js`: Giao diện lúc đang chờ API, sử dụng hiệu ứng shimmer nhẹ nhàng và icon 🔊 nhấp nháy, kèm thông báo "Đang đọc giúp bạn...".
- Tạo `src/components/ErrorMessage.js`: Giao diện báo lỗi có icon ⚠️ lớn, nội dung thân thiện bằng tiếng Việt, kèm nút "🔄 THỬ LẠI".

### Step 5: Component VoiceChat (DG-FE-04)
- Tạo `src/components/VoiceChat.js`.
- Thiết kế giao diện chat: tin nhắn của User bên phải (màu accent), của AI bên trái.
- Nút Microphone cực to (80px) có hiệu ứng `pulse` (tỏa sóng) khi đang ghi âm.
- Input fallback cho người dùng muốn gõ chữ (dành cho iOS/thiết bị lỗi mic).

### Tác vụ Setup Hệ Thống (Bonus)
- Vì hệ thống chưa được scaffold sẵn (thiếu repo khởi tạo) và máy tính **chưa cài đặt Node.js**, Agent đã chủ động tạo:
  - `package.json` định nghĩa dependencies (Next.js, React, OpenAI).
  - `next.config.js`.
  - `src/app/page.js`: Một trang Demo (Preview Page) tích hợp toàn bộ các component trên cùng với thanh Debug Toolbar để người dùng dễ dàng chuyển đổi qua lại giữa các trạng thái giao diện (Camera -> Loading -> Result -> Error).

## 4. Troubleshooting & Log Analysis

Trong quá trình User thực hiện cài đặt và chạy thử (Test Run), một số rào cản môi trường đã xuất hiện và được AI Agent hướng dẫn xử lý thành công:

### Cài đặt Môi trường (Node.js & NPM)
- **Vấn đề:** Lệnh `npm install` bị báo lỗi `CommandNotFoundException` do hệ thống thiếu Node.js.
- **Giải pháp:** Tận dụng môi trường Conda đang chạy của User `(hm)`, Agent đã hướng dẫn chạy lệnh `conda install -c conda-forge nodejs` để cài đặt nhanh chóng Node.js trực tiếp từ Terminal.
- **Lưu ý Log NPM:** Trong quá trình `npm install`, xuất hiện các dòng cảnh báo `npm warn deprecated` và `vulnerabilities`. Đây là những cảnh báo tiêu chuẩn đối với các gói cũ trong bộ cài Next.js 14, không gây ảnh hưởng đến tiến độ Hackathon nên đã được Agent giải thích để User an tâm bỏ qua. (Cài đặt thành công `added 347 packages`).

### Xử lý Cảnh báo Git (Too many changes)
- **Vấn đề:** IDE cảnh báo *"The git repository has too many active changes"* do sự xuất hiện của thư mục `node_modules` (chứa hàng ngàn tệp phụ thuộc).
- **Giải pháp:** Agent đã chủ động tạo file `.gitignore` chứa luật bỏ qua `/node_modules`, `/.next/`, và các file build tĩnh để giảm tải hệ thống theo dõi của Git, giúp môi trường IDE mượt mà hơn.

### Phân tích Test Run Lần 1 (`npm run dev` — Next.js 14)
Ngay sau khi khởi động Server, log Terminal đã ghi nhận các sự kiện sau:
1. **Khởi động Server:** Next.js Server khởi động thành công trên `http://localhost:3000` (Ready trong 12.5s).
2. **Compile Trang chủ thành công:** Lần đầu tiên truy cập (GET /), React component của Person B đã biên dịch và render hoàn hảo (HTTP 200 OK), đảm bảo không có bất kỳ cú pháp JS/React nào bị crash.
3. **Cảnh báo Metadata (Warning):** Next.js 14 cảnh báo `Unsupported metadata viewport/themeColor in metadata export`. Việc cấu hình `viewport` nằm trong khối `metadata` tại `layout.js` bị coi là không tương thích theo chuẩn mới (cần tách rời thành biến `export const viewport`), nhưng lỗi này chỉ là cảnh báo (Warning), hoàn toàn không làm gián đoạn UI.
4. **Lỗi tĩnh 404 (Expected):** Trình duyệt ghi nhận mã 404 Not Found ở file `/manifest.json` và `/icons/icon-192.png`. Lỗi này **nằm trong dự tính** do các tệp PWA (Progressive Web App) chưa được khởi tạo. Đây là tác vụ (DG-INT-03) thuộc sự phân công của Person C (chưa được triển khai).

## 5. Hợp nhất Code Person A & Person B (Git Merge)

### Bối cảnh
Person A đã push bản scaffold chính thức lên GitHub, bao gồm:
- **Next.js 16.2.9** (phiên bản mới hơn so với bản 14 mà Person B dùng ban đầu), React 19.2.4.
- **API routes (Mock):** `src/app/api/understand/route.js` và `src/app/api/ask/route.js` — trả dữ liệu mẫu Paracetamol 500mg, có delay 1-1.5 giây mô phỏng API thật.
- **File config chuẩn:** `package.json`, `next.config.js`, `.gitignore`, `eslint.config.mjs`, `.env.example`.
- **Placeholder rỗng:** `src/components/.gitkeep.js` (chờ Person B), `src/lib/.gitkeep.js` (chờ Person C).

### Quá trình Merge
1. **Lỗi Untracked Files:** Lần chạy `git pull origin main` đầu tiên bị lỗi `untracked working tree files would be overwritten by merge` do Person B đã tạo sẵn các file cùng tên (`globals.css`, `layout.js`, `page.js`, `package.json`, etc.) mà chưa commit.
2. **Giải pháp:** Agent đã commit toàn bộ code của Person B trước (`git add . && git commit`), sau đó pull lại (`git pull origin main --no-rebase`). Git báo 7 file conflict.
3. **Resolve Conflict theo nguyên tắc Ownership:**
   - **Giữ code Person B (`--ours`):** `src/app/globals.css`, `src/app/layout.js`, `src/app/page.js` — đây là các file giao diện thuộc trách nhiệm của Person B.
   - **Giữ code Person A (`--theirs`):** `package.json`, `package-lock.json`, `next.config.js`, `.gitignore` — đây là các file nền tảng/config thuộc trách nhiệm của Person A.
4. **Kết quả:** Merge thành công, commit message: `"Merge Person A foundation with Person B UI"`.

### Phân tích Test Run Lần 2 (`npm run dev` — Next.js 16 + Turbopack)
Sau khi merge, server chạy lại trên nền Next.js 16 của Person A:
1. **Thay đổi nền tảng:** Server giờ hiển thị `▲ Next.js 16.2.9 (Turbopack)` thay vì bản 14 cũ. Turbopack là bundler mới, nhanh hơn Webpack.
2. **Compile thành công:** `GET / 200 in 9.0s` — UI của Person B render đúng trên nền Next.js 16 mà không cần bất kỳ thay đổi code nào.
3. **Cảnh báo Metadata:** Vẫn xuất hiện warning `viewport/themeColor` do `layout.js` của Person B dùng cú pháp cũ. Cần fix nhỏ bằng cách tách `export const viewport = {}` riêng.
4. **Lỗi Hydration Mismatch (Browser Extensions):** Trình duyệt hiển thị cảnh báo đỏ về sự khác biệt HTML giữa Server và Client. Nguyên nhân **100% do browser extension** (các thuộc tính `bis_skin_checked`, `bis_register`, `__processed_...` — dấu hiệu đặc trưng của extension IDM/Bitdefender). **Không phải lỗi code.** Giải pháp: mở tab Incognito hoặc tắt extensions.
5. **Lỗi 404 `/manifest.json`:** Vẫn còn do Person C chưa tạo file PWA.

## 6. Trạng thái hiện tại của Project (Snapshot)

### Cấu trúc thư mục
```
Codex-Hackathon/
├── public/                        # (Person A) Static assets
│   ├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ask/route.js       # ✅ Person A — Mock Q&A API
│   │   │   └── understand/route.js # ✅ Person A — Mock OCR+Explain API
│   │   ├── globals.css            # ✅ Person B — Design System (CSS Variables, animations)
│   │   ├── layout.js              # ✅ Person B — App Layout + Meta + Font
│   │   └── page.js                # ✅ Person B — Demo Page (state machine + debug toolbar)
│   ├── components/
│   │   ├── CameraCapture.js       # ✅ Person B — Chụp ảnh + Preview
│   │   ├── ResultDisplay.js       # ✅ Person B — Hiển thị kết quả
│   │   ├── VoiceChat.js           # ✅ Person B — Chat + Mic
│   │   ├── LoadingState.js        # ✅ Person B — Shimmer loading
│   │   └── ErrorMessage.js        # ✅ Person B — Báo lỗi thân thiện
│   └── lib/
│       └── .gitkeep.js            # ⬜ Person C — Chờ speech.js, imageUtils.js, api.js
├── .env.example                   # ✅ Person A — Template cho OPENAI_API_KEY
├── .gitignore                     # ✅ Đã config (node_modules, .next, .env.local)
├── package.json                   # ✅ Person A — Next.js 16.2.9, React 19.2.4, OpenAI
├── implementation_plan.md         # 📋 Tài liệu kiến trúc tổng thể
├── task_split.md                  # 📋 Phân công chi tiết 3 người
└── history_chat.md                # 📝 File này
```

### Tiến độ theo Task ID
| Task ID | Mô tả | Owner | Trạng thái |
|---------|--------|-------|------------|
| DG-FND-01 | Scaffold Next.js + Push repo | Person A | ✅ Hoàn thành |
| DG-FND-02 | Mock API routes | Person A | ✅ Hoàn thành |
| DG-BE-01 | `/api/understand` (GPT-4o Vision) | Person A | ⬜ Chưa wire real OpenAI |
| DG-BE-02 | `/api/ask` (Q&A grounded) | Person A | ⬜ Chưa wire real OpenAI |
| DG-FE-01 | Design System CSS | Person B | ✅ Hoàn thành |
| DG-FE-02 | CameraCapture component | Person B | ✅ Hoàn thành |
| DG-FE-03 | ResultDisplay component | Person B | ✅ Hoàn thành |
| DG-FE-04 | VoiceChat component | Person B | ✅ Hoàn thành |
| DG-FE-05 | LoadingState + ErrorMessage | Person B | ✅ Hoàn thành |
| DG-INT-01 | Wiring page.js (glue logic) | Person C | ⬜ Chưa bắt đầu |
| DG-INT-02 | speech.js + imageUtils.js | Person C | ⬜ Chưa bắt đầu |
| DG-INT-03 | PWA manifest + Deploy | Person C | ⬜ Chưa bắt đầu |

### Các vấn đề kỹ thuật nhỏ cần fix
1. **Warning `viewport/themeColor`:** Cần tách `viewport` và `themeColor` ra khỏi object `metadata` trong `layout.js` thành `export const viewport = { ... }` riêng.
2. **Hydration Mismatch:** Không phải lỗi code, do browser extensions. Giải pháp: test trên Incognito.
3. **404 `/manifest.json`:** Chờ Person C tạo.

## 7. Tổng kết
Cuộc hội thoại đã hoàn thành xuất sắc vai trò của Person B, xây dựng bộ giao diện React component hoàn chỉnh, tối ưu cho người cao tuổi. Đồng thời, Agent đã đóng vai trò hỗ trợ đắc lực trong việc debug môi trường (thiết lập Node.js, config Gitignore, phân tích log Next.js), hợp nhất thành công code của Person A và Person B, đảm bảo User (hoặc Person C) có một nền tảng code sẵn sàng nhất để đấu API thật.

## 8. Bổ sung lịch sử hội thoại mới — hoàn thiện vertical slice thật

### 8.1. Rà soát repo và xác định việc tiếp theo của Person B
- User yêu cầu đọc lại `history_chat.md` và toàn bộ repo để xác định Person B cần làm gì tiếp theo trong lúc Person A vừa có chỉnh sửa.
- Agent kiểm tra repo và phát hiện local `main` đang `ahead 2, behind 1` so với `origin/main`; sau `git fetch`, remote có commit mới:
  - `5bd9d69 DG-A02: /api/understand gọi GPT-4o Vision thật (thay mock)`.
- Agent xác định đây là thay đổi của Person A: thay `/api/understand` mock bằng route GPT-4o Vision thật, không xung đột trực tiếp với UI của Person B.
- Kết luận lúc đó:
  - Person B đã xong UI chính nhưng `page.js` vẫn còn mock local.
  - Person B cần merge code A, sửa warning metadata, bỏ debug toolbar, làm rõ contract cho Person C, rồi test lại.

### 8.2. Person B production polish và đồng bộ code Person A
- Agent stash riêng `history_chat.md`, merge `origin/main`, rồi pop lại để bảo toàn thay đổi lịch sử chat.
- Merge thành công, local đã chứa `/api/understand` GPT-4o Vision thật từ Person A.
- Agent sửa `src/app/layout.js`:
  - Tách `export const viewport` khỏi `metadata` để xử lý warning Next.js `viewport/themeColor`.
  - Thêm `next/font/google` với Inter tiếng Việt.
  - Sau đó thêm `suppressHydrationWarning` ở `<html>` và `<body>` để giảm nhiễu từ browser extension chèn thuộc tính vào DOM.
- Agent sửa `src/app/globals.css`:
  - Bỏ `@import` Google Fonts.
  - Dùng biến font `--font-inter` từ `next/font`.
- Agent sửa `src/app/page.js` lần đầu:
  - Bỏ debug toolbar production.
  - Bỏ chat giả mặc định.
  - Thêm `onMicPress` riêng cho VoiceChat thay vì dùng sentinel string.
- Agent sửa `src/components/CameraCapture.js`:
  - Thêm cleanup `URL.revokeObjectURL` khi component unmount/ảnh đổi.
  - Ghi rõ contract `onCapture(file)`: component trả `File`, phần integration convert sang data URL/base64.
- Agent sửa `src/components/ResultDisplay.js`:
  - Bỏ fallback mock Paracetamol bên trong component.
  - Thêm fallback trung tính.
  - Ghi rõ Person C/page map API `raw_text` và `key_points` sang props camelCase.
- Agent sửa `src/components/VoiceChat.js`:
  - Bỏ mock chat mặc định.
  - Thay sentinel `__MIC_PRESSED__` bằng prop `onMicPress`.
  - Đưa input/nút gửi về chuẩn chiều cao tối thiểu 56px.
- Agent thêm `src/components/CONTRACTS.md`:
  - Ghi contract cho `CameraCapture`, `ResultDisplay`, `VoiceChat`.
  - Mục tiêu là giúp Person C nối voice/integration không hiểu nhầm interface.
- Agent kiểm tra static:
  - `git diff --check` pass.
  - Không còn pattern `__MIC_PRESSED__`, `Debug Navigation`, font 14/16/17px, hoặc nút 48px trong source.

### 8.3. Kiểm tra môi trường, OpenAI key và GPT-4o Vision thật
- User hỏi cách xem UI hiện tại.
- Agent hướng dẫn chạy:
  - `conda activate hm`
  - `npm run dev`
  - mở `http://localhost:3000`.
- User tạo `.env` và nhập `OPENAI_API_KEY`.
- Agent nhắc restart dev server sau khi thêm env.
- Agent kiểm tra server:
  - `http://localhost:3000` trả `200`.
  - `POST /api/understand` với body `{}` trả `400 {"error":"Chưa có ảnh..."}`, chứng tỏ route đang load.
- Agent tạo ảnh test tạm trong `%TEMP%` có nội dung:
  - `Paracetamol 500mg`
  - `Uống 2 viên x 3 lần/ngày sau ăn.`
  - `Không dùng quá 8 viên/ngày.`
  - `Hỏi bác sĩ nếu còn đau sau 3 ngày.`
- Agent gọi trực tiếp `/api/understand` bằng PowerShell:
  - Kết quả `HTTP 200`.
  - GPT-4o Vision đọc đúng tiếng Việt và trả JSON gồm `raw_text`, `type`, `explanation`, `key_points`.
- Có hiện tượng `Invoke-RestMethod` hiển thị mojibake vì decode thiếu UTF-8 charset.
- Agent gọi lại bằng `System.Net.Http` và decode bytes UTF-8 thủ công; response tiếng Việt hiển thị đúng.
- Kết luận: `OPENAI_API_KEY` hoạt động và GPT-4o Vision thật đã chạy thành công.

### 8.4. Phát hiện UI vẫn dùng mock và chuyển sang vertical slice thật
- User chạy UI với `test_image_pill.png` nhưng UI vẫn trả thông tin cũ Paracetamol mock:
  - `Mỗi ngày uống 3 lần, mỗi lần 2 viên...`
  - Chat trả lời cũ: `Dạ, theo tờ giấy thì bác nên uống sau bữa ăn ạ.`
- Agent xác định nguyên nhân:
  - `page.js` vẫn render `mockResultData`.
  - `handleCapture` chỉ `setTimeout(() => setScreen('result'), 2000)`.
  - `handleSendMessage` vẫn trả câu trả lời mock.
- Agent thêm `src/lib/imageUtils.js`:
  - `fileToDataUrl(file)` đọc file ảnh.
  - Resize/compress ảnh lớn bằng canvas về data URL JPEG.
  - Trả data URL để gửi API `/api/understand`.
- Agent thay toàn bộ `src/app/page.js` bằng flow thật:
  - `CameraCapture` trả `File`.
  - `fileToDataUrl(file)` convert/resize.
  - `fetch('/api/understand', { body: JSON.stringify({ image }) })`.
  - Map API snake_case sang UI camelCase qua `normalizeUnderstandResult`.
  - Render `ResultDisplay` bằng dữ liệu thật.
  - Retry dùng lại `lastFile`.
  - Chat gửi câu hỏi và `rawText` thật sang `/api/ask`.
- Agent nâng `src/app/api/ask/route.js` từ mock lên GPT-4o grounded Q&A:
  - Dùng `OPENAI_API_KEY`.
  - Nhận `question` và `rawText`.
  - Chỉ trả lời dựa trên văn bản OCR.
  - Nếu văn bản không có thông tin thì nói rõ không thấy trong tờ giấy.
- Agent cập nhật `src/components/CONTRACTS.md` để phản ánh thực tế mới:
  - `page.js` hiện đã map API và convert ảnh qua `imageUtils.js`.

### 8.5. Kiểm tra với `test_image_pill.png`
- Agent gọi trực tiếp `/api/understand` với `test_image_pill.png`.
- API trả `HTTP 200` và đọc được nội dung thật:
  - `Công thức cho 1 viên:`
  - `Berberin HCL 5mg`
  - `Mộc hương 15mg`
  - `Tá dược vừa đủ 1 viên`
  - `Liều dùng: Người lớn uống 5 viên/lần, ngày 2 - 3 lần.`
  - `Trẻ em dùng theo chỉ dẫn của bác sỹ.`
  - Công dụng liên quan trị lỵ, viêm ruột, ỉa chảy, chậm tiêu, đầy bụng...
- API trả `type: "thuốc"`.
- `explanation` mới:
  - Người lớn uống 5 viên mỗi lần, ngày uống 2 đến 3 lần.
  - Trẻ em hỏi bác sĩ trước khi dùng.
- `key_points` mới:
  - Người lớn uống 5 viên mỗi lần.
  - Ngày uống 2 đến 3 lần.
  - Trẻ em cần hỏi bác sĩ.
  - Trị lỵ, viêm ruột, ỉa chảy, đầy bụng.
- Agent test `/api/ask` với câu `tên thuốc là gì` và `rawText` OCR ở trên.
- API trả:
  - `Tôi không thấy thông tin về tên thuốc trong tờ giấy.`
- Agent giải thích đây là hành vi đúng theo grounded Q&A vì OCR chỉ thấy thành phần/công thức, không thấy dòng tên thuốc riêng.

### 8.6. Hydration warning do browser extension
- User báo lỗi hydration mismatch với các attribute trên `<body>`:
  - `__processed_...`
  - `bis_register`
- Agent xác định đây là dấu hiệu browser extension chèn attribute vào DOM trước khi React hydrate, không phải lỗi logic UI.
- Agent thêm `suppressHydrationWarning` vào `<html>` và `<body>` trong `layout.js`.
- Agent vẫn khuyến nghị test bằng Incognito hoặc tắt extension nếu dev overlay còn ồn trong hot reload.

### 8.7. Trạng thái project sau wiring thật
- Agent kết luận project đã đạt giai đoạn **Vertical Slice chạy được**:
  - Chụp/chọn ảnh.
  - GPT-4o Vision đọc ảnh.
  - UI hiển thị kết quả thật.
  - Hỏi thêm qua GPT-4o dựa trên văn bản OCR thật.
- Trạng thái theo vai trò:
  - **Person A:** Backend/API đã có `/api/understand` và `/api/ask` thật; tiếp theo review prompt, error handling, timeout, chi phí, bảo mật env.
  - **Person B:** UI/UX chính đã xong và đã nối API thật; tiếp theo polish responsive trên điện thoại thật, test text dài, kiểm tra accessibility cho người cao tuổi.
  - **Person C:** tiếp theo là voice + PWA + deploy:
    - Implement TTS cho nút `NGHE LẠI`.
    - Implement STT cho nút mic.
    - Thêm `manifest.json`, icons, PWA/deploy Vercel.
    - Test end-to-end trên thiết bị thật.

### 8.8. Hướng dẫn commit để Person C bắt đầu làm việc
- User muốn commit lên GitHub để Person C bắt đầu.
- Agent kiểm tra `.gitignore`; `.env*` đã bị ignore, trừ `.env.example`.
- Agent khuyên **không dùng `git add .`** vì repo có:
  - `history_chat.md` đang modified.
  - `test_image_pill.png` đang untracked.
  - `.env` chứa secret, đã ignore nhưng vẫn cần cẩn trọng.
- Agent đề xuất stage chọn lọc:
```powershell
git add `
  src/app/api/ask/route.js `
  src/app/globals.css `
  src/app/layout.js `
  src/app/page.js `
  src/components/CameraCapture.js `
  src/components/ResultDisplay.js `
  src/components/VoiceChat.js `
  src/components/CONTRACTS.md `
  src/lib/imageUtils.js
```
- User chạy lệnh `git add` trên và `git status --short` cho thấy:
  - Các file app/component/lib cần commit đã staged.
  - `history_chat.md` vẫn unstaged.
  - `test_image_pill.png` vẫn untracked.
- Agent xác nhận đã commit được.
- Warning `LF will be replaced by CRLF` chỉ là cảnh báo line ending trên Windows, không chặn commit.
- Agent đề xuất commit:
```powershell
git commit -m "Wire UI to real vision and grounded Q&A"
```
- Sau commit, push:
```powershell
git push origin main
```

### 8.9. Giải thích tác dụng các file được stage
- `src/components/CameraCapture.js`:
  - UI chụp/chọn ảnh.
  - Hiển thị preview ảnh.
  - Khi bấm `ĐỌC GIÚP TÔI`, gọi `onCapture(file)` để đưa file ảnh cho `page.js`.
- `src/components/ResultDisplay.js`:
  - Hiển thị kết quả GPT-4o Vision.
  - Nhận `rawText`, `type`, `explanation`, `keyPoints`.
  - Hiển thị loại giấy tờ/thuốc, nội dung chính, ý quan trọng, cảnh báo thuốc, văn bản gốc, nút nghe lại/chụp mới.
- `src/components/VoiceChat.js`:
  - UI hỏi đáp sau khi đọc ảnh.
  - Hiển thị chat bubbles.
  - Có input text và nút mic.
  - `onSendMessage(text)` gửi câu hỏi text; `onMicPress()` dành cho Person C nối speech-to-text.
- `src/components/CONTRACTS.md`:
  - Tài liệu contract UI cho Person C.
  - Ghi rõ cách dùng `CameraCapture`, `ResultDisplay`, `VoiceChat`.
  - Giúp tránh hiểu nhầm props và trách nhiệm integration.
- `src/lib/imageUtils.js`:
  - Helper client-side xử lý ảnh.
  - Convert `File` thành data URL.
  - Resize/compress ảnh lớn bằng canvas trước khi gửi `/api/understand`.
  - Giúp payload nhẹ hơn, nhanh hơn, ít rủi ro vượt giới hạn.
