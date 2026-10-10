# TractorUI - Project Context

> **Dành riêng cho AI Agent (Copilot, Claude Code, Gemini, Cursor)**  
> **Mục tiêu**: Cung cấp bức tranh toàn cảnh về vai trò, kiến trúc logic và các ràng buộc cốt lõi của giao diện người dùng `TractorUI` trong toàn bộ hệ thống Smart Tractor.

---

## 1. Vai trò của TractorUI trong Hệ thống Smart Tractor

`TractorUI` đóng vai trò là **Trạm điều khiển & Quan sát trung tâm (Cockpit HMI)** cho người vận hành máy kéo trên cabin hoặc giám sát từ xa qua điện thoại/máy tính bảng.

Thay vì dựa vào các màn hình nông nghiệp đắt tiền đóng kín của bên thứ ba, `TractorUI`:
1. **Trực quan hóa vị trí & trạng thái**: Nhận vị trí đã hợp nhất tọa độ UTM (`/odometry/global`), trạng thái vệ tinh RTK (`/f9r/rtk_status`), số vệ tinh và vận tốc mặt đất.
2. **Ra lệnh dẫn đường (Guidance System)**: Cho phép chuyển đổi linh hoạt giữa:
   - *Record Line Mode*: Lái một đường mẫu, bấm chốt đường AB tham chiếu, dịch luống sang trái/phải (`swath_left`/`swath_right`), xoay trục tọa độ tham chiếu.
   - *Field Path Mode*: Ghi các góc thửa ruộng (`/record_vertex`), yêu cầu `tractor_autonav` tính toán đường cày phủ kín (`/generate_path`), và điều khiển bật/tắt/tiếp tục bám lộ trình (`/path_follower_bridge/start_stop`).
3. **Điều khiển & Cân chỉnh góc lái (Steering Calibrator)**: Cung cấp thanh kéo Jog motor lái ở moment an toàn để tìm giới hạn va đập cơ khí bánh xe (Center, Left limit, Right limit) và lưu cấu hình xuống `steer_motor_node`.
4. **Điều khiển dàn cày (Depth Panel)**: Thao tác chọn chế độ (AUTO / MANUAL / HOME) và đặt độ sâu mục tiêu, giao tiếp qua ROS Topic trung gian `/ui/depth_command` tới `depth_ui_node` và module không dây ESP-NOW.
5. **Cửa sổ chẩn đoán kỹ sư (Engineer Settings)**: Khóa bằng mã PIN, cho phép đọc/ghi trực tiếp ROS 2 Parameters và xem log thô của từng Topic mà không cần mở terminal Linux.

---

## 2. Đặc điểm triển khai kỹ thuật (Source Code Reality)

1. **Kiến trúc mã nguồn nguyên khối (Monolithic Single File)**:
   - Toàn bộ giao diện người dùng hiện được tập hợp trong **một file duy nhất**: [`index.html`](file:///home/long/agent_tractor/TractorUI/index.html) (~5,088 dòng).
   - Bao gồm toàn bộ cấu trúc DOM, CSS inline/embedded, logic khởi tạo ROSLIB, tính toán hình học bản đồ, xử lý âm thanh Web Audio và máy trạng thái.
2. **Cơ chế giao tiếp ROSBridge WebSocket**:
   - `index.html` sử dụng `ROSLIB.Ros` kết nối tới cổng WebSocket mặc định `9090`.
   - Tất cả các Topic và Service đều được gọi thông qua các hàm tiện ích bọc sẵn (`subscribeToTopic`, `callService`, `setupHoldButton`).
3. **Cơ chế chống chạm nhầm (Hold-to-Confirm / Long-press)**:
   - Trên môi trường máy kéo rung lắc, các thao tác nhạy cảm (ghi góc ruộng, tạo lộ trình, chốt đường thẳng AB, kích hoạt độ sâu) bắt buộc phải **nhấn giữ 500 ms – 1000 ms** (`setupHoldButton`).
4. **Cơ chế xoay bản đồ đa chế độ (Map Rotation Engine)**:
   - `H-UP` (Heading-Up): Đầu xe luôn hướng thẳng đứng lên trên màn hình.
   - `P-UP` (Path-Up): Hướng theo phương của đường tham chiếu AB đang bám.
   - `N-UP` (North-Up): Bản đồ giữ cố định hướng Bắc truyền thống.
   - Đi kèm thuật toán chống giật góc xoay (`getContinuousAngle`) tránh tình trạng bản đồ xoay vòng 360° khi góc quét nhảy qua ranh giới $-\pi \leftrightarrow +\pi$.
