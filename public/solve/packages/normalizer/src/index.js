// @problem-runtime/normalizer — problem.v1 → canonical form (RFC-002 stage:
// NORMALIZER). Delegates to the problem class's deterministic canonicalizer;
// keeps the surface map so the runtime always talks the way the student wrote.

export function normalize(problem, cls) {
  const canonical = cls.canonicalize(problem);
  if (!canonical || !canonical.form) throw new Error(`canonicalize failed for ${problem.problem_id}`);
  return canonical;
}
