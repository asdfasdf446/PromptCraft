import json
import os
import time
import uuid
import unittest
from urllib import request

import websocket

BASE_HTTP_URL = os.environ.get("PROMPTCRAFT_BASE_URL", "http://127.0.0.1:8080")
WS_URL = os.environ.get("PROMPTCRAFT_WS_URL", "ws://127.0.0.1:8080/ws")


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
        self.assertIn("move_up", me["action_queue"])

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

    def test_positive_multiple_players_receive_world_state(self):
        first = self.new_client()
        second = self.new_client()

        world = first.read_until(lambda msg: "units" in msg and len(msg["units"]) >= 2)
        unit_ids = {unit["id"] for unit in world["units"]}
        self.assertIn(first.unit_id, unit_ids)
        self.assertIn(second.unit_id, unit_ids)


if __name__ == "__main__":
    unittest.main()
