// @problem-runtime/graph — the compiler back-end (RFC-006 §2.1):
// canonical form → executable_problem.v1 (dependency graph + symbolic opcode
// program + registries LOCKFILE, RFC-007 §3). No values, no pedagogy.

export function compileExecutable(problem, canonical, cls, opRegistries) {
  const reg = opRegistries.find((r) => r.registry === cls.registry);
  if (!reg) throw new Error(`op registry not registered: ${cls.registry}`);
  const op = reg.ops[canonical.opcode];
  if (!op) throw new Error(`opcode ${canonical.opcode} not in ${reg.registry}`);

  return {
    exec_id: `ep-${problem.problem_id}`,
    problem_ref: problem.problem_id,
    method: 'default',
    registries: { [reg.registry]: reg.version },          // the lockfile
    dependency_graph: {
      nodes: [{ id: 'n1', kind: 'operation', requires: [], produces: 'r1' }],
    },
    program: [
      { node_id: 'n1', registry: reg.registry, opcode: canonical.opcode, args: ['g1', 'g2'], out: 'r1' },
    ],
    compiler_version: '0.1.0',
  };
}
