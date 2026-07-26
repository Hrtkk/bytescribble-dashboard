// math.basic — the M0 operation registry (RFC-006 §3, RFC-007 §3).
// Each op implements the seven-method interface. validate/execute/verify are
// deterministic code and ONLY code; render/explain/ghost produce content
// (template-driven at M0 — no model anywhere in this file, ever).

const int = (v) => Number.isInteger(v);

function makeOp({ opcode, symbol, justification, validate, compute, explain, renderLine }) {
  return {
    opcode,
    symbol,
    version: '1.0.0',
    justification,
    // validate(values) -> [] | [error strings]   (RFC-006: deterministic)
    validate(values) {
      const errs = [];
      if (values.length !== 2) errs.push(`${opcode} expects 2 operands, got ${values.length}`);
      for (const v of values) if (!int(v)) errs.push(`${opcode} operand not an integer: ${v}`);
      if (validate) errs.push(...validate(values));
      return errs;
    },
    // execute(values) -> {value}                 (RFC-006: evaluator computes, always)
    execute(values) {
      return { value: compute(values) };
    },
    // verify(values, output) -> boolean          (re-derivation — the verifier's hook)
    verify(values, output) {
      return this.validate(values).length === 0 && compute(values) === output.value;
    },
    // render(step) -> board write payload        (content: template)
    render(step) {
      const [a, b] = step.inputs.map((i) => i.value);
      return renderLine
        ? renderLine(a, b, step.output.value)
        : `${a} ${symbol} ${b} = ${step.output.value}`;
    },
    // explain(step) -> narration text            (content: template; reviewable downstream)
    explain(step) {
      const [a, b] = step.inputs.map((i) => i.value);
      return explain(a, b, step.output.value);
    },
    // ghost(step) -> the Tab affordance's ink    (derived from render, RFC-006 §3)
    ghost(step) {
      return String(step.output.value);
    },
  };
}

export const MATH_BASIC = {
  registry: 'math.basic',
  version: '1.0.0',
  ops: {
    ADD: makeOp({
      opcode: 'ADD',
      symbol: '+',
      justification: ['integer', 'closed_under_addition'],
      compute: ([a, b]) => a + b,
      explain: (a, b, v) => `We are combining ${a} and ${b}. Counting on from ${a}: ${b} more gives ${v}.`,
    }),
    SUB: makeOp({
      opcode: 'SUB',
      symbol: '−',
      justification: ['integer', 'closed_under_subtraction'],
      compute: ([a, b]) => a - b,
      explain: (a, b, v) => `Taking ${b} away from ${a} leaves ${v}.`,
    }),
    MULTIPLY: makeOp({
      opcode: 'MULTIPLY',
      symbol: '×',
      justification: ['integer', 'closed_under_multiplication'],
      compute: ([a, b]) => a * b,
      explain: (a, b, v) => `${a} groups of ${b}: skip-counting ${b}s, ${a} times, gives ${v}.`,
    }),
    DIVIDE: makeOp({
      opcode: 'DIVIDE',
      symbol: '÷',
      justification: ['integer', 'exact_division'],
      // M0 refuses non-exact division honestly rather than inventing decimals.
      validate: ([a, b]) => {
        const errs = [];
        if (b === 0) errs.push('division by zero');
        else if (a % b !== 0) errs.push(`M0 exact_division: ${a} is not divisible by ${b}`);
        return errs;
      },
      compute: ([a, b]) => a / b,
      explain: (a, b, v) => `Splitting ${a} into groups of ${b}: that makes ${v} groups.`,
    }),
  },
};
