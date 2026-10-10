# TractorUI - AI Agent Onboarding Guide

Tài liệu này là cẩm nang định hướng dành riêng cho các AI Agent (Copilot, Claude Code, Gemini, Cursor) và kỹ sư phần mềm mới tiếp quản dự án `TractorUI`.

---

## 1. Thứ tự Đọc Tài liệu Khuyên nghị (Reading Order)

Để hiểu sâu hệ thống trong thời gian ngắn nhất mà không làm quá tải ngữ cảnh (Context Window), AI Agent nên đọc các tài liệu theo thứ tự sau:

1. [`PROJECT_CONTEXT.md`](file:///home/long/agent_tractor/TractorUI/PROJECT_CONTEXT.md): Nắm được vai trò HMI, triết lý thiết kế buồng lái và các ràng buộc vật lý máy cày.
2. [`UI_ARCHITECTURE.md`](file:///home/long/agent_tractor/TractorUI/UI_ARCHITECTURE.md): Xem sơ đồ luồng dữ liệu giữa UI, rosbridge và ROS 2 Nodes.
3. [`UI_STATE_MACHINE.md`](file:///home/long/agent_tractor/TractorUI/UI_STATE_MACHINE.md): Hiểu rõ các máy trạng thái FSM (AB-Line, Path Follower, Depth Control, Steering Calib).
4. [`ROS_TOPICS.md`](file:///home/long/agent_tractor/TractorUI/ROS_TOPICS.md): Tra cứu danh mục toàn bộ topic, service và message type trước khi sửa logic ROS.
5. [`COMPONENTS.md`](file:///home/long/agent_tractor/TractorUI/COMPONENTS.md) & [`PAGE_STRUCTURE.md`](file:///home/long/agent_tractor/TractorUI/PAGE_STRUCTURE.md): Tra cứu DOM tree, widget UI cụ thể cần can thiệp.
6. [`CURRENT_STATUS.md`](file:///home/long/agent_tractor/TractorUI/CURRENT_STATUS.md): Kiểm tra hiện trạng hoàn thiện trước khi đề xuất tính năng mới.

---

## 2. Vị trí File Nguồn Quan trọng

* Toàn bộ mã nguồn UI hiện nằm tại:
  * [`index.html`](file:///home/long/agent_tractor/TractorUI/index.html) (~5,088 dòng)
* Các vùng mã nguồn chính trong `index.html`:
  * **Dòng 1 - 40**: Head, nạp thư viện ngoài (Leaflet, Roslib.js, Chart.js).
  * **Dòng 41 - 1300**: CSS styling (Dark mode nông nghiệp, HUD widgets, Touch-optimized controls, iOS wheel picker).
  * **Dòng 1301 - 2100**: Cấu trúc HTML DOM (Splash canvas, Cockpit, Map, Top Bar, Controls, Modals).
  * **Dòng 2101 - 3360**: Khởi tạo biến toàn cục, cấu hình toạ độ bản đồ, hệ số chuyển đổi, Leaflet map setup.
  * **Dòng 3361 - 3750**: Tầng mạng WebSocket, ROS connection lifecycle, Subscribers telemetry, RTK fix handler.
  * **Dòng 3751 - 4250**: Logic dẫn đường AB-Line, Field Path Follower bridge, TTS giọng nói tiếng Việt.
  * **Dòng 4251 - 4600**: Điều khiển nông cụ nâng hạ (Depth Controller), Hold-to-confirm timer.
  * **Dòng 4601 - 5088**: Tab Kỹ sư, Parameter Explorer, Steering Limit Wizard, Live Chart, Topic Inspector.

---

## 3. Các Vùng Cấm / Không Tự Ý Sửa Đổi (Do Not Touch Without Alignment)

Khi thực hiện refactoring hoặc fix bug, AI Agent **TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI** các logic sau:

1. **Cơ chế An toàn Hold-to-Confirm của Nông cụ (`#depth-activate-btn`)**:
   * *Nguyên nhân*: Cơ cấu ben thuỷ lực rất nguy hiểm. Trên máy cày rung xóc, việc nhả nút bắt buộc giữ 1000ms là tính năng an toàn vật lý chống quẹt nhầm. Không được đơn giản hoá thành click thông thường!
2. **Logic Xoay Bản đồ CSS (`head-up` mode)**:
   * *Nguyên nhân*: Leaflet không hỗ trợ xoay vector bản đồ gốc; hệ thống sử dụng CSS transform xoay container quanh tâm toạ độ xe kết hợp chuyển đổi góc bù trừ icon xe. Thay đổi không cẩn thận sẽ làm lệch hướng la bàn và toạ độ click.
3. **Quy ước Tần số & Tiết lưu (Throttling) của ROS Subscribers**:
   * *Nguyên nhân*: Các topic telemetry (`/vehicle_telemetry`, `/steering_state`, `/fix_velocity`) bắn về với tần số 10Hz - 20Hz. Đã có bộ lọc hạn chế DOM re-render để tránh làm đơ trình duyệt máy tính nhúng Raspberry Pi 5.
4. **Kiểu Dữ liệu ROS Messages**:
   * *Nguyên nhân*: Các message type (như `std_msgs/Int32`, `std_msgs/Bool`, `nav_msgs/Path`) phải khớp 100% với định nghĩa C++/Python của các node ROS 2 trên Raspi 5. Không được tự ý đổi tên trường payload.

---

## 4. Các Bẫy Thường Gặp (Common Pitfalls)

| Bẫy gặp phải | Nguyên nhân & Cách xử lý |
| :--- | :--- |
| **Bản đồ không hiện khi mở file local (`file:///...`)** | Một số trình duyệt chặn nạp icon tile hoặc Web Worker khi dùng giao thức `file://`. Khuyến nghị chạy qua web server mini (`python3 -m http.server 8000` hoặc Nginx). |
| **Lỗi kết nối WebSocket rosbridge** | Mặc định kết nối tới `ws://localhost:9090`. Khi máy cày chạy thực địa, IP phải là IP Wi-Fi/Ethernet của Raspberry Pi (vd: `ws://192.168.1.50:9090`). Cần kiểm tra Modal Settings để đổi IP. |
| **Lệch toạ độ GPS khi vẽ Polyline** | Hệ toạ độ GNSS trả về toạ độ `WGS84` (`[latitude, longitude]`), trong khi ROS 2 `geometry_msgs/Point` thường biểu diễn theo trục toạ độ phẳng địa phương `UTM` (`[x, y, z]`). Chú ý hàm chuyển đổi toạ độ trong mã nguồn! |
| **Không nhận diện được giọng nói TTS** | Web Speech API trên một số trình duyệt Linux nhúng yêu cầu cài đặt gói giọng đọc tiếng Việt (`espeak-ng` hoặc Google Chrome TTS engine). Kiểm tra `speechSynthesis.getVoices()` trước khi gọi phát âm thanh. |

---

## 5. Đề Xuất Tái Cấu Trúc (Refactoring Proposal) Cho Tương Lai

Hiện tại `index.html` đã vượt quá 5,000 dòng. Khi dự án phát triển tiếp, cấu trúc thư mục UI module hoá tối ưu được khuyến nghị như sau:

```
TractorUI/
├── index.html                   # HTML Shell mỏng nhẹ (chỉ chứa thẻ nạp script)
├── css/
│   ├── base.css                 # Reset, biến màu sắc, typography
│   ├── layout.css               # Phân bố khung HUD, Cockpit, Canvas
│   ├── components.css           # Styling chi tiết các widget, nút bấm, drawer
│   └── modals.css               # Styling các cửa sổ pop-up, wheel picker
├── js/
│   ├── app.js                   # Điểm khởi đầu (Entry point), quản lý vòng đời SPA
│   ├── config.js                # Cấu hình IP rosbridge, hằng số toạ độ mặc định
│   ├── core/
│   │   ├── ros_service.js       # Quản lý WebSocket roslib.js, tự reconnect, throttle
│   │   ├── state_manager.js     # Quản lý trạng thái FSM tập trung (Single Source of Truth)
│   │   └── speech_service.js    # Tiện ích phát âm thanh hướng dẫn TTS
│   ├── map/
│   │   ├── map_controller.js    # Quản lý Leaflet layer, Head-up vs North-up rotation
│   │   ├── tractor_layer.js     # Marker xe cày, tính góc heading, vẽ trail
│   │   └── path_layer.js        # Vẽ lộ trình cày AB-Line và Field Path
│   └── components/
│       ├── top_bar.js           # Widget cập nhật telemetry và RTK badge
│       ├── control_stack.js     # Cụm nút bấm chế độ, record line, nudge
│       ├── depth_drawer.js      # Bảng điều khiển nông cụ nâng hạ, timer hold-to-confirm
│       ├── engineer_modal.js    # Bộ chẩn đoán, Parameter explorer, Topic inspector
│       └── swath_picker.js      # Con lăn chọn kích thước nông cụ kiểu iOS
└── assets/
    ├── icons/                   # Icon SVG máy kéo, la bàn, vệ tinh
    └── sounds/                  # Âm thanh cảnh báo (bíp bíp khi mất RTK)
```

> [!TIP]
> Việc module hóa theo cấu trúc trên có thể giữ nguyên mã nguồn JavaScript Vanilla (sử dụng ES6 Modules native: `<script type="module" src="js/app.js">`) mà không cần cài đặt Node.js hay công cụ đóng gói Webpack/Vite phức tạp, đảm bảo độ gọn nhẹ tuyệt đối cho hệ thống nhúng Raspberry Pi 5.
