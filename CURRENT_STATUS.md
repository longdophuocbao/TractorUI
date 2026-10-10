# TractorUI - Current Implementation Status

Tài liệu này phản ánh hiện trạng thực tế của `TractorUI`, phân loại rõ ràng các tính năng đã hoàn thiện (Production Ready), đang phát triển (In-Progress / Partial), và các tính năng mô phỏng hoặc giả định (Mock / Simulation).

Mọi kết luận trong tài liệu này đều dựa trên bằng chứng kiểm tra mã nguồn thực tế tại `TractorUI/index.html` (~5,088 dòng).

---

## 1. Bảng Tổng kết Hiện trạng (Feature Status Matrix)

| Nhóm chức năng | Tính năng cụ thể | Trạng thái | Bằng chứng mã nguồn |
| :--- | :--- | :--- | :--- |
| **Hạ tầng & Kết nối** | WebSocket Kết nối rosbridge | **Hoàn thành** | `connectROS()`, `reconnectInterval`, tự phục hồi sau mất kết nối (`index.html#L3370`) |
| | Tự phát hiện trạng thái mạng | **Hoàn thành** | Lắng nghe event `connection`, `close`, `error` cập nhật icon trạng thái |
| **Bản đồ & Định vị** | Render Bản đồ thực địa Leaflet | **Hoàn thành** | Khởi tạo Tile layer bản đồ vệ tinh / OSM (`index.html#L3410`) |
| | Vẽ Marker Máy kéo xoay theo Heading | **Hoàn thành** | Custom SVG tractor icon, xoay theo góc từ IMU/GNSS (`index.html#L3450`) |
| | Vẽ Vệt bánh xe (Breadcrumb Trail) | **Hoàn thành** | Polyline lưu 500 điểm toạ độ gần nhất (`index.html#L3510`) |
| | Bản đồ xoay theo mũi xe (Head-Up Mode) | **Hoàn thành** | CSS `transform: rotate(-heading)` trên Leaflet Map Pane (`index.html#L3550`) |
| | Cố định hướng Bắc (North-Up Mode) | **Hoàn thành** | Toggle bằng nút La bàn `#compass-btn` |
| **Dẫn đường AB-Line** | Ghi nhận đường thẳng cơ sở A-B | **Hoàn thành** | Đồng bộ state machine 1, 2, 3 với `/steer_planner_node` |
| | Vẽ đường tham chiếu nối dài vô hạn | **Hoàn thành** | Hàm `drawInfiniteTargetLine()` tính toán toạ độ biên |
| | Nudge luống cày (Shift Left / Right) | **Hoàn thành** | Gọi service `/steer_planner_node/shift_line` |
| | Hướng dẫn giọng nói tiếng Việt (TTS) | **Hoàn thành** | Web Speech API `window.speechSynthesis` phát âm thanh thông báo |
| **Dẫn đường Lộ trình Ruộng** | Nhận & Vẽ lộ trình cày `/field_path` | **Hoàn thành** | Subscribe `nav_msgs/Path`, render polyline trên bản đồ |
| | Điều khiển Start / Pause / Resume | **Hoàn thành** | Tích hợp service `/path_follower_bridge/start_stop` và `resume` |
| | Báo lỗi xe ở quá xa lộ trình | **Hoàn thành** | Bắt mã trạng thái 5 từ `/path_follower_bridge/state` |
| **Điều khiển Nông cụ Nâng hạ** | Giao diện điều khiển độ sâu / góc nâng | **Hoàn thành** | Thanh slider chọn mm (50-150) và góc (0-35°) |
| | Nút an toàn Hold-to-Confirm | **Hoàn thành** | Touch/Mouse event timer 1000ms có hiệu ứng SVG loading viền tròn |
| | Bắt cảnh báo chiếm quyền cabin | **Hoàn thành** | Cờ `preempted` từ `/depth_link/status` hiện banner cảnh báo đỏ |
| **Công cụ Kỹ sư & Chẩn đoán** | Khóa bảo vệ mật khẩu Kỹ sư | **Hoàn thành** | Modal kiểm tra password trước khi mở tab Diagnostic |
| | ROS 2 Parameter Explorer | **Hoàn thành** | Đọc danh sách param, xem và ghi đè giá trị qua ROS bridge services |
| | Hiệu chuẩn động cơ lái (Calibration) | **Hoàn thành** | Wizard 4 bước gọi các service gán Center, Left limit, Right limit |
| | Đồ thị Lệch lái thời gian thực (Chart.js) | **Hoàn thành** | Chart vẽ so sánh Target Steering vs Actual Steering |
| | Soi dữ liệu thô (Topic Echo Inspector) | **Hoàn thành** | Chọn topic động, echo JSON payload lên màn hình |
| **Giả lập & Thử nghiệm** | Bộ giả lập toạ độ GPS ảo | **Hoàn thành** | Generator toạ độ nội bộ phục vụ chạy demo không cần phần cứng |
| | Splash Screen Canvas 2D | **Hoàn thành** | Mô phỏng xe cày tự động bằng HTML5 Canvas khi chưa nối WebSocket |

---

## 2. Chi tiết các Điểm Cần Chú Ý & Nâng Cấp Kỹ Thuật

### 2.1. Kiến trúc Đơn file (Monolithic Single File)
* **Thực trạng**: Toàn bộ ứng dụng bao gồm HTML cấu trúc, CSS phong cách (~1,200 dòng), và JavaScript nghiệp vụ (~3,500 dòng) được gom chung trong 1 file duy nhất là `index.html` (~5,088 dòng).
* **Ưu điểm hiện tại**:
  * Cực kỳ dễ nạp trực tiếp qua trình duyệt web trên Raspberry Pi 5 hoặc mở qua mạng LAN không cần build pipeline phức tạp.
  * Không phụ thuộc vào Node.js build tools (Vite, Webpack) khi triển khai thực địa.
* **Hạn chế kỹ thuật**:
  * Rất khó bảo trì khi nhiều lập trình viên cùng làm việc (dễ xung đột git merge).
  * Khó viết unit test độc lập cho từng module chức năng (state machine, coordinate projection, ros subscriber).
  * Trình duyệt không cache được tách rời giữa CSS và JS.

### 2.2. Xử lý Hiệu năng (Performance & Memory)
* **Leaflet Trail Memory**: Vệt xe chạy `breadcrumbTrail` hiện đang giới hạn `maxPoints = 500`. Cần đảm bảo cơ chế xoá bớt mảng toạ độ cũ để tránh tràn RAM trình duyệt khi máy cày vận hành liên tục 8-10 tiếng ngoài ruộng.
* **Chart.js Live Data**: Đồ thị góc lái đẩy mẫu liên tục (10-20Hz). Hiện tại đã có cơ chế `shift()` dữ liệu cũ nhưng cần giám sát tiêu thụ CPU trên màn hình cảm ứng nhúng.

---

## 3. Các Tính Năng Dự Kiến (Planned / Backlog)

Dựa trên yêu cầu mở rộng dự án máy cày thông minh, các chức năng tiềm năng có thể mở rộng tiếp theo bao gồm:
1. **Module hóa mã nguồn (Code Modularization)**: Tách file `index.html` thành cấu trúc component chuẩn (ES Modules / Web Components).
2. **Quản lý Bản đồ Ngoại tuyến (Offline Field Map Caching)**: Lưu trữ bản đồ vệ tinh dạng Tile Cache (IndexedDB) để hoạt động ở những cánh đồng xa không có sóng di động 4G.
3. **Quản lý Lịch sử Công việc (Task & Job Logging)**: Lưu trữ diện tích đất đã cày xong, thời gian hoàn thành, và lượng tiêu hao nhiên liệu/pin.
