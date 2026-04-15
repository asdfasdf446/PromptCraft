import json
import os
import time
import uuid
import unittest
from urllib import request

import websocket

BASE_HTTP_URL = os.environ.get("PROMPTCRAFT_BASE_URL", "http://127.0.0.1:8081")
WS_URL = os.environ.get("PROMPTCRAFT_WS_URL", "ws://127.0.0.1:8081/ws")


def post_json(path: str, payload: dict) -> dict:
    req = request.Request(
        f"{BASE_HTTP_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


class PromptCraftAPIClient:
    def __init__(self):
        self.token = None
        self.ws = None
        self.unit_id = None

    def connect_guest(self):
        self.token = post_json("/guest", {"uid": str(uuid.uuid4())})["token"]
        self.ws = websocket.create_connection(WS_URL, timeout=10)
        self.ws.send(json.dumps({"type": "auth", "token": self.token}))

        auth_ok = self.read_until(lambda msg: msg.get("type") == "auth_ok")
        self.unit_id = auth_ok["unit_id"]
        return auth_ok

    def send_command(self, command: str, unit_id: str | None = None, request_id: str | None = None):
        if unit_id is None:
            unit_id = self.unit_id
        if request_id is None:
            request_id = f"test-{uuid.uuid4()}"

        self.ws.send(json.dumps({
            "type": "command",
            "request_id": request_id,
            "command": command,
            "unit_id": unit_id,
        }))
        return request_id

    def read_until(self, predicate, timeout: float = 10.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            raw = self.ws.recv()
            message = json.loads(raw)
            if predicate(message):
                return message
        raise TimeoutError("Timed out waiting for expected message")

    def close(self):
        if self.ws is not None:
            self.ws.close()
            self.ws = None


class PromptCraftAPITest(unittest.TestCase):
    def setUp(self):
        self.clients: list[PromptCraftAPIClient] = []

    def tearDown(self):
        for client in self.clients:
            client.close()

    def new_client(self) -> PromptCraftAPIClient:
        client = PromptCraftAPIClient()
        client.connect_guest()
        self.clients.append(client)
        return client

    def test_positive_command_is_acknowledged_and_visible_in_world_state(self):
        client = self.new_client()
        request_id = client.send_command("move_up")

        result = client.read_until(lambda msg: msg.get("type") == "command_result" and msg.get("request_id") == request_id)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(result["code"], "queued")
        self.assertGreaterEqual(result.get("queue_length", 0), 1)

        world = client.read_until(lambda msg: "units" in msg and any(u["id"] == client.unit_id for u in msg["units"]))
        me = next(u for u in world["units"] if u["id"] == client.unit_id)
        self.assertEqual(me["kind"], "player")
        self.assertIn("move_up", me["action_queue"])

    def test_world_state_includes_tiles_and_stack_fields(self):
        client = self.new_client()
        world = client.read_until(lambda msg: "tiles" in msg and "units" in msg)
        self.assertEqual(len(world["tiles"]), 900)
        tile_kinds = [tile["kind"] for tile in world["tiles"]]
        self.assertGreaterEqual(tile_kinds.count("fertile"), 150)
        self.assertGreaterEqual(tile_kinds.count("obstacle"), 70)
        self.assertGreaterEqual(tile_kinds.count("normal"), 500)
        me = next(u for u in world["units"] if u["id"] == client.unit_id)
        self.assertIn("grid_x", me)
        self.assertIn("grid_y", me)
        self.assertIn("stack_level", me)
        self.assertEqual(me["kind"], "player")

    def test_world_state_contains_non_player_entities(self):
        client = self.new_client()
        world = client.read_until(lambda msg: "units" in msg and any(u["kind"] != "player" for u in msg["units"]))
        kinds = {unit["kind"] for unit in world["units"]}
        self.assertIn("obstacle", kinds)
        self.assertIn("food", kinds)
        food_units = [unit for unit in world["units"] if unit["kind"] == "food"]
        self.assertTrue(all(unit["model"].startswith("nature/") for unit in food_units))

    def test_negative_invalid_command_is_rejected(self):
        client = self.new_client()
        request_id = client.send_command("explode_everything")

        result = client.read_until(lambda msg: msg.get("type") == "command_result" and msg.get("request_id") == request_id)
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["code"], "invalid_command")

    def test_negative_unit_mismatch_is_rejected(self):
        client = self.new_client()
        wrong_unit_id = str(uuid.uuid4())
        request_id = client.send_command("move_up", unit_id=wrong_unit_id)

        result = client.read_until(lambda msg: msg.get("type") == "command_result" and msg.get("request_id") == request_id)
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["code"], "unit_mismatch")

    def test_negative_queue_limit_is_enforced(self):
        client = self.new_client()
        accepted = 0
        rejected = None

        for index in range(11):
            request_id = client.send_command("move_up", request_id=f"queue-{index}")
            result = client.read_until(lambda msg, rid=request_id: msg.get("type") == "command_result" and msg.get("request_id") == rid)
            if result["status"] == "accepted":
                accepted += 1
            else:
                rejected = result
                break

        self.assertEqual(accepted, 10)
        self.assertIsNotNone(rejected)
        self.assertEqual(rejected["code"], "queue_full")


if __name__ == "__main__":
    unittest.main()
