import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { grade, type EvalCase } from '../scripts/eval-grade.js';

const cases = JSON.parse(readFileSync(new URL('../evals/questions.json', import.meta.url), 'utf8')) as EvalCase[];

describe('eval questions', () => {
  it('are well formed with unique ids and at least one check each', () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) {
      expect(c.question.length).toBeGreaterThan(5);
      expect(Boolean(c.includesAny?.length || c.excludes?.length || c.excludesPattern)).toBe(true);
      if (c.excludesPattern) expect(() => new RegExp(c.excludesPattern!)).not.toThrow();
    }
  });
});

describe('grade', () => {
  const c: EvalCase = { id: 'x', question: 'q', includesAny: ['Amazon'], excludes: ['@gmail'], excludesPattern: '\\d{3}-\\d{4}' };

  it('passes a good answer', () => {
    expect(grade(c, 'He works at Amazon.')).toEqual([]);
  });

  it('flags missing facts, leaked details, and empty answers', () => {
    expect(grade(c, 'He works somewhere.')).toHaveLength(1);
    expect(grade(c, 'Amazon, email x@gmail.com')).toEqual(['should not contain: @gmail']);
    expect(grade(c, 'Amazon, call 555-1234')).toHaveLength(1);
    expect(grade(c, '   ')).toContain('empty answer');
  });
});
