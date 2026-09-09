import { generateInvalidResponseBody } from '../lib/route-helpers';

// Unit proof for #86: generateInvalidResponseBody must keep `sessionId` typed
// as a string for every input shape. The previous `|| -1` fallback replaced any
// falsy-but-present value (notably a legitimate empty-string sessionId) with the
// number -1, violating the responseBody contract (`sessionId: string`).

describe('generateInvalidResponseBody sessionId handling (#86)', () => {
  it('passes a normal sessionId through unchanged', () => {
    const body = generateInvalidResponseBody({ sessionId: '123-214-234' });
    expect(body.sessionId).toEqual('123-214-234');
    expect(typeof body.sessionId).toEqual('string');
    expect(body.valid).toBe(false);
  });

  it('echoes a present-but-empty-string sessionId back as "" (never -1)', () => {
    const body = generateInvalidResponseBody({ sessionId: '' });
    expect(body.sessionId).toEqual('');
    expect(typeof body.sessionId).toEqual('string');
  });

  it('falls back to an empty string when sessionId is missing', () => {
    const body = generateInvalidResponseBody({});
    expect(body.sessionId).toEqual('');
    expect(typeof body.sessionId).toEqual('string');
  });

  it('falls back to an empty string when no event is supplied', () => {
    const body = generateInvalidResponseBody();
    expect(body.sessionId).toEqual('');
    expect(typeof body.sessionId).toEqual('string');
  });

  it('never emits sessionId as a number for any covered input shape', () => {
    for (const event of [
      { sessionId: 'abc' },
      { sessionId: '' },
      {},
      undefined,
    ]) {
      const body = generateInvalidResponseBody(event);
      expect(typeof body.sessionId).toEqual('string');
    }
  });
});
