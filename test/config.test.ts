import { describe, expect, it } from 'vitest';
import { loadConfig } from '../lib/config.js';

describe('loadConfig', () => {
  it('uses safe defaults when nothing is set', () => {
    const config = loadConfig({});
    expect(config.databaseUrl).toBeUndefined();
    expect(config.cronSecret).toBeUndefined();
    expect(config.retentionDays).toBe(90);
  });

  it('reads values and ignores invalid numbers', () => {
    expect(loadConfig({ RETENTION_DAYS: '30' }).retentionDays).toBe(30);
    expect(loadConfig({ RETENTION_DAYS: 'soon' }).retentionDays).toBe(90);
    expect(loadConfig({ RETENTION_DAYS: '-5' }).retentionDays).toBe(90);
    expect(loadConfig({ RETENTION_DAYS: '0' }).retentionDays).toBe(1);
    expect(loadConfig({ DATABASE_URL: '' }).databaseUrl).toBeUndefined();
  });
});
