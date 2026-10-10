# TractorUI - Kiến trúc Tổng thể & Luồng Dữ liệu (UI Architecture)

Tài liệu mô tả kiến trúc phân lớp, luồng dữ liệu hai chiều giữa `TractorUI` và các hệ thống con ROS 2 trên máy tính nhúng Raspberry Pi 5.

---

## 1. Sơ đồ Kiến trúc Luồng Dữ liệu (Mermaid)

```mermaid
flowchart TD
    subgraph BROWSER["TractorUI (Trình duyệt Web / Tablet)"]
        UI_MAIN["Giao diện chính (Leaflet Map & HUD)"]
        PANEL_DEPTH["Bảng điều khiển độ sâu (Depth Panel)"]
        PANEL_GUIDE["Bảng điều khiển dẫn đường (Top Controls)"]
        MODAL_ENG["Cửa sổ Kỹ sư (Engineer / Calibration)"]
        ROSLIB_CLIENT["ROSLIB.js WebSocket Client"]
    end

    subgraph ROSBRIDGE["rosbridge_suite (Port 9090)"]
        WS_SERVER["rosbridge_websocket Node"]
    end

    subgraph ROS2_CORE["Hệ sinh thái ROS 2 (Raspberry Pi 5)"]
        subgraph LOCALIZATION["Phân hệ Định vị"]
            FUSER["rtk_utm_fuser"]
            GPS_NODE["f9r_driver_python"]
            IMU_NODE["agm720_node"]
        end

        subgraph GUIDANCE["Phân hệ Dẫn đường & Lái"]
            MUX["target_line_mux"]
            AB_PLANNER["steer_planner_node"]
            AUTONAV["field_planner_node (tractor_autonav)"]
            BRIDGE_FOLLOWER["path_follower_bridge"]
            STEER_PID["steer_dual_pid"]
            STEER_MOTOR["steer_motor_node"]
        end

        subgraph DEPTH_SYSTEM["Phân hệ Điều khiển Độ sâu"]
            DEPTH_UI_NODE["depth_ui_node (Command Arbiter)"]
            ESPNOW_BRIDGE["espnow_bridge_node"]
        end
    end

    subgraph HARDWARE_EXTERNAL["Thiết bị Ngoại vi & Không dây"]
        CAN_MOTOR["Motor lái MyActuator X4-36 (SocketCAN can0)"]
        NANO_ESP32["Arduino Nano ESP32 (Master Relay)"]
        GATEWAY_CABIN["ESP32 Cabin Gateway (Panel & LCD)"]
        DEPTH_BOARD["ESP32 Implement Controller (DepthStableV4_2)"]
    end

    %% Tương tác UI nội bộ
    UI_MAIN <--> ROSLIB_CLIENT
    PANEL_DEPTH <--> ROSLIB_CLIENT
    PANEL_GUIDE <--> ROSLIB_CLIENT
    MODAL_ENG <--> ROSLIB_CLIENT

    %% Tương tác qua WebSocket
    ROSLIB_CLIENT <-->|JSON-RPC ws://:9090| WS_SERVER

    %% Luồng Định vị -> UI
    FUSER -->|/odometry/global & /map_origin| WS_SERVER
    GPS_NODE -->|/f9r/num_sv & /f9r/rtk_status & /f9r/speed| WS_SERVER
    IMU_NODE -->|/imu| WS_SERVER

    %% Luồng Dẫn đường & Lái
    ROSLIB_CLIENT -->|/target_line_mux/select_mode| MUX
    ROSLIB_CLIENT -->|Service: swath_left, swath_right, rotate| AB_PLANNER
    ROSLIB_CLIENT -->|Service: /record_vertex, /generate_path, /clear_all| AUTONAV
    ROSLIB_CLIENT -->|Service: /path_follower_bridge/start_stop, resume| BRIDGE_FOLLOWER
    AB_PLANNER -->|/reference_line & /steer_planner_node/state_machine| WS_SERVER
    AUTONAV -->|/field_boundary & /planned_path & /path_endpoints| WS_SERVER
    BRIDGE_FOLLOWER -->|/path_follower_bridge/state| WS_SERVER
    STEER_PID -->|/steering_command| WS_SERVER
    STEER_MOTOR -->|/steering_angle_actual & /steer_motor_node/*| WS_SERVER

    %% Luồng Steering Jog & Calibration từ Kỹ sư
    ROSLIB_CLIENT -->|/steer_motor_node/jog_rate| STEER_MOTOR
    ROSLIB_CLIENT -->|Service: /steer_motor_node/calibrate, capture_left...| STEER_MOTOR
    STEER_MOTOR <-->|SocketCAN 1Mbps| CAN_MOTOR

    %% Luồng Độ sâu
    ROSLIB_CLIENT -->|/ui/depth_command| DEPTH_UI_NODE
    DEPTH_UI_NODE -->|/ui/depth_command_ack| WS_SERVER
    DEPTH_UI_NODE -->|/depth_link/mode, target_cm, enable| ESPNOW_BRIDGE
    ESPNOW_BRIDGE -->|/depth_link/status & /espnow_link/stats| WS_SERVER
    ESPNOW_BRIDGE <-->|USB CDC| NANO_ESP32
    NANO_ESP32 <-->|ESP-NOW 2.4GHz| GATEWAY_CABIN
    GATEWAY_CABIN <-->|UART2 250k baud| DEPTH_BOARD
```

---

## 2. Chi tiết các luồng dữ liệu

### 2.1 Luồng Hiển thị Bản đồ & Telemetry Xe
1. Node [`rtk_utm_fuser`](file:///home/long/agent_tractor/tracktor_ws/src/tractor_localization/tractor_localization/rtk_utm_fuser.py) phát độ dịch chuyển thực tế của máy kéo lên `/odometry/global` và tọa độ gốc Datum lên `/map_origin`.
2. Trình duyệt nhận tin tại hàm callback `subscribeToTopic('/odometry/global')`:
   - Tính toán chuyển đổi từ tọa độ Odometry địa phương sang vĩ độ/kinh độ GPS toàn cầu dựa vào tọa độ mốc `mapOriginLat/Lon` (nguồn: `index.html` dòng 4410-4494).
   - Chuyển Quaternion sang góc Euler Yaw của xe (`tractorMathYaw`).
   - Cập nhật vị trí Marker biểu tượng máy kéo trên bản đồ Leaflet.
   - Ghi lại các điểm đã đi qua thành vệt bánh xe màu xanh (swath breadcrumbs `trailLayer`).

### 2.2 Luồng Dẫn đường AB-Line (Record Line Pipeline)
1. Người dùng chọn chế độ bám đường thẳng (`currentControlMode = 'record'`). UI gửi lệnh chọn chế độ mux: `/target_line_mux/select_mode = 1` (`index.html` dòng 2050).
2. Khi người dùng nhấn giữ nút **Record Line** (500 ms), UI gọi service `/steer_planner_node/toggle_line_recording`.
3. Node [`steer_planner_node`](file:///home/long/agent_tractor/tracktor_ws/src/tractor_steer_controller/src/steer_planner_node.cpp) phát trạng thái máy FSM về `/steer_planner_node/state_machine`. UI tự động đổi màu nút sang vàng (Đang ghi) rồi xanh lá (Đang bám tự động).
4. Đường tham chiếu được nhận qua topic `/reference_line` (`nav_msgs/Path`), được UI vẽ đè lên bản đồ vệ tinh (`referencePathLayer`) và đồng bộ góc xoay bản đồ (`P-UP` mode).

### 2.3 Luồng Tạo lộ trình ruộng tự động (Field Path Pipeline)
1. Người dùng chọn chế độ tạo lộ trình (`currentControlMode = 'path'`). UI gửi lệnh mux: `/target_line_mux/select_mode = 2` (`index.html` dòng 2060).
2. Người dùng nhấn giữ các nút:
   - **Thêm đỉnh ranh giới**: gọi service `/record_vertex`.
   - **Tạo đường cày (Generate Path)**: gọi service `/generate_path`.
   - **Xóa toàn bộ (Clear All)**: gọi service `/clear_all`.
3. UI lắng nghe các topic trực quan hóa từ `tractor_autonav`:
   - `/field_boundary` (`geometry_msgs/PolygonStamped`): Đường viền thửa ruộng màu xanh ngọc.
   - `/planned_path` (`nav_msgs/Path`): Lộ trình cày ngoằn ngoèo phủ kín lòng ruộng.
   - `/path_endpoints` (`visualization_msgs/MarkerArray`): Đánh dấu vị trí đầu luống/cuối luống.
4. Điều khiển bám lộ trình: Nút **Start / Stop** gọi service `/path_follower_bridge/start_stop` (hoặc `/path_follower_bridge/resume` nếu đang tạm dừng).

### 2.4 Luồng Điều khiển Độ sâu Dàn cày (Implement Depth Pipeline)
1. Người vận hành lựa chọn chế độ trên Depth Panel:
   - `AUTO` (Mode 0): Đặt chiều sâu mục tiêu (50 - 150 mm).
   - `MANUAL` (Mode 1): Đặt góc tay nâng mục tiêu (0 - 35°).
   - `HOME` (Mode 2): Nhấc toàn bộ dàn cày lên vị trí di chuyển an toàn.
2. Để tránh vô tình thay đổi độ sâu khi rung xóc, nút **ACTIVATE** bắt buộc phải **nhấn giữ 1000 ms** để nhả/ngắt (Deactivate), hoặc ấn 1 chạm để kích hoạt.
3. Lệnh được publish vào `/ui/depth_command` (`tractor_espnow_bridge/msg/DepthUiCommand`) với cờ `enable` (`index.html` dòng 3897-3906).
4. Node `depth_ui_node` điều phối gửi tuần tự các topic `/depth_link/mode`, `/depth_link/target_cm`, `/depth_link/enable` tới `espnow_bridge_node`.
5. Phản hồi thời gian thực từ dàn cày (độ sâu thực tế, góc tay nâng, góc đuôi cày, cờ mất kết nối, cảnh báo chiếm quyền cabin) được trả về qua topic `/depth_link/status` và vẽ trực tiếp lên thanh đo `depth-gauge-actual`.
