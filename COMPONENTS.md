# TractorUI - UI Components & Widgets Catalog

Tài liệu này liệt kê chi tiết toàn bộ các thành phần giao diện (UI Components, Custom Widgets, Controls, Modals) hiện diện trong `TractorUI/index.html`, mô tả Input dữ liệu, Output sự kiện, và liên kết tương tác với tầng truyền thông ROS 2.

---

## 1. Danh mục Thành phần Giao diện (Component Matrix)

| Tên Component | DOM Selector / Identifier | Vai trò chính | Tương tác ROS 2 |
| :--- | :--- | :--- | :--- |
| **Splash Canvas** | `#splash-canvas` | Hoạt họa xe cày tự động khi chưa kết nối | Không có (Canvas 2D độc lập) |
| **Top Status Bar** | `#top-bar` | Hiển thị GNSS fix, RTK, speed, heading, roll/pitch | Subscribes 8 Topics telemetry |
| **Compass Control** | `#compass-btn` | Hiển thị la bàn & chuyển chế độ xoay bản đồ | Nhận heading từ IMU/GNSS |
| **Record AB Button** | `#record-line-btn` | Điều khiển ghi nhận đường thẳng AB | Pub `/steer_planner_node/trigger_record` |
| **Control Mode Switch** | `#mode-switch-btn` | Chuyển đổi giữa AB-Line và Field Path | Pub `/target_line_mux/select_mode` |
| **Swath Nudge Steppers** | `.swath-nudge-btn` | Dịch luống cày sang trái / phải từng bước | Service `/steer_planner_node/shift_line` |
| **Path Action Controls** | `#path-action-btns` | Bắt đầu, tạm dừng hoặc khôi phục chạy lộ trình | Service `/path_follower_bridge/start_stop` |
| **Hold-to-Confirm Button**| `.hold-btn`, `#depth-activate-btn` | Nút bấm an toàn: Chạm để bật, giữ 1s để tắt | Pub `/ui/depth_command` |
| **Depth Gauge Visualizer** | `#depth-gauge-container` | Thước đo đồ họa độ sâu và góc nâng nông cụ | Sub `/depth_link/status` |
| **iOS Wheel Picker** | `#swath-picker-modal` | Bánh xe cuộn chọn bề rộng nông cụ kiểu iOS | Cập nhật tham số swath local & ROS |
| **Steering Calib Wizard**| `#calib-wizard-container` | Trình hướng dẫn 4 bước gán giới hạn góc lái | Service `/steer_motor_node/*` (calibrate, limits) |
| **Telemetry Chart** | `#steering-chart` | Đồ thị so sánh góc lái mong muốn vs thực tế | Sub `/vehicle_telemetry`, `/steering_state` |
| **ROS Parameter Explorer** | `#param-explorer-pane` | Đọc/Ghi tham số trực tiếp xuống ROS nodes | Services `list/get/set_parameters` |
| **Topic Echo Inspector** | `#topic-explorer-pane` | Soi gói tin JSON thô của bất kỳ topic nào | Sub topic động thông qua rosbridge |

---

## 2. Chi tiết từng Component

### 2.1. Top Status Bar (`#top-bar`)
* **Vị trí**: Cố định đỉnh màn hình cockpit (`index.html#L64-L140`).
* **Input**:
  * Topic `/fix`: Vĩ độ, kinh độ, trạng thái vệ tinh.
  * Topic `/rtk_status`: Cờ fix (`FIX`, `FLOAT`, `SINGLE`), số vệ tinh sử dụng.
  * Topic `/fix_velocity`: Tốc độ di chuyển thực tế (m/s đổi sang km/h).
  * Topic `/imu/data`: Góc nghiêng xe (Roll, Pitch).
  * Topic `/steer_planner_node/cross_track_error`: Sai số khoảng cách tim đường (m đổi sang cm).
* **Output**: Cập nhật giá trị hiển thị thời gian thực vào các thẻ `.hud-value`, đổi màu badge RTK:
  * Xanh lá (`#00e676`): RTK Fixed.
  * Vàng cam (`#ffab00`): RTK Float.
  * Đỏ (`#ff5252`): No Fix / Single.

---

### 2.2. Compass Control (`#compass-btn`)
* **Vị trí**: Góc trên bên phải bản đồ (`index.html#L218-L225`).
* **Input**: Góc `heading` từ máy kéo (độ).
* **Output**:
  * Xoay kim la bàn CSS `transform: rotate(-heading deg)`.
  * Sự kiện `click`: Đổi chế độ hiển thị bản đồ giữa:
    * `NORTH_UP`: Bản đồ đứng yên, icon xe xoay.
    * `HEAD_UP`: Icon xe luôn hướng lên trên màn hình, toàn bộ Leaflet Map Container xoay tương ứng bằng CSS transform.

---

### 2.3. Record AB Button (`#record-line-btn`)
* **Vị trí**: Trung tâm điều khiển bên trái (`index.html#L160-L175`).
* **Input**: State nhận từ `/steer_planner_node/state_machine` (1: IDLE, 2: RECORDING, 3: ACTIVE).
* **Output / Sự kiện Click**:
  * Khi State = 1 (IDLE): Gửi `std_msgs/Bool` (`true`) tới topic `/steer_planner_node/trigger_record` để bắt đầu ghi điểm A.
  * Khi State = 2 (RECORDING): Gửi trigger tiếp theo để chốt điểm B.
  * Khi State = 3 (ACTIVE): Hiển thị nút "Hủy dẫn đường", nhấn để reset về IDLE.
* **Hiệu ứng đặc biệt**: Tích hợp âm thanh TTS thông báo bằng giọng đọc tiếng Việt qua hàm `speakNotification()` (`index.html#L3810`).

---

### 2.4. Swath Nudge Steppers (`.swath-nudge-btn`)
* **Vị trí**: Dưới nút Record Line (`index.html#L180-L205`).
* **Input**: Trạng thái dẫn đường (chỉ kích hoạt khi đang ở State 3 - ACTIVE).
* **Output / Sự kiện Click**:
  * Nút `Shift Left`: Gọi ROS Service `/steer_planner_node/shift_line` với tham số `offset: -0.05` (hoặc `-0.1m`).
  * Nút `Shift Right`: Gọi ROS Service với tham số `offset: +0.05` (hoặc `+0.1m`).
  * Nút `Reset`: Đưa offset về `0.0m`.
* **Mục đích thực tế**: Giúp tài xế điều chỉnh xe né chướng ngại vật cục bộ trên ruộng hoặc bù trừ vết đất lún mà không cần vẽ lại đường chuẩn.

---

### 2.5. Hold-to-Confirm Button (`.hold-btn`, `#depth-activate-btn`)
* **Vị trí**: Bảng điều khiển nông cụ `#depth-drawer` (`index.html#L340-L365`).
* **Triết lý thiết kế UX an toàn**: Trong cabin máy cày rung lắc dữ dội, thao tác ngắt khẩn cấp nông cụ nếu chỉ là 1 cú chạm có thể bị kích hoạt nhầm bởi rung chấn ngón tay hoặc quẹt áo.
* **Cơ chế hoạt động**:
  * **Trạng thái TẮT -> BẬT**: Chạm 1 lần (Tap) -> Kích hoạt ngay lập tức.
  * **Trạng thái BẬT -> TẮT**: Phải nhấn đè (Hold) liên tục trong 1000ms.
  * **Visual Feedback**: Vòng tròn SVG viền xung quanh nút sẽ chạy hiệu ứng điền đầy (Circular Progress SVG) trong 1 giây. Nếu nhả tay trước 1 giây -> Huỷ lệnh.

---

### 2.6. iOS Wheel Picker (`#swath-picker-modal`)
* **Vị trí**: Modal độc lập (`index.html#L590-L630`).
* **Công nghệ**: Custom 3D CSS transform mô phỏng con lăn hình trụ kiểu iOS Wheel.
* **Chức năng**: Chọn độ rộng nông cụ (từ 0.50m đến 4.00m, bước nhảy 0.05m).
* **Input**: Giá trị swath hiện tại.
* **Output**: Cập nhật biến toàn cục `currentSwathWidth` và gửi service/param cập nhật xuống `/steer_planner_node`.

---

### 2.7. Live Telemetry Chart (`#steering-chart`)
* **Vị trí**: Tab Kỹ sư trong Modal Cài đặt (`index.html#L520-L545`).
* **Công nghệ**: `Chart.js` v3.x.
* **Input**:
  * Trục thời gian thực (Time window: 30 giây gần nhất).
  * Line 1 (Màu xanh dương): Target Steering Angle (Góc lái mục tiêu do thuật toán Pure Pursuit / MPC tính ra).
  * Line 2 (Màu xanh lá): Actual Steering Angle (Góc lái thực tế đọc từ cảm biến bẻ lái bánh xe).
* **Chức năng**: Cho phép kỹ sư đánh giá tức thời độ trễ đáp ứng (Response Delay) và sai số bám góc (Tracking Error) của bộ điều khiển động cơ lái.

---

### 2.8. ROS Parameter Explorer (`#param-explorer-pane`)
* **Vị trí**: Tab Chẩn đoán Kỹ sư (`index.html#L480-L515`).
* **Input**: Danh sách các Node nhận từ service `rosapi/nodes`.
* **Hành vi**:
  1. Khi người dùng chọn một Node -> Gọi `rosapi/get_param_names` tương ứng.
  2. Bảng hiển thị: Tên tham số, Kiểu dữ liệu (Float, Int, String, Bool), Giá trị hiện hành.
  3. Cho phép gõ giá trị mới và nhấn "Set" -> Gửi request tới service `rosapi/set_param`.
