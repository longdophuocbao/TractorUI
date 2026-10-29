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

UI sử dụng một design system dark modern industrial trong `theme-hmi.css`:
nút cao 48px, bo góc 10px, font 14px/600; panel bo góc 14px, khoảng cách 8/12/16px.
Bốn màu chức năng là Primary (xanh dương), Success (xanh lá), Warning (cam) và
Danger (đỏ). Segmented control dùng `aria-pressed`; trạng thái ghi/chạy của nút
dùng `data-ui-state` từ backend để thay nền, shadow và icon mà không đổi kích thước.
Icon thao tác dùng [Tabler Icons](https://github.com/tabler/tabler-icons), lưu local
trong `icons/ui-sprite.svg`, kèm giấy phép MIT tại `icons/TABLER-LICENSE.txt`.

Depth Control hiển thị Depth/Lift/Tail và một nút ACTIVATE/DEACTIVATE.
Giữ ACTIVATE 1 giây để chạy AUTO với độ sâu đã SET trong User Settings; giữ
DEACTIVATE 1 giây để gửi HOME và nâng dàn cày. Thả trước 1 giây hủy thao tác ở
cả hai chiều. HOME vẫn gửi `enable=true` để gateway thực thi
lệnh nâng. Nút chỉ hiện hoạt động khi telemetry xác nhận AUTO và streaming;
HOME hiện không hoạt động. Kết nối lại hoặc bộ điều khiển cabin tiếp quản không
tự phát lệnh thay đổi chế độ.

Trong **User Settings → Depth Settings**, bánh xe cuộn chọn mục tiêu AUTO từ
50–150 mm theo bước 5 mm rồi nhấn **SET**. Khối này nằm cạnh Swath Width và thay
thế hoàn toàn khối minh họa cũ. Giá trị dùng chung với bảng Depth; khi
đang hoạt động, UI chờ phản hồi xác nhận từ backend. Khi không hoạt động hoặc chưa
kết nối, SET lưu mục tiêu trên trình duyệt cho lần ACTIVATE tiếp theo.

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

Để xem và thử bố cục UI khi chưa chạy ROS, mở `http://localhost:8000/?preview=1`.
Chế độ này mở thẳng buồng lái, hiển thị trạng thái `UI Preview (Offline)` và không
tự kết nối ROSBridge. Có thể chuyển A-B Mode / Path Mode, mở bảng Depth và Cài đặt;
các lệnh điều khiển vẫn cần kết nối ROS thực tế.

### Chạy giao diện với dữ liệu ROS giả lập bằng Python

Cách ngắn nhất, chạy từ thư mục repository:

```bash
cd /home/long/agent_tractor
python3 run_tractor_ui.py
```

Giữ terminal này mở trong lúc sử dụng và nhấn `Ctrl+C` để dừng server.

Hoặc chạy server trực tiếp với đầy đủ tuỳ chọn:

```bash
cd /home/long/agent_tractor/TractorUI
python3 -m pip install -r requirements-sim.txt
python3 simulate_ros.py --host 0.0.0.0 --port 8000
```

Mở **http://localhost:8000/?sim=1** hoặc `http://<IP_MÁY_CHẠY_SERVER>:8000/?sim=1`
từ thiết bị cùng mạng. Không cần cài ROS hoặc chạy `start_all_v1.sh`.
Server phục vụ cả file giao diện và WebSocket `/rosbridge` trên cổng 8000;
UI tự kết nối và hiển thị nhãn **ROS SIMULATOR**.

Python phát 25 topic ở 10 Hz: GPS/RTK, vị trí và hướng xe, tốc độ, góc lái,
trạng thái motor, đường AB, ranh giới ruộng, đường cày mẫu và telemetry độ sâu.
Các thao tác ghi đường AB, dịch/xoay luống, lưu/nạp đường AB, ghi đỉnh ruộng,
tạo đường, chạy/dừng Path, cân chỉnh lái, đổi parameter và điều khiển độ sâu
có phản hồi trạng thái giả lập. Lưu AB và parameter chỉ tồn tại trong bộ nhớ;
đường cày và chuyển động xe là dữ liệu mẫu phục vụ thử giao diện, không mô phỏng
thuật toán bám đường hoặc động học máy kéo. Các tab cùng dùng chung trạng thái.
Simulator không kết nối ROS hoặc phần cứng; giữ nguyên thao tác nhấn giữ của UI.

Tuỳ chọn: `--hz 20`, `--speed 1.5` (m/s), `--rtk 'RTK Float'`,
`--latitude 22.644689 --longitude 120.357255`. Kiểm tra server tại
`http://localhost:8000/api/sim/status`. Dừng bằng `Ctrl+C`.

Chạy kiểm thử simulator: `python3 -m unittest discover -s tests -v`.
Mở URL không có `sim=1` vẫn sử dụng ROSBridge thật như trước.

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

### Soil height (`heightsoil`)

**Depth Settings** có thêm bánh xe **Soil height (mm)**: 0–50 mm, bước 1 mm,
ban đầu 40 mm. Nhấn SET dưới bánh xe này để gửi riêng cấu hình; không thay đổi
mode, độ sâu mục tiêu hoặc trạng thái ACTIVATE. Nút chỉ báo OK sau khi nhận lại
đúng giá trị từ bộ điều khiển độ sâu; thiếu xác nhận sau 3,5 giây thì báo ERR.
Giao diện giữ bản nháp khi đang chỉnh, và đồng bộ giá trị thực sau khi nhận lại
telemetry. Local storage chỉ lưu bản hiển thị gần nhất, không tự gửi lại khi mở web.
Giá trị thực được lưu bằng Preferences/NVS trên bo độ sâu, tồn tại sau mất điện.

Phải cập nhật TractorUI + ROS bridge và nạp lại cả **master, gateway, DepthStableV4_2**
để sử dụng. Firmware master/gateway nạp cho chức năng chẩn đoán reset trước đó
chưa có tính năng soil height này. Firmware cũ bỏ qua gói mới, giao diện sẽ báo ERR
thay vì báo OK giả.
