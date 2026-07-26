// arithmetic_single — the M0 problem class (RFC-002 §2 registry entry).
// Owns: surface matching, span-cited parsing (NO INVENTED GIVENS), the
// canonical form, and the lowering map from surface symbols to operations.

const SYMBOL_TO_OPCODE = {
  '+': 'ADD',
  '-': 'SUB',
  '−': 'SUB',
  '×': 'MULTIPLY',
  'x': 'MULTIPLY',
  '*': 'MULTIPLY',
  '÷': 'DIVIDE',
  '/': 'DIVIDE',
};

const CANONICAL_NAME = { ADD: 'add', SUB: 'sub', MULTIPLY: 'mul', DIVIDE: 'div' };

// M0 accepts 1–2 digit non-negative integers (the founder's M0 set includes 15−9).
const PATTERN = /^\s*(\d{1,2})\s*([+\-−×x*÷/])\s*(\d{1,2})\s*=?\s*$/;

export const ARITHMETIC_SINGLE = {
  problem_class: 'arithmetic_single',
  domain: 'arithmetic',
  registry: 'math.basic',

  match(surface) {
    return PATTERN.test(surface);
  },

  // surface -> problem.v1 (spans cite the statement — checked by the kernel parser)
  parse(surface, { problemId }) {
    const m = PATTERN.exec(surface);
    if (!m) return null;
    const statement = surface;
    const [, aRaw, sym, bRaw] = m;
    const aStart = surface.indexOf(aRaw);
    const symStart = surface.indexOf(sym, aStart + aRaw.length);
    const bStart = surface.indexOf(bRaw, symStart + sym.length);
    return {
      problem_id: problemId,
      problem_class: 'arithmetic_single',
      source: { kind: 'text', surface },
      statement,
      given: [
        { id: 'g1', kind: 'operand', span: [aStart, aStart + aRaw.length], payload: { int: Number(aRaw) }, status: 'known' },
        { id: 'g2', kind: 'operand', span: [bStart, bStart + bRaw.length], payload: { int: Number(bRaw) }, status: 'known' },
      ],
      required_out: [{ id: 'r1', deliverable: 'numeric_answer' }],
      answer_key: null,
      grounding_refs: [],
      domain: 'arithmetic',
      _symbol: sym, // class-internal; stripped before the contract boundary
    };
  },

  // problem -> canonical form (deterministic, versioned — RFC-003 §2)
  canonicalize(problem) {
    const opcode = SYMBOL_TO_OPCODE[problem._symbol];
    const [a, b] = problem.given.map((g) => g.payload.int);
    return {
      form: `${CANONICAL_NAME[opcode]}(${a},${b})`,
      opcode,
      normalizer_version: '0.1.0',
      surface_map: { g1: problem.given[0].span, g2: problem.given[1].span },
    };
  },
};
