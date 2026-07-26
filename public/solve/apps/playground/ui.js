// Solve Desk DOM — built from JS (no framework, no build step).
const el = (tag, attrs = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v);
  }
  for (const c of children) n.append(c);
  return n;
};

export function buildUI() {
  const header = el('header', {}, [
    el('h1', { html: 'Solve Desk <span style="opacity:.6;font-weight:400">M0</span>' }),
    el('input', { id: 'problem-input', placeholder: 'e.g. 2+3', value: '2+3' }),
    el('button', { id: 'solve', text: 'Solve' }),
    ...['2+3', '7×4', '15−9', '9÷3'].map((p) => el('button', { class: 'quick', 'data-p': p, text: p })),
  ]);

  const askBox = el('div', { id: 'ask' }, [
    el('div', { class: 'box' }, [
      el('div', { style: 'margin-bottom:8px', html: 'I couldn’t read that confidently. <b>What did you write?</b>' }),
      el('input', { id: 'ask-value', type: 'number' }),
      el('button', { id: 'ask-ok', text: 'Check it' }),
      el('div', { class: 'note', text: 'low-confidence lift → ASK, per the contract — never a silent guess' }),
    ]),
  ]);

  const main = el('main', {}, [
    el('section', {}, [
      el('div', { id: 'board-wrap' }, [
        el('canvas', { id: 'board' }),
        el('div', { id: 'chip' }),
        askBox,
      ]),
      el('div', { id: 'controls' }, [
        el('button', { id: 'check', text: 'Check ✓' }),
        el('button', { id: 'hint', text: '💡 Hint' }),
        el('button', { id: 'ghost', html: 'Ghost step <kbd>Tab</kbd>' }),
        el('button', { id: 'watch', disabled: '', title: 'post_attempt policy: try first', text: 'Watch solution' }),
        el('button', { id: 'replay', text: 'Replay ink' }),
        el('button', { id: 'session', text: 'Replay session' }),
        el('button', { id: 'erase', text: 'Erase last' }),
      ]),
    ]),
    el('aside', {}, [
      el('div', { class: 'panel' }, [el('h2', { text: 'Step explainer' }), el('div', { id: 'explainer', text: 'Solve a problem, then tap the written step.' })]),
      el('div', { class: 'panel' }, [el('h2', { text: 'Event console' }), el('div', { id: 'console' })]),
    ]),
  ]);

  document.body.prepend(header, main);
  const $ = (id) => document.getElementById(id);
  return {
    input: $('problem-input'), solveBtn: $('solve'), quick: [...document.querySelectorAll('.quick')],
    board: $('board'), chip: $('chip'), ask: $('ask'), askValue: $('ask-value'), askOk: $('ask-ok'),
    checkBtn: $('check'), hintBtn: $('hint'), ghostBtn: $('ghost'), watchBtn: $('watch'),
    replayBtn: $('replay'), sessionBtn: $('session'), eraseBtn: $('erase'), explainer: $('explainer'), consoleEl: $('console'),
  };
}
