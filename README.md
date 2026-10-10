# TractorUI - Web Cockpit & Telemetry Interface

Giao diện điều khiển Web Cockpit dành cho hệ thống máy kéo tự động **Smart Tractor**, cung cấp khả năng trực quan hóa bản đồ vệ tinh thời gian thực, điều khiển bẻ lái tự động, vẽ đường AB-line, tạo đường bao thửa ruộng (Headland/Swaths), hiệu chỉnh giới hạn cơ khí motor lái và kiểm soát độ sâu dàn cày (Implement Depth).

---

## 1. Giới thiệu tổng quan

`TractorUI` là một Single Page Application (SPA) dạng nhúng, độc lập (không cần Node.js build step), kết nối trực tiếp đến hệ thống ROS 2 trên Raspberry Pi 5 thông qua giao thức WebSocket của `rosbridge_server`.

Các tính năng chính:
- **Bản đồ vệ tinh & Trực quan hóa GPS RTK**: Bản đồ Leaflet.js xoay theo hướng xe (Heading-Up / North-Up / Path-Up), hiển thị vệt bánh xe (swath breadcrumbs) và ranh giới thửa ruộng.
- **Dẫn đường AB-Line & Lập lộ trình (Path Planning)**: Hỗ trợ ghi vết đường thẳng tham chiếu, dịch luống (swath left/right), xoay góc tham chiếu, và tạo lộ trình phủ kín thửa ruộng (kết nối `tractor_autonav` / Fields2Cover).
- **Điều khiển độ sâu dàn cày (Depth Panel)**: Điều khiển chế độ AUTO (độ sâu cm), MANUAL (góc tay nâng độ), HOME (nâng an toàn), hiển thị thanh đo trực quan và hỗ trợ cơ chế bấm-giữ kích hoạt (long-press 1s).
- **Steering Limit Finder (Cân chỉnh góc lái)**: Cho phép kỹ sư jog motor chậm ở moment xoắn thấp để dò cữ cơ khí, lưu các điểm giới hạn Center, Left, Right xuống node điều khiển `steer_motor_node`.
- **ROS 2 Explorer**: Tích hợp công cụ xem/sửa ROS Parameter theo thời gian thực và xem dữ liệu thô (Echo) các Topic ROS 2.
- **Đa ngôn ngữ & Giọng nói (TTS)**: Hỗ trợ tiếng Việt, tiếng Anh, tiếng Trung và phát âm thanh thông báo trạng thái vận hành.

---

## 2. Công nghệ sử dụng

- **HTML5 & CSS3**: Giao diện thiết kế theo chuẩn Dark Theme hiện đại, tối ưu cho màn hình cảm ứng gắn trên cabin máy kéo và máy tính bảng.
- **Tailwind CSS**: `tailwind.min.css` biên dịch sẵn phục vụ styling responsive.
- **Leaflet.js**: `leaflet.js` & `leaflet.css` xử lý hiển thị bản đồ bản địa, lớp vệ tinh Esri World Imagery, xoay bản đồ liên tục (`CSS transform`).
- **ROSLIB.js**: `roslib.min.js` & `eventemitter2.min.js` giao tiếp JSON-RPC hai chiều qua WebSocket với `rosbridge_websocket` (cổng 9090).
- **Chart.js**: `chart.js` vẽ đồ thị telemetry góc lái và góc Yaw trực tiếp.
- **HTML5 Canvas 2D**: Mô phỏng hoạt họa dẫn đường 2D ở màn hình Splash Screen (`viewOutCanvas`, `viewInCanvas`).

---

## 3. Cách chạy dự án

Do `TractorUI` là ứng dụng web tĩnh thuần túy, bạn chỉ cần một HTTP web server đơn giản để phục vụ file:

### Cách 1: Chạy chung qua script hệ thống (Khuyên dùng)
```bash
cd /home/long/agent_tractor
./start_all_v1.sh
```
Script sẽ tự động khởi động Python HTTP Server ở cổng **8000** và chạy kèm hệ thống ROS 2.

### Cách 2: Chạy độc lập Web Server
```bash
cd /home/long/agent_tractor/TractorUI
python3 -m http.server 8000
```
Sau đó mở trình duyệt tại:
- Máy cục bộ: `http://localhost:8000`
- Thiết bị trên cùng mạng Wi-Fi: `http://<IP_RASPBERRY_PI>:8000`

> **Lưu ý về kết nối WebSocket ROSBridge**:
> Mặc định giao diện sẽ kết nối tới `ws://<HOSTNAME>:9090`. Nếu truy cập qua Cloudflare HTTPS Tunnel, giao diện tự động nhận diện và chuyển sang `wss://ws.<HOSTNAME>`.

---

## 4. Cấu trúc thư mục

```
TractorUI/
├── index.html               # Toàn bộ mã nguồn giao diện HTML, CSS inline và JavaScript ứng dụng (~5,088 dòng)
├── tailwind.min.css         # Thư viện CSS tiện ích Tailwind (phiên bản thu gọn)
├── leaflet.js               # Thư viện bản đồ Leaflet
├── leaflet.css              # Style của bản đồ Leaflet
├── roslib.min.js            # Thư viện client ROS 2 WebSocket (ROSLIB)
├── eventemitter2.min.js     # Thư viện xử lý sự kiện bất đồng bộ cho ROSLIB
├── chart.js                 # Thư viện vẽ biểu đồ thời gian thực
├── cbor.min.js              # Bộ giải mã nhị phân CBOR phục vụ nén dữ liệu ROS
├── images/                  # Chứa marker và icon bản đồ
│   ├── marker-icon.png
│   ├── marker-icon-2x.png
│   └── marker-shadow.png
└── [Tài liệu kiến trúc]    # Bộ tài liệu kỹ thuật dành cho AI Agent và nhà phát triển
    ├── README.md
    ├── PROJECT_CONTEXT.md
    ├── UI_ARCHITECTURE.md
    ├── ROS_TOPICS.md
    ├── UI_STATE_MACHINE.md
    ├── PAGE_STRUCTURE.md
    ├── COMPONENTS.md
    ├── CURRENT_STATUS.md
    └── AGENT_ONBOARDING.md
```
