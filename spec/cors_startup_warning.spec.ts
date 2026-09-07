import { warnIfCorsAllowlistUnset } from '../services/fastify';
import Logger from '../logging/logger';

describe('CORS startup warning (#77)', () => {
  const hadCorsEnv = Object.prototype.hasOwnProperty.call(
    process.env,
    'CORS_ALLOWED_ORIGINS',
  );
  const originalCors = process.env.CORS_ALLOWED_ORIGINS;

  afterEach(() => {
    // This repo's tests delete env vars rather than set them to undefined.
    if (hadCorsEnv) {
      process.env.CORS_ALLOWED_ORIGINS = originalCors;
    } else {
      delete process.env.CORS_ALLOWED_ORIGINS;
    }
  });

  it('emits a Logger.warn when CORS_ALLOWED_ORIGINS is unset', () => {
    const warnSpy = spyOn(Logger, 'warn');
    delete process.env.CORS_ALLOWED_ORIGINS;

    warnIfCorsAllowlistUnset();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.calls.argsFor(0)[0]).toContain('CORS_ALLOWED_ORIGINS');
    expect(warnSpy.calls.argsFor(0)[0]).toContain('*');
  });

  it('emits a Logger.warn when CORS_ALLOWED_ORIGINS is empty/whitespace', () => {
    const warnSpy = spyOn(Logger, 'warn');
    process.env.CORS_ALLOWED_ORIGINS = '   ';

    warnIfCorsAllowlistUnset();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('emits nothing when CORS_ALLOWED_ORIGINS is set to a non-empty value', () => {
    const warnSpy = spyOn(Logger, 'warn');
    process.env.CORS_ALLOWED_ORIGINS = 'https://trusted.example.com';

    warnIfCorsAllowlistUnset();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
