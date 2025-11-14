import random
import json
import time
from locust import HttpUser, task, between


class EventSinkUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Initialize test data when user starts"""
        self.session_id = f"load-test-{random.randint(1000, 9999)}-{int(time.time())}"
        self.content_duration = 300  # 5 minutes
        self.playhead_position = 0
        self.initialized = False
        
    def get_base_event(self):
        """Get base event structure"""
        base_event = {
            "sessionId": self.session_id,
            "timestamp": int(time.time() * 1000),
            "playhead": self.playhead_position,
            "duration": self.content_duration
        }
        # Optionally add shardId for some events (supported but not required)
        if random.random() < 0.3:  # 30% of events include shardId
            base_event["shardId"] = f"shard-{random.randint(1, 5)}"
        return base_event
    
    @task(1)
    def send_init_event(self):
        """Send init event - only once per session"""
        if not self.initialized:
            event = self.get_base_event()
            event.update({
                "event": "init",
                "timestamp": -1,
                "playhead": -1,
                "duration": -1
            })
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                    self.initialized = True
                else:
                    response.failure(f"Init failed: {response.status_code}")
    
    @task(2)
    def send_metadata_event(self):
        """Send metadata event"""
        if self.initialized:
            event = self.get_base_event()
            event.update({
                "event": "metadata",
                "timestamp": -1,
                "playhead": -1,
                "duration": -1,
                "payload": {
                    "live": False,
                    "contentTitle": f"Load Test Content {self.session_id}",
                    "contentId": f"content-{random.randint(1, 100)}",
                    "contentUrl": "https://example.com/content.mp4",
                    "drmType": "",
                    "userId": f"user-{random.randint(1, 1000)}",
                    "deviceId": f"device-{random.randint(1, 500)}",
                    "deviceModel": random.choice(["iPhone 14", "Samsung Galaxy S23", "iPad Pro", "MacBook Pro"]),
                    "deviceType": random.choice(["mobile", "tablet", "desktop"])
                }
            })
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"Metadata failed: {response.status_code}")
    
    @task(5)
    def send_heartbeat_event(self):
        """Send heartbeat event - most frequent"""
        if self.initialized:
            event = self.get_base_event()
            event["event"] = "heartbeat"
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                    # Advance playhead slightly
                    self.playhead_position += random.randint(1, 5)
                else:
                    response.failure(f"Heartbeat failed: {response.status_code}")
    
    @task(3)
    def send_playback_events(self):
        """Send various playback events"""
        if self.initialized:
            events = ["playing", "paused", "buffering", "buffered", "seeking", "seeked"]
            event_type = random.choice(events)
            
            event = self.get_base_event()
            event["event"] = event_type
            
            # For seeking events, adjust playhead
            if event_type in ["seeking", "seeked"]:
                self.playhead_position = random.randint(0, self.content_duration)
                event["playhead"] = self.playhead_position
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"{event_type} event failed: {response.status_code}")
    
    @task(2)
    def send_loading_events(self):
        """Send loading related events"""
        if self.initialized:
            events = ["loading", "loaded"]
            event_type = random.choice(events)
            
            event = self.get_base_event()
            event["event"] = event_type
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"{event_type} event failed: {response.status_code}")
    
    @task(1)
    def send_bitrate_changed_event(self):
        """Send bitrate changed event"""
        if self.initialized:
            event = self.get_base_event()
            event.update({
                "event": "bitrate_changed",
                "payload": {
                    "bitrate": random.choice([500000, 1000000, 2000000, 4000000, 8000000]),
                    "width": random.choice([1280, 1920, 3840]),
                    "height": random.choice([720, 1080, 2160]),
                    "videoBitrate": random.choice([400000, 800000, 2000000, 6000000]),
                    "audioBitrate": random.choice([128000, 256000, 320000])
                }
            })
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"Bitrate changed failed: {response.status_code}")
    
    @task(1)
    def send_error_event(self):
        """Send error event occasionally"""
        if self.initialized:
            event = self.get_base_event()
            event.update({
                "event": "error",
                "payload": {
                    "category": random.choice(["NETWORK", "DECODER", "PLAYER", "DRM"]),
                    "code": str(random.choice([404, 500, 503, 1001, 1002])),
                    "message": random.choice(["Network error", "Playback failed", "Server error", "Decoder error"]),
                    "data": {}
                }
            })
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"Error event failed: {response.status_code}")
    
    @task(1)
    def send_warning_event(self):
        """Send warning event occasionally"""
        if self.initialized:
            event = self.get_base_event()
            event.update({
                "event": "warning",
                "payload": {
                    "category": random.choice(["NETWORK", "PLAYER", "QUALITY"]),
                    "code": str(random.choice([100, 200, 300, 2001, 2002])),
                    "message": random.choice(["Low bandwidth", "Buffer underrun", "Quality degraded"]),
                    "data": {}
                }
            })
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"Warning event failed: {response.status_code}")
    
    @task(1)
    def send_stopped_event(self):
        """Send stopped event - end of session"""
        if self.initialized and random.random() < 0.1:  # 10% chance
            event = self.get_base_event()
            event.update({
                "event": "stopped",
                "payload": {
                    "reason": random.choice(["ended", "aborted", "error", "user_action"])
                }
            })
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                    # Reset session for this user
                    self.initialized = False
                    self.playhead_position = 0
                else:
                    response.failure(f"Stopped event failed: {response.status_code}")
    
    @task(1)
    def test_options_request(self):
        """Test OPTIONS request for CORS"""
        with self.client.options("/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"OPTIONS failed: {response.status_code}")
    
    @task(1)
    def test_invalid_endpoint(self):
        """Test invalid endpoints"""
        invalid_paths = ["/invalid", "/test", "/health"]
        path = random.choice(invalid_paths)
        
        with self.client.get(path, catch_response=True) as response:
            # Expecting 404 or similar for invalid endpoints
            if response.status_code in [404, 405]:
                response.success()
            else:
                response.failure(f"Unexpected response for {path}: {response.status_code}")


class HighVolumeEventSinkUser(EventSinkUser):
    """High-frequency event sender for stress testing"""
    wait_time = between(0.1, 0.5)
    
    @task(10)
    def rapid_heartbeats(self):
        """Send rapid heartbeat events"""
        if self.initialized:
            event = self.get_base_event()
            event["event"] = "heartbeat"
            
            with self.client.post("/", json=event, catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                    self.playhead_position += 1
                else:
                    response.failure(f"Rapid heartbeat failed: {response.status_code}")


class InvalidEventUser(HttpUser):
    """User that sends invalid events to test error handling"""
    wait_time = between(2, 5)
    
    @task(1)
    def send_invalid_json(self):
        """Send malformed JSON"""
        with self.client.post("/", data="invalid json", catch_response=True) as response:
            if response.status_code == 400:
                response.success()
            else:
                response.failure(f"Expected 400 for invalid JSON: {response.status_code}")
    
    @task(1)
    def send_missing_fields(self):
        """Send event with missing required fields"""
        invalid_event = {
            "event": "heartbeat"
            # Missing sessionId, timestamp, playhead, duration
        }
        
        with self.client.post("/", json=invalid_event, catch_response=True) as response:
            if response.status_code == 400:
                response.success()
            else:
                response.failure(f"Expected 400 for missing fields: {response.status_code}")
    
    @task(1)
    def send_invalid_event_type(self):
        """Send event with invalid event type"""
        invalid_event = {
            "event": "invalid_event_type",
            "sessionId": "test-session",
            "timestamp": int(time.time() * 1000),
            "playhead": 0,
            "duration": 300
        }
        
        with self.client.post("/", json=invalid_event, catch_response=True) as response:
            if response.status_code == 400:
                response.success()
            else:
                response.failure(f"Expected 400 for invalid event type: {response.status_code}")