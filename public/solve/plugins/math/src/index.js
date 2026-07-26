// @problem-runtime/plugin-math — M0 surface: one op registry, one problem class.
// A plugin is registrations, nothing else (RFC-002 §2).
export { MATH_BASIC } from './registry.js';
export { ARITHMETIC_SINGLE } from './arithmetic-single.js';

export const mathPlugin = {
  name: 'math',
  opRegistries: [/* filled below to avoid circular import cost */],
  problemClasses: [],
};

import { MATH_BASIC as _ops } from './registry.js';
import { ARITHMETIC_SINGLE as _cls } from './arithmetic-single.js';
mathPlugin.opRegistries.push(_ops);
mathPlugin.problemClasses.push(_cls);
