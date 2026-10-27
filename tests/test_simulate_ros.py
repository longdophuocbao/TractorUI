"""Run with: python3 -m unittest discover -s tests -v"""

import json
import math
import unittest

from tornado.testing import AsyncHTTPTestCase, gen_test
from tornado.websocket import websocket_connect

from simulate_ros import Simulation, make_app


class SimulationTests(unittest.TestCase):
    def setUp(self):
        self.sim = Simulation()

    def test_motion_matches_gps_and_orientation(self):
        self.sim.advance(1.0)
        messages = self.sim.messages()
        pose = messages['/odom/absolute'][1]['pose']['pose']
        gps = messages['/gps/fix'][1]
        self.assertGreater(pose['position']['y'], 0)
        self.assertAlmostEqual(gps['latitude'], self.sim.latitude + math.degrees(self.sim.y / 6378137))
        self.assertAlmostEqual(sum(v * v for v in pose['orientation'].values()), 1)

    def test_depth_clamps_and_confirms_home(self):
        self.sim.publish('/ui/depth_command', {'mode': 0, 'target': 900, 'enable': True})
        self.assertEqual(self.sim.messages()['/ui/depth_command_ack'][1]['target'], 150)
        self.sim.publish('/ui/depth_command', {'mode': 2, 'target': 120, 'enable': True})
        self.sim.advance(0.25)
        status = self.sim.messages()['/depth_link/status'][1]
        self.assertTrue(status['streaming'])
        self.assertEqual(status['mode'], 2)
        self.assertLess(status['estimate_depth_cm'], 120)

    def test_ab_record_save_load_and_shift(self):
        service = '/steer_planner_node/'
        for expected in (1, 2, 3):
            self.sim.service(service + 'toggle_line_recording', {})
            self.assertEqual(self.sim.planner_state, expected)
        self.sim.service(service + 'save_reference_line', {})
        original = self.sim.reference['poses'][0]['pose']['position']['x']
        self.sim.service(service + 'swath_right', {})
        self.assertEqual(self.sim.reference['poses'][0]['pose']['position']['x'], original + 2)
        self.sim.service(service + 'load_reference_line', {})
        self.assertEqual(self.sim.reference['poses'][0]['pose']['position']['x'], original)

    def test_parameter_persistence_in_memory(self):
        self.sim.service('/parameter_persistence/set_and_save', {'parameters': [
            {'name': '/steer_planner_node::swath_width_m', 'value': {'type': 3, 'double_value': 2.8}}]})
        result = self.sim.service('/steer_planner_node/get_parameters', {'names': ['swath_width_m']})
        self.assertEqual(result['values'][0]['double_value'], 2.8)

    def test_unknown_service_does_not_claim_success(self):
        with self.assertRaises(ValueError):
            self.sim.service('/unknown_service', {})

    def test_clear_path_and_start_stop(self):
        self.sim.service('/path_follower_bridge/start_stop', {'data': True})
        self.assertEqual(self.sim.follower_state, 4)
        self.sim.service('/path_follower_bridge/start_stop', {'data': False})
        self.assertEqual(self.sim.follower_state, 0)
        self.sim.service('/clear_all', {})
        self.assertEqual(self.sim.planned['poses'], [])
        self.assertFalse(self.sim.service('/generate_path', {})['success'])


class ProtocolTests(AsyncHTTPTestCase):
    def get_app(self):
        return make_app()

    def test_http_and_hidden_files(self):
        self.assertIn(b'ROS SIMULATOR', self.fetch('/?sim=1').body)
        status = json.loads(self.fetch('/api/sim/status').body)
        self.assertEqual(status['mode'], 'simulation')
        self.assertEqual(status['topics'], 25)
        self.assertEqual(self.fetch('/.git/config').code, 404)

    @gen_test
    async def test_rosbridge_services_and_subscription_lifecycle(self):
        ws = await websocket_connect(self.get_url('/rosbridge').replace('http:', 'ws:'))
        try:
            ws.write_message(json.dumps({'op': 'call_service', 'id': 'topics:1', 'service': '/rosapi/topics', 'args': {}}))
            reply = json.loads(await ws.read_message())
            self.assertEqual(reply['id'], 'topics:1')
            self.assertTrue(reply['result'])
            self.assertIn('/depth_link/status', reply['values']['topics'])
            ws.write_message(json.dumps({'op': 'subscribe', 'topic': '/gps/fix', 'throttle_rate': 500}))
            ws.write_message(json.dumps({'op': 'call_service', 'id': 'barrier', 'service': '/rosapi/nodes'}))
            await ws.read_message()
            client = next(iter(self._app.clients))
            self.assertEqual(client.subscriptions['/gps/fix']['interval'], 0.5)
            ws.write_message(json.dumps({'op': 'unsubscribe', 'topic': '/gps/fix'}))
            ws.write_message(json.dumps({'op': 'call_service', 'id': 'bad:1', 'service': '/missing'}))
            reply = json.loads(await ws.read_message())
            self.assertFalse(reply['result'])
            self.assertNotIn('/gps/fix', client.subscriptions)
        finally:
            ws.close()


if __name__ == '__main__':
    unittest.main()
