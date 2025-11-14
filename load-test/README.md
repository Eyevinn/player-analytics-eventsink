# Load Testing for Player Analytics EventSink

This directory contains Locust-based load testing scripts for the Player Analytics EventSink API.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running Tests

### Basic Load Test
```bash
locust -f locustfile.py --host=http://localhost:3000
```

### Command Line Testing
Run a simple test with specific parameters:
```bash
# 10 users, spawn 2 users per second, run for 60 seconds
locust -f locustfile.py --host=http://localhost:3000 --users 10 --spawn-rate 2 --run-time 60s --headless
```

### High Volume Test
Test with high-frequency event users:
```bash
locust -f locustfile.py HighVolumeEventSinkUser --host=http://localhost:3000 --users 50 --spawn-rate 5 --run-time 120s --headless
```

### Error Testing
Test error handling with invalid events:
```bash
locust -f locustfile.py InvalidEventUser --host=http://localhost:3000 --users 5 --spawn-rate 1 --run-time 60s --headless
```

### Mixed Load Test
Run all user types simultaneously:
```bash
locust -f locustfile.py EventSinkUser,HighVolumeEventSinkUser,InvalidEventUser --host=http://localhost:3000
```

## Test Scenarios

### EventSinkUser (Default)
Simulates normal user behavior with realistic event sequences:
- **Init Event**: Session initialization (once per user)
- **Metadata Event**: Content information
- **Heartbeat Events**: Most frequent, tracks playback progress
- **Playback Events**: playing, paused, buffering, seeking, etc.
- **Loading Events**: content loading states
- **Error/Warning Events**: occasional error scenarios
- **CORS Testing**: OPTIONS requests
- **Invalid Endpoint Testing**: 404 handling

### HighVolumeEventSinkUser
High-frequency event sender for stress testing:
- Rapid heartbeat events (0.1-0.5 second intervals)
- Useful for testing queue performance under load

### InvalidEventUser
Tests error handling and validation:
- Malformed JSON payloads
- Missing required fields
- Invalid event types
- Validates 400 error responses

## Event Types Tested

The load test covers all supported event types:
- `init` - Session initialization
- `metadata` - Content metadata
- `heartbeat` - Playback progress tracking
- `loading` - Content loading started
- `loaded` - Content loading completed
- `playing` - Playback started
- `paused` - Playback paused
- `buffering` - Buffer underrun
- `buffered` - Buffer recovered
- `seeking` - Seek operation started
- `seeked` - Seek operation completed
- `bitrate_changed` - Quality change
- `error` - Error conditions
- `warning` - Warning conditions
- `stopped` - Session ended

## Monitoring

When running tests, monitor:

1. **Response Times**: Track API response latency
2. **Error Rates**: Watch for 4xx/5xx responses
3. **Throughput**: Events processed per second
4. **Queue Performance**: If using SQS, monitor queue metrics
5. **Server Resources**: CPU, memory, and network usage

## Configuration

### Environment Variables
Make sure your eventsink service has the following configured:
- `PORT`: Service port (default: 3000)
- Queue configuration (SQS credentials, etc.)

### Locust Parameters
- `--users`: Number of concurrent users
- `--spawn-rate`: Users spawned per second
- `--run-time`: Test duration (e.g., 60s, 5m)
- `--headless`: Run without web UI
- `--csv`: Save results to CSV files

## Example Commands

```bash
# Basic web UI test
locust -f locustfile.py --host=http://localhost:3000

# Stress test with 100 users
locust -f locustfile.py --host=http://localhost:3000 --users 100 --spawn-rate 10 --run-time 300s --headless --csv=results

# Test specific user type
locust -f locustfile.py HighVolumeEventSinkUser --host=http://localhost:3000 --users 20 --spawn-rate 2 --headless

# Test against remote server
locust -f locustfile.py --host=https://your-eventsink.example.com --users 50 --spawn-rate 5 --run-time 180s --headless
```

## Output

Results will show:
- Request statistics (avg, min, max response times)
- Failure rates and error messages
- Requests per second
- Response size statistics

When using `--csv`, detailed results are saved to CSV files for further analysis.