import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getServerEnv, getServerEnvOrWarn, resetServerEnvWarnings } from '../env';

describe('getServerEnv', () => {
  const KEY = 'ZERION_API_KEY';
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env[KEY];
    resetServerEnvWarnings();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it('returns the value when set', () => {
    process.env[KEY] = 'abc123';
    expect(getServerEnv().ZERION_API_KEY).toBe('abc123');
  });

  it('treats unset vars as undefined', () => {
    delete process.env[KEY];
    expect(getServerEnv().ZERION_API_KEY).toBeUndefined();
  });

  it('treats blank and whitespace-only strings as unset', () => {
    process.env[KEY] = '';
    expect(getServerEnv().ZERION_API_KEY).toBeUndefined();
    process.env[KEY] = '   ';
    expect(getServerEnv().ZERION_API_KEY).toBeUndefined();
  });

  it('reflects runtime mutations of process.env (no caching)', () => {
    delete process.env[KEY];
    expect(getServerEnv().ZERION_API_KEY).toBeUndefined();
    process.env[KEY] = 'later';
    expect(getServerEnv().ZERION_API_KEY).toBe('later');
  });
});

describe('getServerEnvOrWarn', () => {
  const KEY = 'ONEINCH_API_KEY';
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env[KEY];
    resetServerEnvWarnings();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
    vi.restoreAllMocks();
  });

  it('returns the value without warning when set', () => {
    process.env[KEY] = 'key';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getServerEnvOrWarn('ONEINCH_API_KEY', 'swaps unavailable')).toBe('key');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns exactly once per key when unset', () => {
    delete process.env[KEY];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getServerEnvOrWarn('ONEINCH_API_KEY', 'swaps unavailable')).toBeUndefined();
    expect(getServerEnvOrWarn('ONEINCH_API_KEY', 'swaps unavailable')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('ONEINCH_API_KEY');
    expect(warn.mock.calls[0][0]).toContain('swaps unavailable');
  });
});
