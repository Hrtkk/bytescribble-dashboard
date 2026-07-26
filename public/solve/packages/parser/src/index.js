// @problem-runtime/parser — surface form → problem.v1 (RFC-002 stage: PARSER).
// Domain-blind: routes by the problem-class registry; enforces NO INVENTED
// GIVENS (every numeric given must appear verbatim at its cited span).

let seq = 0;
const nextId = (surface) => `pr-${surface.replace(/[^0-9a-zA-Z]+/g, '')}-${++seq}`;

export function parseProblem(surface, problemClasses) {
  const cls = problemClasses.find((c) => c.match(surface));
  if (!cls) {
    return { ok: false, error: `no registered problem class matches: ${JSON.stringify(surface)}` };
  }
  const problem = cls.parse(surface, { problemId: nextId(surface) });
  if (!problem) return { ok: false, error: 'class matched but failed to parse' };

  // THE SPAN GATE (RFC-005 §2.2): every given's span must reproduce its value.
  for (const g of problem.given) {
    const [a, b] = g.span;
    const cited = problem.statement.slice(a, b);
    const value = g.payload?.int;
    if (value !== undefined && cited !== String(value)) {
      return { ok: false, error: `NO INVENTED GIVENS: ${g.id} cites ${JSON.stringify(cited)} but carries ${value}` };
    }
  }
  return { ok: true, problem, cls };
}
