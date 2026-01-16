# Memory Queue Feature

The memory queue feature is **enabled by default** and allows the event sink to provide immediate responses to clients while processing events in the background, reducing load on the primary queue system and improving response times.

## How it works

1. **Immediate Response**: When enabled, events are immediately added to an in-memory queue and clients receive an instant response
2. **Background Processing**: A background processor continuously drains events from memory to the configured queue (SQS, Redis, Beanstalkd)
3. **Batching**: Events are processed in batches to improve throughput
4. **Error Handling**: Failed events are retried with exponential backoff
5. **Graceful Shutdown**: On application shutdown, all pending events are flushed to ensure no data loss

## Configuration

The memory queue is **enabled by default**. You can disable it if needed:

### Basic Configuration

```bash
# Disable memory queue (enabled by default)
DISABLE_MEMORY_QUEUE=true

# Queue type (required)
QUEUE_TYPE=SQS  # or redis, beanstalkd
```

### Advanced Configuration

```bash
# Maximum number of events in memory queue (default: 10000)
MEMORY_QUEUE_MAX_SIZE=10000

# Number of events to process per batch (default: 50)
MEMORY_QUEUE_BATCH_SIZE=50

# Interval between batch processing in milliseconds (default: 2000)
MEMORY_QUEUE_DRAIN_INTERVAL=2000

# Maximum retry attempts for failed events (default: 3)
MEMORY_QUEUE_MAX_RETRIES=3

# Overflow strategy when queue is full (default: drop-oldest)
# Options: drop-oldest, drop-newest, reject
MEMORY_QUEUE_OVERFLOW_STRATEGY=drop-oldest

# Throttling and Rate Limiting Configuration
# Delay between individual events within a batch in milliseconds (default: 20)
MEMORY_QUEUE_EVENT_DELAY_MS=20

# Enable adaptive throttling based on response times (default: true)
MEMORY_QUEUE_ADAPTIVE_THROTTLING=true

# Maximum concurrent drain operations (default: 3)
MEMORY_QUEUE_MAX_CONCURRENT=3
```

## Benefits

- **Improved Response Times**: Clients receive immediate acknowledgment instead of waiting for queue operations
- **Higher Throughput**: Batched processing improves overall throughput
- **Reduced Queue Load**: Background processing with retries reduces pressure on external queue systems
- **Fault Tolerance**: Failed events are automatically retried with configurable limits
- **Stress Management**: Intelligent throttling prevents overwhelming the underlying queue system

## Stress Reduction Features

The memory queue includes several mechanisms to prevent overwhelming the underlying queue system:

### 1. Rate Limiting

- **Event Delays**: Configurable delay between individual events within batches
- **Concurrent Limits**: Maximum number of simultaneous drain operations
- **Batch Processing**: Events processed in controlled batches rather than individually

### 2. Adaptive Throttling

- **Response Time Monitoring**: Tracks average response times from the underlying queue
- **Dynamic Adjustment**: Automatically increases delays when response times are high
- **Error Handling**: Significantly increases throttling delays when errors occur
- **Recovery**: Gradually reduces delays when performance improves

### 3. Throttling Behavior

- **Initial Delay**: 20ms between events (configurable)
- **High Response Time**: Delays increase by 5ms when avg response > 1000ms (max 100ms)
- **Good Performance**: Delays decrease by 2ms when avg response < 200ms
- **Error Conditions**: Delays increase by 20ms on errors (max 200ms)
- **Adaptive Range**: 20ms (base) to 200ms (maximum under stress)

## Monitoring

### Health Check Endpoint

```bash
GET /health
```

Response includes memory queue statistics:

```json
{
  "status": "ok",
  "timestamp": "2026-01-09T07:51:08.518Z",
  "memoryQueue": {
    "enabled": true,
    "queueSize": 150,
    "maxSize": 10000,
    "isProcessing": false,
    "oldestEventAge": 1250,
    "activeConcurrentOperations": 2,
    "maxConcurrentOperations": 3,
    "currentThrottleDelayMs": 25,
    "baseThrottleDelayMs": 20,
    "averageResponseTimeMs": 450,
    "adaptiveThrottling": true
  }
}
```

### Log Messages

- Queue operations are logged with timing information
- Overflow events are logged as warnings
- Failed events after max retries are logged as errors
- Graceful shutdown progress is logged

## Performance Considerations

- **Memory Usage**: The memory queue holds events in RAM. Monitor memory usage and adjust `MEMORY_QUEUE_MAX_SIZE` accordingly
- **Batch Size**: Larger batch sizes improve throughput but increase memory usage and processing latency
- **Drain Interval**: Lower intervals reduce latency but increase CPU usage
- **Overflow Strategy**:
  - `drop-oldest`: Prevents memory issues but may lose older events
  - `drop-newest`: Preserves older events but rejects new ones when full
  - `reject`: Fails requests when queue is full, falling back to direct queue operations

## Graceful Shutdown

When the application receives SIGTERM or SIGINT:

1. Stop accepting new requests
2. Flush all pending events from memory queue to the configured queue
3. Wait for all background processing to complete
4. Close the Fastify server
5. Clean up resources

## Fallback Behavior

If the memory queue encounters errors:

- Individual event failures fall back to direct queue operations
- Memory queue initialization failures disable the feature and use direct operations
- Queue overflow (when using `reject` strategy) falls back to direct operations

## Example Usage

### Docker Environment

```bash
# Memory queue enabled by default
docker run -e QUEUE_TYPE=SQS \
           -e MEMORY_QUEUE_MAX_SIZE=5000 \
           -e MEMORY_QUEUE_BATCH_SIZE=50 \
           your-event-sink-image

# Disable memory queue if needed
docker run -e DISABLE_MEMORY_QUEUE=true \
           -e QUEUE_TYPE=SQS \
           your-event-sink-image
```

### Environment File

```bash
# .env - Memory queue enabled by default
QUEUE_TYPE=SQS
MEMORY_QUEUE_MAX_SIZE=10000
MEMORY_QUEUE_BATCH_SIZE=50
MEMORY_QUEUE_DRAIN_INTERVAL=2000

# To disable memory queue
# DISABLE_MEMORY_QUEUE=true
```

## Backward Compatibility

The memory queue feature is now enabled by default but can be disabled. When `DISABLE_MEMORY_QUEUE=true`:

- All functionality reverts to the previous behavior
- No memory queue is created
- Direct queue operations are used
- All existing tests continue to pass

This ensures that existing deployments can easily disable the feature if needed while new deployments benefit from improved performance by default.
