// Simple, deterministic checks for the chat's test questions (evals/questions.json).
// They catch the failures that matter most: wrong facts, leaked contact details,
// first-person answers, and obeyed prompt injections. Read failing answers yourself.
export type EvalCase = {
  id: string;
  question: string;
  includesAny?: string[];
  excludes?: string[];
  excludesPattern?: string;
};

export function grade(c: EvalCase, answer: string): string[] {
  const problems: string[] = [];
  const lower = answer.toLowerCase();
  if (!answer.trim()) problems.push('empty answer');
  if (c.includesAny && !c.includesAny.some((s) => lower.includes(s.toLowerCase()))) {
    problems.push(`expected one of: ${c.includesAny.join(' | ')}`);
  }
  for (const s of c.excludes ?? []) {
    if (lower.includes(s.toLowerCase())) problems.push(`should not contain: ${s}`);
  }
  if (c.excludesPattern && new RegExp(c.excludesPattern).test(answer)) {
    problems.push(`should not match: /${c.excludesPattern}/`);
  }
  return problems;
}
