# TractorUI - Danh mục ROS 2 Topics & Services (ROS_TOPICS)

Toàn bộ các ROS Topics, Services và Parameter Services được mã nguồn [`TractorUI/index.html`](file:///home/long/agent_tractor/TractorUI/index.html) sử dụng thông qua client `ROSLIB.js`.

---

## 1. Danh sách ROS Topics được Subscribe (Đọc dữ liệu từ Robot lên UI)

| Topic Name | Message Type | Tần số / Throttle | Mục đích & Mô tả | Trích dẫn nguồn trong `index.html` |
|---|---|---|---|---|
| `/odometry/global` | `nav_msgs/msg/Odometry` | 100 ms | Tọa độ UTM và góc hướng Yaw của xe; dùng để cập nhật vị trí máy kéo trên bản đồ, tính góc xoay bản đồ và vẽ vệt bánh xe | Dòng 4410 |
| `/map_origin` | `sensor_msgs/msg/NavSatFix` | 100 ms | Tọa độ gốc Datum (Lat/Lon) dùng làm mốc chuyển đổi tọa độ địa phương sang GPS | Dòng 4759 |
| `/gps/fix` | `sensor_msgs/msg/NavSatFix` | 200 ms | Tọa độ WGS-84 thô và ma trận hiệp phương sai sai số độ chính xác (vẽ vòng tròn bán kính sai số xung quanh xe) | Dòng 4366 |
| `/f9r/num_sv` | `std_msgs/msg/Int32` | Mặc định | Số lượng vệ tinh GPS/GNSS đang bắt được | Dòng 4347 |
| `/f9r/rtk_status` | `std_msgs/msg/String` | Mặc định | Trạng thái giải pháp RTK ("RTK Fixed", "RTK Float", "No RTK") | Dòng 4349 |
| `/f9r/speed` | `std_msgs/msg/Float32` | Mặc định | Vận tốc di chuyển của xe trên mặt đất (m/s) | Dòng 4381 |
| `/imu` | `sensor_msgs/msg/Imu` | Mặc định | Dữ liệu gia tốc và vận tốc góc từ IMU | Dòng 4398 |
| `/steering_command` | `std_msgs/msg/Float64` | 100 ms | Góc bẻ lái mục tiêu do thuật toán Pure Pursuit phát ra | Dòng 4386 |
| `/steering_angle_actual` | `std_msgs/msg/Float64` | 100 ms | Góc bẻ lái thực tế từ cảm biến trục motor lái | Dòng 3816 |
| `/steer_motor_node/state` | `std_msgs/msg/Int32` | Mặc định | Trạng thái hoạt động của motor lái (0: Watchdog/Idle, 1: Active) | Dòng 4391 |
| `/steer_motor_node/iq` | `std_msgs/msg/Float64` | 200 ms | Dòng điện pha $I_q$ của motor lái (Amperes) | Dòng 3820 |
| `/steer_motor_node/calibrated` | `std_msgs/msg/Bool` | Mặc định | Cờ thông báo motor lái đã có thông số cân chỉnh cữ hợp lệ hay chưa | Dòng 3824 |
| `/steer_motor_node/fault` | `std_msgs/msg/Bool` | Mặc định | Cờ báo lỗi kẹt cơ khí / quá dòng motor lái | Dòng 3828 |
| `/steer_motor_node/calibration` | `std_msgs/msg/Float64MultiArray` | Mặc định | Mảng thông số cân chỉnh lái: `[center, left, right, step]` | Dòng 3834 |
| `/steer_planner_node/state_machine` | `std_msgs/Int32` | 100 ms | Trạng thái FSM của AB-line planner (1: IDLE, 2: RECORDING, 3: ACTIVE) | Dòng 3489 |
| `/reference_line` | `nav_msgs/msg/Path` | Mặc định | Danh sách tọa độ đường thẳng AB tham chiếu đang kích hoạt | Dòng 4580 |
| `/field_boundary` | `geometry_msgs/msg/PolygonStamped` | Mặc định | Đa giác đường bao ranh giới thửa ruộng đã ghi nhận | Dòng 4617 |
| `/planned_path` | `nav_msgs/msg/Path` | Mặc định | Đường lộ trình cày phủ kín thửa ruộng do `tractor_autonav` tính toán | L4634 |
| `/path_endpoints` | `visualization_msgs/msg/MarkerArray` | Mặc định | Đánh dấu các điểm đầu/cuối của từng luống cày | Dòng 4651 |
| `/path_follower_bridge/state` | `std_msgs/msg/Int32` | 100 ms | Trạng thái của bridge bám đường tự động (4: Running, 5: Error xa điểm đầu) | Dòng 4766 |
| `/field_planner/state` | `std_msgs/msg/Int32` | 100 ms | Trạng thái của planner tính toán đường cày (3: Sẵn sàng chạy) | Dòng 4775 |
| `/depth_link/status` | `tractor_espnow_bridge/msg/DepthLinkStatus` | Mặc định | Telemetry dàn cày: độ sâu cm, góc tay nâng, góc đuôi cày, cờ link_ok, cờ chiếm quyền | Dòng 4781 |
| `/espnow_link/stats` | `tractor_espnow_bridge/msg/EspNowLinkStats` | 500 ms | Thống kê kết nối không dây ESP-NOW: tỷ lệ rớt gói, thời gian sống, ping | Dòng 4846 |
| `/ui/depth_command_ack` | `tractor_espnow_bridge/msg/DepthUiCommand` | Mặc định | Phản hồi xác nhận lệnh độ sâu từ backend ROS 2 | Dòng 4848 |

---

## 2. Danh sách ROS Topics được Publish (Gửi lệnh từ UI xuống Robot)

| Topic Name | Message Type | Mục đích & Hành vi phát lệnh | Trích dẫn nguồn trong `index.html` |
|---|---|---|---|
| `/ui/depth_command` | `tractor_espnow_bridge/msg/DepthUiCommand` | Gửi lệnh đặt chế độ (mode), giá trị mục tiêu (target) và cờ kích hoạt (enable) cho dàn cày | Dòng 3849, 3901 |
| `/target_line_mux/select_mode` | `std_msgs/msg/Int32` | Chuyển nguồn đường dẫn điều khiển lái: `1` = AB Line (`steer_planner`), `2` = Field Path (`path_follower_bridge`) | Dòng 3616, 2050, 2060 |
| `/steering_command` | `std_msgs/msg/Float64` | Gửi lệnh góc lái trực tiếp (dùng khi thử nghiệm thủ công ở chế độ kỹ sư) | Dòng 3615, 3622 |
| `/steer_motor_node/jog_rate` | `std_msgs/msg/Float64` | Tốc độ jog motor (-1.0 đến +1.0) khi kéo thanh trượt Slider tìm cữ lái | Dòng 3651, 3690, 3694 |

---

## 3. Danh sách ROS Services được Gọi

| Service Name | Service Type | Mục đích sử dụng | Nơi gọi & Điều kiện kích hoạt |
|---|---|---|---|
| `/steer_planner_node/toggle_line_recording` | `std_srvs/srv/Empty` | Bật/tắt ghi nhận đường thẳng AB tham chiếu | Nút **Record Line** (Nhấn giữ 500 ms) - Dòng 2100 |
| `/steer_planner_node/swath_left` | `std_srvs/srv/Empty` | Dịch đường tham chiếu sang trái một khoảng bằng bề rộng luống (`swath_width`) | Nút **Swath Left** (Nhấn giữ 300 ms) - Dòng 5059 |
| `/steer_planner_node/swath_right` | `std_srvs/srv/Empty` | Dịch đường tham chiếu sang phải một khoảng bằng bề rộng luống (`swath_width`) | Nút **Swath Right** (Nhấn giữ 300 ms) - Dòng 5060 |
| `/steer_planner_node/rotate_ref_left` | `std_srvs/srv/Empty` | Xoay đường tham chiếu sang trái một góc cố định | Nút xoay trái trên Top Bar - Dòng 454 |
| `/steer_planner_node/rotate_ref_right` | `std_srvs/srv/Empty` | Xoay đường tham chiếu sang phải một góc cố định | Nút xoay phải trên Top Bar - Dòng 469 |
| `/record_vertex` | `std_srvs/srv/Empty` | Lưu tọa độ hiện tại làm 1 đỉnh ranh giới thửa ruộng | Nút **Add Vertex** (Nhấn giữ 500 ms) - Dòng 5052 |
| `/generate_path` | `std_srvs/srv/Empty` | Yêu cầu `tractor_autonav` tính toán đường cày phủ kín lòng ruộng | Nút **Generate Path** (Nhấn giữ 500 ms) - Dòng 5053 |
| `/clear_all` | `std_srvs/srv/Empty` | Xóa sạch ranh giới thửa ruộng và các đường lộ trình đã tạo | Nút **Thùng rác** (Nhấn giữ 500 ms) - Dòng 5057 |
| `/path_follower_bridge/start_stop` | `std_srvs/srv/SetBool` | Bật (`data: true`) hoặc dừng khẩn cấp (`data: false`) chế độ bám đường cày | Nút **Start / Stop Path** - Dòng 4875, 4908, 4922 |
| `/path_follower_bridge/resume` | `std_srvs/srv/Trigger` | Tiếp tục bám lại lộ trình sau khi đã tạm dừng | Nút **Start Path** khi có xác nhận Resume - Dòng 4893 |
| `/steer_motor_node/calibrate` | `std_srvs/srv/Trigger` | Thả lỏng motor và chốt góc tâm giữa bánh xe (Center) | Nút **1. Set Center** trong Engineer Modal - Dòng 3801 |
| `/steer_motor_node/capture_left_limit` | `std_srvs/srv/Trigger` | Khóa góc hiện tại làm giới hạn ngoặt hết lái sang Trái (Left limit) | Nút **2. Capture Left** - Dòng 3807 |
| `/steer_motor_node/capture_right_limit`| `std_srvs/srv/Trigger` | Khóa góc hiện tại làm giới hạn ngoặt hết lái sang Phải (Right limit) và lưu file | Nút **3. Capture Right & Save** - Dòng 3807 |
| `/steer_motor_node/cancel_calibration` | `std_srvs/srv/Trigger` | Hủy bỏ chu trình cân cữ cơ khí lái và trả về thông số cũ | Nút **Cancel** - Dòng 3812 |

---

## 4. Dịch vụ ROS 2 Parameters động (Parameter Explorer)

UI gọi trực tiếp các dịch vụ chuẩn `rcl_interfaces` để cho phép kỹ sư đọc/ghi cấu hình mọi Node đang chạy:

| Service Pattern | Type | Mục đích | Nguồn trong `index.html` |
|---|---|---|---|
| `<node_name>/list_parameters` | `rcl_interfaces/srv/ListParameters` | Lấy danh sách tên tất cả các tham số của node được chọn | Dòng 3236 |
| `<node_name>/get_parameters` | `rcl_interfaces/srv/GetParameters` | Lấy kiểu dữ liệu và giá trị hiện thời của tham số | Dòng 3307 |
| `<node_name>/set_parameters` | `rcl_interfaces/srv/SetParameters` | Ghi giá trị mới vào tham số lúc runtime | Dòng 3410 |
| `/steer_planner_node/set_parameters` | `rcl_interfaces/srv/SetParameters` | Ghi nhanh thông số bề rộng luống `swath_width_m` | Dòng 2321 |
