#!/usr/bin/env python3
"""Serve TractorUI and an isolated rosbridge-compatible simulator (no ROS needed).

Run: python3 simulate_ros.py --host 0.0.0.0 --port 8000
Open: http://localhost:8000/?sim=1
All commands affect in-memory simulation only. Nothing connects to hardware.
"""

import argparse
import copy
import json
import logging
import math
import time
from pathlib import Path

import tornado.ioloop
import tornado.web
import tornado.websocket


ROOT = Path(__file__).resolve().parent
LOG = logging.getLogger("tractor-sim")


def parameter(value):
    if isinstance(value, bool):
        return {"type": 1, "bool_value": value}
    if isinstance(value, int):
        return {"type": 2, "integer_value": value}
    if isinstance(value, float):
        return {"type": 3, "double_value": value}
    return {"type": 4, "string_value": str(value)}


def path(points):
    return {"header": {"frame_id": "map"}, "poses": [
        {"pose": {"position": {"x": x, "y": y, "z": 0.0},
                  "orientation": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0}}}
        for x, y in points]}


class Simulation:
    def __init__(self, latitude=22.644689395509474, longitude=120.35725482912399,
                 speed=1.2, rtk="RTK Fixed"):
        self.started = time.monotonic()
        self.latitude, self.longitude = latitude, longitude
        self.speed, self.rtk = speed, rtk
        self.elapsed = 0.0
        self.x, self.y = 0.0, 0.0
        self.yaw = math.pi / 2
        self.planner_state, self.field_state, self.follower_state = 3, 3, 0
        self.mode = 1
        self.depth = {"mode": 0, "target": 120.0, "enable": False}
        self.actual_depth = 120.0
        self.height_soil_mm = 40.0
        self.steer_command = None
        self.jog = 0.0
        self.calibration = [0.0, -30.0, 30.0, 0.0]
        self.reference = path([(0.0, -100.0), (0.0, 100.0)])
        self.boundary = [(float(x), float(y)) for x, y in
                         [(-18, -50), (18, -50), (18, 50), (-18, 50)]]
        self.planned = self.make_plan()
        self.path_total_length_m = self.path_length(self.planned)
        self.path_progress_m = 0.0
        self.path_elapsed_time_s = 0.0
        self.saved = {"Demo AB": copy.deepcopy(self.reference)}
        self.params = {
            "/steer_planner_node": {"swath_width_m": 2.0, "reference_line_name": "Demo AB"},
            "/steer_motor_node": {"max_steer_deg": 30.0, "use_sim_time": True},
            "/field_planner": {"swath_width": 2.0},
            "/path_follower_bridge": {"lookahead_distance": 3.0},
        }

    @staticmethod
    def make_plan():
        return path([(float(x), float(y)) for i, x in enumerate(range(-16, 17, 4))
                     for y in ((-45, 45) if i % 2 == 0 else (45, -45))])

    @staticmethod
    def path_length(path_message):
        poses = path_message.get("poses", [])
        points = [pose["pose"]["position"] for pose in poses]
        return sum(math.hypot(b["x"] - a["x"], b["y"] - a["y"])
                   for a, b in zip(points, points[1:]))

    def reset_path_progress(self):
        self.path_total_length_m = self.path_length(self.planned)
        self.path_progress_m = 0.0
        self.path_elapsed_time_s = 0.0

    def advance(self, dt):
        self.elapsed += dt
        if self.follower_state == 4:
            self.path_elapsed_time_s += dt
            self.path_progress_m = min(
                self.path_total_length_m,
                self.path_progress_m + max(0.0, self.speed) * dt,
            )
        # Smooth movement within the demo field; ROS yaw is measured from east.
        phase = self.elapsed * self.speed / 40.0
        self.x = 1.2 * math.sin(phase)
        self.y = 40.0 * math.sin(phase)
        self.yaw = math.atan2(40.0 * math.cos(phase), 1.2 * math.cos(phase))
        target = self.depth["target"] if self.depth["mode"] == 0 else self.actual_depth
        if self.depth["mode"] == 2:
            target = 0.0
        if self.depth["enable"]:
            self.actual_depth += (target - self.actual_depth) * min(1.0, dt * 2)

    def messages(self):
        t = self.elapsed
        stamp = {"sec": int(time.time()), "nanosec": 0}
        header = {"stamp": stamp, "frame_id": "map"}
        q = {"x": 0.0, "y": 0.0, "z": math.sin(self.yaw / 2), "w": math.cos(self.yaw / 2)}
        gps = {"header": header, "status": {"status": 2, "service": 1},
               "latitude": self.latitude + math.degrees(self.y / 6378137.0),
               "longitude": self.longitude + math.degrees(self.x / 6378137.0) / math.cos(math.radians(self.latitude)),
               "altitude": 12.0, "position_covariance": [0.0004, 0, 0, 0, 0.0004, 0, 0, 0, 0.001],
               "position_covariance_type": 2}
        cmd = self.steer_command if self.steer_command is not None else 3.0 * math.sin(t / 3)
        lift = self.depth["target"] if self.depth["mode"] == 1 else 18.0 + math.sin(t / 4)
        if self.depth["mode"] == 2:
            lift = 35.0
        stats = {name: True for name in (
            "serial_port_open", "serial_ok", "depth_link_ok", "steer_link_ok",
            "steer_motor_feedback_ok", "gateway_heartbeat_seen", "gateway_link_ok", "gateway_uart_ok")}
        stats.update({name: 0 for name in (
            "depth_tx_fail", "steer_tx_fail", "master_serial_bad_frames", "bridge_serial_bad_frames",
            "bridge_serial_write_errors", "gateway_uart_checksum_errors", "gateway_uart_sync_errors",
            "gateway_uart_partial_timeouts", "gateway_espnow_tx_fail", "gateway_espnow_send_errors")})
        stats.update(header=header, depth_rx_age_ms=20.0, steer_rx_age_ms=20.0,
                     depth_tx_ok=int(t * 20), steer_tx_ok=int(t * 20), master_uptime_s=t,
                     gateway_heartbeat_age_ms=20.0, gateway_uptime_s=t, gateway_heartbeat_seq=int(t * 5),
                     gateway_uart_age_ms=20.0, gateway_uart_bytes=int(t * 500),
                     gateway_uart_valid_frames=int(t * 20), gateway_espnow_tx_ok=int(t * 20))
        odom = {"header": header, "child_frame_id": "base_link",
                "pose": {"pose": {"position": {"x": self.x, "y": self.y, "z": 0.0},
                                  "orientation": q}, "covariance": [0.0] * 36},
                "twist": {"twist": {"linear": {"x": self.speed, "y": 0.0, "z": 0.0},
                                    "angular": {"x": 0.0, "y": 0.0, "z": 0.0}}, "covariance": [0.0] * 36}}
        remaining_length = max(0.0, self.path_total_length_m - self.path_progress_m)
        progress_speed = self.speed if self.follower_state == 4 and self.speed >= 0.05 else 0.2
        estimated_remaining_time = remaining_length / progress_speed
        estimated_total_time = self.path_elapsed_time_s + estimated_remaining_time
        simple = {
            "/f9r/num_sv": ("std_msgs/msg/Int32", 28 + int(2 * math.sin(t / 20))),
            "/f9r/rtk_status": ("std_msgs/msg/String", self.rtk),
            "/f9r/speed": ("std_msgs/msg/Float32", self.speed * abs(math.cos(t * self.speed / 40))),
            "/steering_command": ("std_msgs/msg/Float64", cmd),
            "/steering_angle_actual": ("std_msgs/msg/Float64", cmd + 0.25 * math.sin(t * 2) + self.jog * 10),
            "/steer_motor_node/state": ("std_msgs/msg/Int32", int(self.planner_state == 3 or self.follower_state == 4)),
            "/steer_motor_node/iq": ("std_msgs/msg/Float64", 0.8 + abs(cmd) * 0.12),
            "/steer_motor_node/calibrated": ("std_msgs/msg/Bool", self.calibration[3] == 0),
            "/steer_motor_node/fault": ("std_msgs/msg/Bool", False),
            "/steer_planner_node/state_machine": ("std_msgs/msg/Int32", self.planner_state),
            "/path_follower_bridge/state": ("std_msgs/msg/Int32", self.follower_state),
            "/field_planner/state": ("std_msgs/msg/Int32", self.field_state),
            "/planned_path/remaining_length": ("std_msgs/msg/Float64", remaining_length),
            "/planned_path/elapsed_time_s": ("std_msgs/msg/Float64", self.path_elapsed_time_s),
            "/planned_path/estimated_remaining_time_s": ("std_msgs/msg/Float64", estimated_remaining_time),
            "/planned_path/estimated_total_time_s": ("std_msgs/msg/Float64", estimated_total_time),
        }
        result = {topic: (kind, {"data": value}) for topic, (kind, value) in simple.items()}
        result.update({
            "/map_origin": ("sensor_msgs/msg/NavSatFix", dict(gps, latitude=self.latitude, longitude=self.longitude)),
            "/gps/fix": ("sensor_msgs/msg/NavSatFix", gps),
            "/odom/absolute": ("nav_msgs/msg/Odometry", odom),
            "/odometry/global": ("nav_msgs/msg/Odometry", odom),
            "/imu": ("sensor_msgs/msg/Imu", {"header": header, "orientation": q,
                "angular_velocity": {"x": 0.0, "y": 0.0, "z": 0.0},
                "linear_acceleration": {"x": 0.0, "y": 0.0, "z": 9.81}}),
            "/reference_line": ("nav_msgs/msg/Path", self.reference),
            "/planned_path": ("nav_msgs/msg/Path", self.planned),
            "/field_boundary": ("geometry_msgs/msg/PolygonStamped", {"header": header,
                "polygon": {"points": [{"x": x, "y": y, "z": 0.0} for x, y in self.boundary]}}),
            "/path_endpoints": ("visualization_msgs/msg/MarkerArray", {"markers": []}),
            "/steer_motor_node/calibration": ("std_msgs/msg/Float64MultiArray", {"data": self.calibration}),
            "/depth_link/status": ("tractor_espnow_bridge/msg/DepthLinkStatus", {
                "header": header, "mode": self.depth["mode"],
                "estimate_depth_cm": max(0.0, self.actual_depth + 0.8 * math.sin(t * 2)),
                "lift_angle_deg": lift, "tail_angle_deg": 5.0 + math.sin(t / 3),
                "depth_target_cm": self.depth["target"], "link_ok": True,
                "streaming": self.depth["enable"], "control_source": 1, "preempted": False}),
            "/espnow_link/stats": ("tractor_espnow_bridge/msg/EspNowLinkStats", stats),
            "/depth_link/height_soil_actual_mm": ("std_msgs/Float32", {"data": self.height_soil_mm}),
            "/ui/depth_command_ack": ("tractor_espnow_bridge/msg/DepthUiCommand", dict(self.depth)),
        })
        return result

    def publish(self, topic, msg):
        if topic == "/depth_link/height_soil_mm":
            height = float(msg["data"])
            if math.isfinite(height) and 0 <= height <= 50:
                self.height_soil_mm = height
        elif topic == "/ui/depth_command":
            mode = int(msg["mode"])
            limits = {0: (5.0, 150.0), 1: (0.0, 35.0), 2: (5.0, 150.0), 3: (-150.0, 150.0)}
            low, high = limits[mode]
            self.depth = {"mode": mode, "target": max(low, min(high, float(msg["target"]))),
                          "enable": bool(msg["enable"])}
        elif topic == "/target_line_mux/select_mode":
            self.mode = int(msg["data"])
            if self.mode == 2:
                self.planner_state = 1
            else:
                self.follower_state = 0
        elif topic == "/steering_command":
            self.steer_command = max(-30.0, min(30.0, float(msg["data"])))
        elif topic == "/steer_motor_node/jog_rate":
            self.jog = max(-1.0, min(1.0, float(msg["data"])))
        else:
            raise ValueError("Unsupported simulated topic: " + topic)

    def service(self, name, args):
        action = name.rsplit("/", 1)[-1]
        node = name.rsplit("/", 1)[0]
        if name == "/rosapi/topics":
            messages = self.messages()
            return {"topics": list(messages), "types": [item[0] for item in messages.values()]}
        if name == "/rosapi/nodes":
            return {"nodes": list(self.params)}
        if action == "get_parameters":
            return {"values": [parameter(self.params.get(node, {})[key]) if key in self.params.get(node, {})
                               else {"type": 0} for key in args.get("names", [])]}
        if action == "list_parameters":
            return {"result": {"names": list(self.params.get(node, {})), "prefixes": []}}
        if action == "describe_parameters":
            return {"descriptors": [{"name": key, "type": parameter(self.params[node][key])["type"],
                "description": "In-memory simulator parameter", "read_only": False,
                "floating_point_range": [], "integer_range": []} for key in args.get("names", [])]}
        if action in ("set_parameters", "set_and_save"):
            for item in args.get("parameters", []):
                target, key = (item["name"].split("::", 1) if "::" in item["name"] else (node, item["name"]))
                value = item["value"]
                field = {1: "bool_value", 2: "integer_value", 3: "double_value", 4: "string_value"}[value["type"]]
                self.params.setdefault(target, {})[key] = value[field]
            return {"results": [{"successful": True, "reason": "Simulated; kept in memory"}
                                for _ in args.get("parameters", [])]}
        success, message = True, "Simulated: " + action
        if name.startswith("/steer_planner_node/"):
            key = self.params["/steer_planner_node"]["reference_line_name"]
            if action == "toggle_line_recording":
                self.planner_state = {1: 2, 2: 3, 3: 1}[self.planner_state]
                if self.planner_state == 3:
                    self.reference = path([(self.x, -100.0), (self.x, 100.0)])
                elif self.planner_state == 1:
                    self.reference = path([])
            elif action in ("swath_left", "swath_right", "rotate_ref_left", "rotate_ref_right"):
                shift = self.params["/steer_planner_node"]["swath_width_m"] * (-1 if action.endswith("left") else 1)
                for pose in self.reference["poses"]:
                    pt = pose["pose"]["position"]
                    if action.startswith("swath"):
                        pt["x"] += shift
                    else:
                        angle = math.radians(-1 if action.endswith("left") else 1)
                        pt["x"], pt["y"] = pt["x"] * math.cos(angle) - pt["y"] * math.sin(angle), pt["x"] * math.sin(angle) + pt["y"] * math.cos(angle)
            elif action == "list_reference_lines":
                message = "\n".join(sorted(self.saved))
            elif action == "save_reference_line":
                self.saved[key] = copy.deepcopy(self.reference)
            elif action in ("load_reference_line", "delete_reference_line"):
                if key not in self.saved:
                    success, message = False, "Reference line does not exist"
                elif action == "load_reference_line":
                    self.reference = copy.deepcopy(self.saved[key])
                    self.planner_state = 3
                else:
                    del self.saved[key]
            else:
                raise ValueError("Unsupported simulated service: " + name)
        elif name == "/record_vertex":
            self.boundary.append((self.x, self.y))
            self.field_state = 2
        elif name == "/generate_path":
            if len(self.boundary) < 3:
                success, message = False, "Record at least three boundary points"
            else:
                self.planned, self.field_state = self.make_plan(), 3
                self.reset_path_progress()
        elif name == "/clear_all":
            self.boundary, self.planned = [], path([])
            self.reset_path_progress()
            self.field_state, self.follower_state = 1, 0
        elif name == "/path_follower_bridge/start_stop":
            if args.get("data"):
                self.reset_path_progress()
                self.follower_state = 4
            else:
                self.follower_state = 0
        elif name == "/path_follower_bridge/resume":
            self.follower_state = 4
        elif name.startswith("/steer_motor_node/") and action in (
                "calibrate", "capture_left_limit", "capture_right_limit", "cancel_calibration"):
            self.calibration[3] = {"calibrate": 1.0, "capture_left_limit": 2.0,
                                   "capture_right_limit": 0.0, "cancel_calibration": 0.0}[action]
        else:
            raise ValueError("Unsupported simulated service: " + name)
        return {"success": success, "message": message}


class ROSBridge(tornado.websocket.WebSocketHandler):
    def initialize(self, simulation):
        self.simulation = simulation
        self.subscriptions = {}

    def open(self):
        self.application.clients.add(self)
        LOG.info("Simulator client connected")

    def on_close(self):
        self.application.clients.discard(self)

    def on_message(self, raw):
        packet = {}
        try:
            packet = json.loads(raw)
            op = packet.get("op")
            if op == "subscribe":
                self.subscriptions[packet["topic"]] = {
                    "interval": max(0.0, float(packet.get("throttle_rate", 0))) / 1000,
                    "last": -math.inf}
            elif op == "unsubscribe":
                self.subscriptions.pop(packet["topic"], None)
            elif op == "publish":
                self.simulation.publish(packet["topic"], packet["msg"])
            elif op == "call_service":
                values = self.simulation.service(packet["service"], packet.get("args", {}))
                self.write_message({"op": "service_response", "service": packet["service"],
                                    "id": packet.get("id"), "result": True, "values": values})
            elif op not in ("advertise", "unadvertise", "set_level"):
                raise ValueError("Unsupported rosbridge operation: " + str(op))
        except (ValueError, KeyError, TypeError) as error:
            if packet.get("op") == "call_service":
                self.write_message({"op": "service_response", "service": packet.get("service"),
                                    "id": packet.get("id"), "result": False, "values": str(error)})
            else:
                self.write_message({"op": "status", "level": "error", "msg": str(error)})


class Health(tornado.web.RequestHandler):
    def get(self):
        self.write({"mode": "simulation", "clients": len(self.application.clients),
                    "topics": len(self.application.simulation.messages()),
                    "uptime_s": round(time.monotonic() - self.application.simulation.started, 1)})


class UIFile(tornado.web.StaticFileHandler):
    def set_extra_headers(self, path):
        # TractorUI is edited live during HMI development. Force browsers and
        # embedded WebViews to revalidate so a refreshed page shows the latest UI.
        self.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.set_header("Pragma", "no-cache")
        self.set_header("Expires", "0")

    def validate_absolute_path(self, root, absolute_path):
        if any(part.startswith(".") for part in Path(absolute_path).relative_to(ROOT).parts):
            raise tornado.web.HTTPError(404)
        return super().validate_absolute_path(root, absolute_path)


def make_app(simulation=None):
    simulation = simulation or Simulation()
    app = tornado.web.Application([
        (r"/rosbridge", ROSBridge, {"simulation": simulation}),
        (r"/api/sim/status", Health),
        (r"/(.*)", UIFile, {"path": str(ROOT), "default_filename": "index.html"}),
    ], websocket_ping_interval=20, websocket_max_message_size=1024 * 1024)
    app.simulation = simulation
    app.clients = set()
    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--hz", type=float, default=10.0)
    parser.add_argument("--speed", type=float, default=1.2, help="Maximum demo speed in m/s")
    parser.add_argument("--latitude", type=float, default=22.644689395509474)
    parser.add_argument("--longitude", type=float, default=120.35725482912399)
    parser.add_argument("--rtk", choices=["RTK Fixed", "RTK Float", "No RTK"], default="RTK Fixed")
    args = parser.parse_args()
    if not 1 <= args.hz <= 50 or not 0 <= args.speed <= 20:
        parser.error("Use --hz 1..50 and --speed 0..20")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    sim = Simulation(args.latitude, args.longitude, args.speed, args.rtk)
    app = make_app(sim)
    app.listen(args.port, address=args.host)
    last = time.monotonic()

    def tick():
        nonlocal last
        now = time.monotonic()
        sim.advance(min(now - last, 1.0))
        last = now
        messages = sim.messages()
        for client in list(app.clients):
            # Origin must reach the UI before any local-coordinate map layers.
            topics = sorted(client.subscriptions, key=lambda topic: topic != "/map_origin")
            for topic in topics:
                subscription = client.subscriptions[topic]
                if topic not in messages or now - subscription["last"] < subscription["interval"]:
                    continue
                try:
                    client.write_message({"op": "publish", "topic": topic, "msg": messages[topic][1]})
                    subscription["last"] = now
                except tornado.websocket.WebSocketClosedError:
                    break

    timer = tornado.ioloop.PeriodicCallback(tick, 1000 / args.hz)
    timer.start()
    LOG.info("TractorUI: http://localhost:%s/?sim=1 (bind %s)", args.port, args.host)
    LOG.info("Python simulator: %s topics at %s Hz; commands stay in memory", len(sim.messages()), args.hz)
    try:
        tornado.ioloop.IOLoop.current().start()
    except KeyboardInterrupt:
        timer.stop()


if __name__ == "__main__":
    main()
