/**
 * Benchmark: AJV Validator performance
 * Run from repo root: npx ts-node benchmark-validator.ts
 *
 * Measures validation throughput for the Validator class.
 * Compare results between main (uncached) and the PR branch (cached).
 */
import Logger from './logging/logger';
import { Validator } from './lib/Validator';

// Suppress winston output during benchmark
Logger.silent = true;

const validEvents = [
  { event: 'init', sessionId: 'bench-001', timestamp: Date.now(), playhead: -1, duration: -1 },
  { event: 'playing', sessionId: 'bench-001', timestamp: Date.now(), playhead: 0, duration: 120 },
  { event: 'heartbeat', sessionId: 'bench-001', timestamp: Date.now(), playhead: 10, duration: 120 },
  { event: 'buffering', sessionId: 'bench-001', timestamp: Date.now(), playhead: 15, duration: 120 },
  { event: 'metadata', sessionId: 'bench-001', timestamp: Date.now(), playhead: 0, duration: 120, payload: { live: false, contentTitle: 'Benchmark Video', deviceType: 'desktop' } },
];

const invalidEvents = [
  { event: 'heartbeat', sessionId: 'bench-001', timestamp: Date.now() }, // missing playhead, duration
  { event: 'unknown_event', sessionId: 'bench-001', timestamp: Date.now(), playhead: 0, duration: 0 },
  {},
];

const ITERATIONS = 1000;

function runBenchmark(label: string, iterations: number, events: any[]) {
  const validator = new Validator(Logger);

  // Warm up (1 call)
  validator.validateEvent(events[0]);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const event of events) {
      validator.validateEvent(event);
    }
  }
  const elapsed = performance.now() - start;
  const totalCalls = iterations * events.length;
  const avgMs = elapsed / totalCalls;
  const opsPerSec = Math.round(1000 / avgMs);

  console.log(`${label}:`);
  console.log(`  Total calls: ${totalCalls}`);
  console.log(`  Total time:  ${elapsed.toFixed(1)}ms`);
  console.log(`  Avg per call: ${avgMs.toFixed(3)}ms`);
  console.log(`  Throughput:  ${opsPerSec.toLocaleString()} validations/sec`);
  console.log();

  return { totalCalls, elapsed, avgMs, opsPerSec };
}

console.log('=== AJV Validator Benchmark ===\n');

const validResult = runBenchmark('Valid events', ITERATIONS, validEvents);
const invalidResult = runBenchmark('Invalid events', ITERATIONS, invalidEvents);

const mixedEvents = [...validEvents, ...invalidEvents];
const mixedResult = runBenchmark('Mixed (valid + invalid)', ITERATIONS, mixedEvents);

console.log('--- Summary ---');
console.log(`Valid:   ${validResult.opsPerSec.toLocaleString()} ops/sec (${validResult.avgMs.toFixed(3)}ms/call)`);
console.log(`Invalid: ${invalidResult.opsPerSec.toLocaleString()} ops/sec (${invalidResult.avgMs.toFixed(3)}ms/call)`);
console.log(`Mixed:   ${mixedResult.opsPerSec.toLocaleString()} ops/sec (${mixedResult.avgMs.toFixed(3)}ms/call)`);
