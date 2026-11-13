/* ChargeFlow business rules + a small, real mutation-testing engine (PIT-style).
   The rules are a JavaScript port of the Kotlin ReservationRules used in the project.
   Everything here runs for real in the browser: mutants are generated from the source
   text, compiled, and executed against the JUnit-style test suite. */
(function () {
  const CF = (window.CF = window.CF || {});

  // ---------------------------------------------------------------- rules
  CF.RULES = [
    {
      id: 'priorityFor', title: 'Low-battery priority', params: ['battery'],
      desc: 'Drivers at 20% battery or less get HIGH priority in the queue.',
      src:
`function priorityFor(battery) {
  if (battery <= 20) {
    return "HIGH";
  }
  return "NORMAL";
}`,
      candidates: () => range(-5, 105).map(b => [b]),
    },
    {
      id: 'tariffFor', title: 'Dynamic peak tariff', params: ['base', 'load'],
      desc: 'When station load reaches 80% or more, ₹2.80/kWh is added to the base rate.',
      src:
`function tariffFor(base, load) {
  if (load >= 80) {
    return base + 2.8;
  }
  return base;
}`,
      candidates: () => [12.4, 13.1].flatMap(b => range(0, 100).map(l => [b, l])),
    },
    {
      id: 'validateBattery', title: 'Battery input validation', params: ['level'],
      desc: 'Battery level must be an integer from 0 to 100 inclusive.',
      src:
`function validateBattery(level) {
  if (level < 0 || level > 100) {
    return false;
  }
  return true;
}`,
      candidates: () => range(-5, 105).map(b => [b]),
    },
    {
      id: 'validateDuration', title: 'Session duration', params: ['mins'],
      desc: 'Bookings run 15 to 120 minutes, in 15-minute blocks.',
      src:
`function validateDuration(mins) {
  if (mins < 15 || mins > 120) {
    return false;
  }
  return mins % 15 == 0;
}`,
      candidates: () => range(0, 180).map(m => [m]),
    },
    {
      id: 'costFor', title: 'Cost estimate', params: ['kw', 'mins', 'rate'],
      desc: 'Energy (kW × hours) × rate, rounded to the paisa.',
      src:
`function costFor(kw, mins, rate) {
  const kwh = kw * mins / 60;
  return Math.round(kwh * rate * 100) / 100;
}`,
      candidates: () => {
        const out = [];
        for (const kw of [7, 22, 50]) for (const m of [15, 30, 45, 60, 90, 120]) for (const r of [12.4, 13.1, 15.2]) out.push([kw, m, r]);
        return out;
      },
    },
    {
      id: 'canReserve', title: 'Reservation guard', params: ['slot', 'activeBookings'],
      desc: 'Offline or occupied chargers cannot be booked, and a driver may hold only one booking.',
      src:
`function canReserve(slot, activeBookings) {
  if (slot.offline) {
    return false;
  }
  if (slot.occupied) {
    return false;
  }
  return activeBookings == 0;
}`,
      candidates: () => {
        const out = [];
        for (const off of [false, true]) for (const occ of [false, true]) for (const a of [0, 1, 2]) out.push([{ offline: off, occupied: occ }, a]);
        return out;
      },
    },
  ];
  CF.rule = id => CF.RULES.find(r => r.id === id);

  // ---------------------------------------------------------------- defects (for the app / runner)
  CF.DEFECTS = {
    none: { label: 'No defect (correct build)' },
    priority_boundary: { label: 'Battery priority off-by-one (< 20)', rule: 'priorityFor', find: 'battery <= 20', replace: 'battery < 20' },
    tariff_boundary: { label: 'Peak tariff boundary (> 80)', rule: 'tariffFor', find: 'load >= 80', replace: 'load > 80' },
    occupied_guard: { label: 'Occupied-slot guard removed', rule: 'canReserve', find: 'if (slot.occupied)', replace: 'if (false)' },
    battery_range: { label: 'Battery accepts 101%', rule: 'validateBattery', find: 'level > 100', replace: 'level > 101' },
    duration_range: { label: 'Duration allows 150 min', rule: 'validateDuration', find: 'mins > 120', replace: 'mins > 150' },
  };

  CF.compile = function (src) {
    // eslint-disable-next-line no-new-func
    return new Function('"use strict"; return (' + src + ');')();
  };
  CF.sourceWithDefect = function (ruleId, defectId) {
    const r = CF.rule(ruleId), d = CF.DEFECTS[defectId];
    if (d && d.rule === ruleId) return r.src.replace(d.find, d.replace);
    return r.src;
  };
  CF.buildRules = function (defectId) {
    const o = {};
    for (const r of CF.RULES) o[r.id] = CF.compile(CF.sourceWithDefect(r.id, defectId || 'none'));
    return o;
  };

  let tid = 0;
  // ---------------------------------------------------------------- default JUnit suite (deliberately has gaps)
  CF.DEFAULT_TESTS = [
    t('priorityFor', [19], 'HIGH', 'priority is HIGH at 19%'),
    t('priorityFor', [21], 'NORMAL', 'priority is NORMAL at 21%'),
    t('priorityFor', [5], 'HIGH', 'priority is HIGH at 5%'),
    t('tariffFor', [12.4, 80], 15.2, 'peak tariff at exactly 80% load'),
    t('tariffFor', [12.4, 50], 12.4, 'base tariff at 50% load'),
    t('validateBattery', [-1], false, 'battery -1 is rejected'),
    t('validateBattery', [50], true, 'battery 50 is accepted'),
    t('validateBattery', [101], false, 'battery 101 is rejected'),
    t('validateDuration', [10], false, '10 min is too short'),
    t('validateDuration', [30], true, '30 min is valid'),
    t('validateDuration', [25], false, '25 min is not a 15-min block'),
    t('validateDuration', [150], false, '150 min is too long'),
    t('costFor', [7, 60, 12.4], 86.8, '7 kW for 60 min at ₹12.40'),
    t('costFor', [22, 60, 13.1], 288.2, '22 kW for 60 min at ₹13.10'),
    t('canReserve', [{ offline: false, occupied: false }, 0], true, 'free charger can be reserved'),
    t('canReserve', [{ offline: false, occupied: true }, 0], false, 'occupied charger is rejected'),
  ];
  function t(rule, args, expect, name) { return { id: 'T' + (++tid), rule, args, expect, name, enabled: true }; }
  CF.makeTest = t;

  // ---------------------------------------------------------------- helpers
  function range(a, b) { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; }
  CF.range = range;
  CF.same = function (a, b) {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
    return a === b;
  };
  CF.fmt = function (v) {
    if (typeof v === 'string') return '"' + v + '"';
    if (v && typeof v === 'object') return 'Slot(offline = ' + v.offline + ', occupied = ' + v.occupied + ')';
    if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
    return String(v);
  };
  CF.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  CF.runTest = function (fn, test) {
    try {
      const got = fn(...test.args);
      return { pass: CF.same(got, test.expect), got };
    } catch (e) {
      return { pass: false, got: 'Exception: ' + e.message, error: true };
    }
  };

  CF.testToKotlin = function (test) {
    const fnName = test.name.replace(/[`]/g, '');
    const args = test.args.map(CF.fmt).join(', ');
    const exp = CF.fmt(test.expect);
    const assert = typeof test.expect === 'boolean'
      ? `assert${test.expect ? 'True' : 'False'}(rules.${test.rule}(${args}))`
      : `assertEquals(${exp}, rules.${test.rule}(${args}))`;
    return `@Test\nfun \`${fnName}\`() {\n    ${assert}\n}`;
  };

  // ---------------------------------------------------------------- syntax highlighting (JS + Kotlin + Groovy, light-weight)
  const KW = new Set(['function', 'if', 'return', 'const', 'let', 'var', 'else', 'true', 'false', 'fun', 'val', 'import', 'class', 'new', 'def', 'null', 'for', 'in']);
  CF.highlight = function (src) {
    let out = '', i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); const j = e < 0 ? src.length : e; out += '<span class="cm">' + CF.esc(src.slice(i, j)) + '</span>'; i = j; continue; }
      if (c === '"' || c === "'" || c === '`') { let j = i + 1; while (j < src.length && src[j] !== c) j++; out += '<span class="str">' + CF.esc(src.slice(i, j + 1)) + '</span>'; i = j + 1; continue; }
      if (c === '@') { let j = i + 1; while (/\w/.test(src[j] || '')) j++; out += '<span class="an">' + CF.esc(src.slice(i, j)) + '</span>'; i = j; continue; }
      if (/[0-9]/.test(c) && !/\w/.test(src[i - 1] || '')) { let j = i; while (/[0-9.]/.test(src[j] || '')) j++; out += '<span class="num">' + src.slice(i, j) + '</span>'; i = j; continue; }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i; while (/[\w$]/.test(src[j] || '')) j++;
        const w = src.slice(i, j);
        if (KW.has(w)) out += '<span class="kw">' + w + '</span>';
        else if (src[j] === '(') out += '<span class="fn">' + w + '</span>';
        else out += w;
        i = j; continue;
      }
      out += CF.esc(c); i++;
    }
    return out;
  };

  // ---------------------------------------------------------------- mutation engine
  CF.MUTATORS = {
    CONDITIONALS_BOUNDARY: 'Replaces < with <=, > with >= (and back)',
    NEGATE_CONDITIONALS: 'Negates comparisons: == ↔ !=, < → >=, > → <=',
    MATH: 'Swaps arithmetic: + ↔ −, * ↔ /, % → *',
    TRUE_RETURNS: 'Replaces boolean return values with true',
    FALSE_RETURNS: 'Replaces boolean return values with false',
    EMPTY_RETURNS: 'Replaces returned strings with ""',
    PRIMITIVE_RETURNS: 'Replaces returned numbers with 0',
    REMOVE_CONDITIONALS: 'Forces an if-condition to always be true or false (STRONGER group)',
  };
  const OPS = ['<=', '>=', '==', '!=', '&&', '||', '<', '>', '+', '-', '*', '/', '%'];
  const OP_MUT = {
    '<': [['CONDITIONALS_BOUNDARY', '<='], ['NEGATE_CONDITIONALS', '>=']],
    '<=': [['CONDITIONALS_BOUNDARY', '<'], ['NEGATE_CONDITIONALS', '>']],
    '>': [['CONDITIONALS_BOUNDARY', '>='], ['NEGATE_CONDITIONALS', '<=']],
    '>=': [['CONDITIONALS_BOUNDARY', '>'], ['NEGATE_CONDITIONALS', '<']],
    '==': [['NEGATE_CONDITIONALS', '!=']],
    '!=': [['NEGATE_CONDITIONALS', '==']],
    '+': [['MATH', '-']], '-': [['MATH', '+']], '*': [['MATH', '/']], '/': [['MATH', '*']], '%': [['MATH', '*']],
  };

  function lineCol(src, pos) {
    const before = src.slice(0, pos).split('\n');
    return { line: before.length, col: before[before.length - 1].length };
  }

  CF.generateMutants = function (rule, opts) {
    opts = opts || {};
    const src = rule.src, muts = [];
    const add = (op, pos, len, rep, desc) => {
      const lc = lineCol(src, pos);
      muts.push({
        id: rule.id + '#' + (muts.length + 1), rule: rule.id, op, pos, len, line: lc.line, col: lc.col,
        original: src.substr(pos, len), replacement: rep, desc,
        src: src.slice(0, pos) + rep + src.slice(pos + len),
      });
    };
    // operators (skip strings, the function header and the `return` keyword's statement handled below)
    const bodyStart = src.indexOf('{');
    for (let i = bodyStart; i < src.length; i++) {
      const c = src[i];
      if (c === '"') { i = src.indexOf('"', i + 1); continue; }
      const op = OPS.find(o => src.startsWith(o, i));
      if (!op) continue;
      if (OP_MUT[op]) for (const [name, rep] of OP_MUT[op]) add(name, i, op.length, rep, `changed ${op} to ${rep}`);
      i += op.length - 1;
    }
    // return values
    const re = /return ([^;]+);/g; let m;
    while ((m = re.exec(src))) {
      const e = m[1].trim(), pos = m.index + 7, len = m[1].length;
      if (e === 'true') add('FALSE_RETURNS', pos, len, 'false', 'replaced return value true with false');
      else if (e === 'false') add('TRUE_RETURNS', pos, len, 'true', 'replaced return value false with true');
      else if (/^".+"$/.test(e)) add('EMPTY_RETURNS', pos, len, '""', `replaced return value ${e} with ""`);
      else if (/[<>=!]=|[<>]/.test(e)) {
        add('TRUE_RETURNS', pos, len, 'true', 'replaced boolean return with true');
        add('FALSE_RETURNS', pos, len, 'false', 'replaced boolean return with false');
      } else add('PRIMITIVE_RETURNS', pos, len, '0', 'replaced numeric return with 0');
    }
    // removed conditionals (STRONGER)
    if (opts.stronger) {
      const ri = /if \(/g; let k;
      while ((k = ri.exec(src))) {
        let d = 1, j = k.index + 4;
        while (d && j < src.length) { j++; if (src[j] === '(') d++; if (src[j] === ')') d--; }
        const s = k.index + 4, len = j - s;
        add('REMOVE_CONDITIONALS', s, len, 'true', 'removed conditional – always true');
        add('REMOVE_CONDITIONALS', s, len, 'false', 'removed conditional – always false');
      }
    }
    muts.sort((a, b) => a.pos - b.pos);
    muts.forEach((x, i) => (x.id = rule.id + '#' + (i + 1)));
    return muts;
  };

  // Run a mutant against the tests that cover its rule (PIT only runs covering tests).
  CF.runMutant = function (mutant, tests) {
    let fn;
    try { fn = CF.compile(mutant.src); } catch (e) { return { status: 'NON_VIABLE', killedBy: null, results: [] }; }
    const covering = tests.filter(x => x.enabled !== false && x.rule === mutant.rule);
    if (!covering.length) return { status: 'NO_COVERAGE', killedBy: null, results: [] };
    const results = covering.map(x => ({ test: x, ...CF.runTest(fn, x) }));
    const k = results.find(r => !r.pass);
    return { status: k ? 'KILLED' : 'SURVIVED', killedBy: k ? k.test : null, results };
  };

  // Find an input where the mutant behaves differently from the original — i.e. a test that would kill it.
  CF.suggestTest = function (mutant) {
    const r = CF.rule(mutant.rule), orig = CF.compile(r.src);
    let mf; try { mf = CF.compile(mutant.src); } catch (e) { return null; }
    for (const args of r.candidates()) {
      let a, b;
      try { a = orig(...args); } catch (e) { continue; }
      try { b = mf(...args); } catch (e) { b = Symbol('err'); }
      if (!CF.same(a, b)) return { rule: r.id, args, expect: a };
    }
    return null; // possibly an equivalent mutant
  };

  CF.mutationScore = function (list) {
    const killed = list.filter(x => x.status === 'KILLED').length;
    const total = list.filter(x => x.status !== 'NON_VIABLE').length;
    return { killed, total, pct: total ? Math.round((killed / total) * 100) : 0 };
  };

  // ---------------------------------------------------------------- shared speed / pause control
  CF.speed = 1;
  CF.paused = false;
  CF.stepMode = false;
  let stepResolver = null;
  CF.sleep = function (ms) {
    return new Promise(res => {
      let left = ms;
      let last = performance.now();
      (function tick() {
        const now = performance.now();
        if (!CF.paused) left -= (now - last) * CF.speed;
        last = now;
        if (left <= 0) res(); else setTimeout(tick, 30);
      })();
    });
  };
  // In step mode, waits until CF.nextStep() is called.
  CF.gate = function () {
    if (!CF.stepMode) return Promise.resolve();
    return new Promise(res => { stepResolver = res; document.dispatchEvent(new CustomEvent('cf-gate', { detail: true })); });
  };
  CF.nextStep = function () { if (stepResolver) { const r = stepResolver; stepResolver = null; document.dispatchEvent(new CustomEvent('cf-gate', { detail: false })); r(); } };
  CF.releaseGate = function () { CF.stepMode = false; CF.nextStep(); };

  CF.ts = function () {
    const d = new Date();
    return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  // Mount speed / pause controls into an element: <div data-speed></div>
  CF.mountSpeed = function (el, opts) {
    opts = opts || {};
    const speeds = opts.speeds || [0.5, 1, 2, 4];
    el.innerHTML = '<label>Speed</label><div class="seg">' +
      speeds.map(s => `<button data-s="${s}" class="${s === CF.speed ? 'on' : ''}">${s}×</button>`).join('') + '</div>';
    el.querySelectorAll('button').forEach(b => b.onclick = () => {
      CF.speed = +b.dataset.s;
      el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
  };
})();
