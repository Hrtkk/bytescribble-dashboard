// @problem-runtime/vm — the Execution VM (RFC-006): runs an executable
// problem through the op registry, emitting execution_trace.v1 —
// micro-grain, 100% deterministic, NOTHING model-authored. Executor
// versions and resolved op versions are pinned into every step (replay).

const EXECUTOR = { kind: 'evaluator', id: 'arith-eval', version: '0.1.0', determinism: 'strict' };

export function executeProgram(executable, problem, opRegistries) {
  const givens = Object.fromEntries(problem.given.map((g) => [g.id, g.payload.int]));
  const outputs = {};
  const steps = [];

  for (const node of executable.program) {
    const reg = opRegistries.find((r) => r.registry === node.registry);
    if (!reg) throw new Error(`registry not loaded: ${node.registry}`);
    const pinned = executable.registries[node.registry];
    if (reg.version !== pinned) {
      throw new Error(`lockfile mismatch: ${node.registry} pinned ${pinned}, loaded ${reg.version}`);
    }
    const op = reg.ops[node.opcode];
    if (!op) throw new Error(`unknown opcode ${node.registry}/${node.opcode}`);

    const inputs = node.args.map((ref) => ({
      ref,
      value: ref in givens ? givens[ref] : outputs[ref],
    }));
    const values = inputs.map((i) => i.value);

    const errs = op.validate(values);
    if (errs.length) throw new Error(`validate(${node.opcode}) failed: ${errs.join('; ')}`);

    const output = op.execute(values);                    // THE EVALUATOR COMPUTES
    outputs[node.out] = output.value;

    steps.push({
      step_id: `s${steps.length + 1}`,
      node_ref: node.node_id,
      registry: node.registry,
      opcode: node.opcode,
      op_version: op.version,                             // RESOLVED (RFC-007)
      inputs,
      output,
      justification: op.justification,
      executor: { ...EXECUTOR },
      checks: ['answer_correct'],
      misconception_tags: [],
    });
  }

  return {
    trace_id: `tr-${executable.exec_id}`,
    exec_ref: executable.exec_id,
    steps,
    verification: { status: 'quarantined', assertions: { passed: 0, total: 0, names: [] }, key_reconciliation: null, discrepancies: [], versions: {} },
    _outputs: outputs, // internal: final results by out-ref (stripped at boundary)
  };
}
