/* ChargeFlow mock mobile app (fully working, uses CF rules) + a Katalon-style WebUI driver. */
(function () {
  const CF = window.CF;
  const esc = CF.esc;

  // ---------------------------------------------------------------- object repository
  const PAGE = obj =>
    /^(btn_reserve|slot_|txt_load|txt_station|txt_mybooking|btn_view)/.test(obj) ? 'Page_Stations'
      : /^(input_|sel_|txt_rate|txt_cost|err_|btn_confirm|btn_back|txt_form)/.test(obj) ? 'Page_Booking'
        : /^(txt_confirm|txt_priority|txt_price|txt_duration|btn_cancel|btn_done)/.test(obj) ? 'Page_Confirmation'
          : 'Common';
  CF.objPath = obj => PAGE(obj) + '/' + obj;
  CF.locOverrides = {};
  CF.objLocators = obj => ({
    xpath: CF.locOverrides[obj] || `//*[@id='cf-${obj}']`,
    css: `[data-testid="${obj}"]`,
  });

  const BASE_CHARGERS = () => [
    { id: 'C01', name: 'C-01', kw: 7, base: 12.4, occupied: false, offline: false },
    { id: 'C02', name: 'C-02', kw: 7, base: 12.4, occupied: true, offline: false, until: '20:00' },
    { id: 'C03', name: 'C-03', kw: 22, base: 13.1, occupied: false, offline: false },
    { id: 'C04', name: 'C-04', kw: 22, base: 13.1, occupied: false, offline: true },
    { id: 'C05', name: 'C-05', kw: 50, base: 18.5, occupied: false, offline: false },
  ];
  const money = v => '₹' + (Math.round(v * 100) / 100).toFixed(2);

  // ---------------------------------------------------------------- the app
  class Phone {
    constructor(root, opts) {
      this.root = root;
      this.opts = opts || {};
      this.uiV2 = false;
      this.onAction = null;
      root.innerHTML = '<div class="phone"><div class="notch"></div><div class="bar"><small>CHARGEFLOW · BLR-07 KORAMANGALA</small><b data-r="title">Find your charging slot</b></div><div class="scr"></div></div>';
      this.scr = root.querySelector('.scr');
      this.reset();
    }
    get rules() { return this.opts.rules ? this.opts.rules() : CF.buildRules('none'); }
    reset() {
      this.s = { screen: 'list', load: 60, chargers: BASE_CHARGERS(), booking: null, sel: null, battery: '', duration: '60', toast: null, errB: '', errD: '' };
      this.render();
    }
    setLoad(n) { this.s.load = n; this.render(); }
    id(obj) { return (this.uiV2 ? 'cf-v2-' : 'cf-') + obj; }
    a(obj) { return `id="${this.id(obj)}" data-testid="${obj}"`; }
    emit(type, obj, value) { if (this.onAction) this.onAction({ type, obj, value }); }
    toast(msg, ok) { this.s.toast = { msg, ok }; }

    render() {
      const s = this.s, R = this.rules;
      const title = this.root.querySelector('[data-r=title]');
      let h = '';
      if (s.screen === 'list') {
        title.textContent = 'Find your charging slot';
        const peak = R.tariffFor(10, s.load) > 10;
        h += `<div class="load"><span ${this.a('txt_load')}>Station load ${s.load}%</span><div class="track"><div class="fill ${peak ? 'peak' : ''}" style="width:${s.load}%"></div></div>${peak ? '<b style="color:#b06d00">PEAK</b>' : ''}</div>`;
        if (s.booking) h += `<div class="slot mine"><strong ${this.a('txt_mybooking')}>Your booking: ${s.booking.charger}</strong><span class="mini">${s.booking.duration} min · ${s.booking.priority} priority</span><button class="sbtn" ${this.a('btn_view_booking')}>VIEW</button></div>`;
        h += `<div class="ttl" ${this.a('txt_station')}>Tonight, 18:00 – 20:00</div>`;
        for (const c of s.chargers) {
          const mine = s.booking && s.booking.cid === c.id;
          const cls = c.offline ? 'offline' : mine ? 'mine' : c.occupied ? 'occupied' : 'available';
          const rate = R.tariffFor(c.base, s.load);
          const status = c.offline ? 'Offline · maintenance' : mine ? 'Reserved by you' : c.occupied ? `Occupied until ${c.until}` : `Available · ${c.kw} kW`;
          const label = c.offline ? 'OFFLINE' : mine ? 'YOURS' : c.occupied ? 'UNAVAILABLE' : 'RESERVE';
          h += `<div class="slot ${cls}" ${this.a('slot_' + c.id)}><strong>${c.name}</strong><span class="mini">${status}</span><span class="mini">${money(rate)}/kWh${rate > c.base ? ' · peak' : ''}</span><button class="sbtn" ${this.a('btn_reserve_' + c.id)} data-act="reserve" data-c="${c.id}">${label}</button></div>`;
        }
      } else if (s.screen === 'form') {
        const c = s.chargers.find(x => x.id === s.sel);
        title.textContent = 'Reserve ' + c.name;
        h += `<div class="ttl" ${this.a('txt_form_title')}>${c.name} · ${c.kw} kW</div>`;
        h += `<div class="field"><label>Current battery level (%)</label><input inputmode="numeric" ${this.a('input_battery')} value="${esc(s.battery)}" placeholder="e.g. 35"><div class="err" ${this.a('err_battery')}>${s.errB}</div></div>`;
        h += `<div class="field"><label>Duration</label><select ${this.a('sel_duration')}>${CF.range(1, 12).map(i => i * 15).map(m => `<option value="${m}" ${String(m) === s.duration ? 'selected' : ''}>${m} min</option>`).join('')}</select><div class="err" ${this.a('err_duration')}>${s.errD}</div></div>`;
        h += `<div class="est" data-r="est"></div>`;
        h += `<button class="pbtn go" ${this.a('btn_confirm')}>Confirm booking</button><button class="pbtn sec" ${this.a('btn_back')}>Back</button>`;
      } else if (s.screen === 'confirm') {
        const b = s.booking;
        title.textContent = 'Booking confirmed';
        h += `<div class="okcard"><div class="big">✓</div><b ${this.a('txt_confirm')}>Booking confirmed for ${b.charger}</b><div style="margin:10px 0"><span class="badge ${b.priority}" ${this.a('txt_priority')}>${b.priority} PRIORITY</span></div></div>`;
        h += `<div class="kv"><span>Duration</span><b ${this.a('txt_duration')}>${b.duration} min</b></div>`;
        h += `<div class="kv"><span>Rate</span><b ${this.a('txt_rate')}>${money(b.rate)}/kWh</b></div>`;
        h += `<div class="kv"><span>Estimated cost</span><b ${this.a('txt_price')}>${money(b.cost)}</b></div>`;
        h += `<button class="pbtn bad" ${this.a('btn_cancel')}>Cancel booking</button><button class="pbtn sec" ${this.a('btn_done')}>Back to chargers</button>`;
      }
      if (s.toast) h += `<div class="toast ${s.toast.ok ? 'ok' : ''}" ${this.a('txt_toast')}>${esc(s.toast.msg)}</div>`;
      this.scr.innerHTML = h;
      this.bind();
      this.updateEstimate();
    }
    updateEstimate() {
      const s = this.s, est = this.scr.querySelector('[data-r=est]');
      if (!est) return;
      const c = s.chargers.find(x => x.id === s.sel), R = this.rules;
      const rate = R.tariffFor(c.base, s.load);
      const mins = +s.duration;
      est.innerHTML = `Rate&nbsp;&nbsp;<b ${this.a('txt_rate')}>${money(rate)}/kWh</b>${rate > c.base ? ' <span style="color:#b06d00">PEAK</span>' : ''}<br>Cost&nbsp;&nbsp;<b ${this.a('txt_cost')}>${money(R.costFor(c.kw, mins, rate))}</b>`;
    }
    bind() {
      const q = sel => this.scr.querySelector(sel);
      this.scr.querySelectorAll('[data-act=reserve]').forEach(b => b.onclick = () => { this.emit('click', b.dataset.testid); this.reserve(b.dataset.c); });
      const on = (obj, fn) => { const el = q(`[data-testid="${obj}"]`); if (el) el.onclick = () => { this.emit('click', obj); fn(); }; };
      on('btn_view_booking', () => { this.s.toast = null; this.s.screen = 'confirm'; this.render(); });
      on('btn_back', () => { this.s.toast = null; this.s.screen = 'list'; this.render(); });
      on('btn_confirm', () => this.confirm());
      on('btn_cancel', () => this.cancel());
      on('btn_done', () => { this.s.toast = null; this.s.screen = 'list'; this.render(); });
      const bi = q('[data-testid=input_battery]');
      if (bi) {
        bi.oninput = () => { this.s.battery = bi.value; };
        bi.onchange = () => this.emit('setText', 'input_battery', bi.value);
      }
      const sd = q('[data-testid=sel_duration]');
      if (sd) sd.onchange = () => { this.s.duration = sd.value; this.updateEstimate(); this.emit('select', 'sel_duration', sd.value); };
      const t = q('[data-testid=txt_toast]');
      if (t) t.onclick = () => { this.s.toast = null; this.render(); };
    }
    reserve(cid) {
      const s = this.s, c = s.chargers.find(x => x.id === cid);
      s.toast = null;
      if (s.booking && s.booking.cid === cid) { s.screen = 'confirm'; return this.render(); }
      const ok = this.rules.canReserve({ offline: c.offline, occupied: c.occupied }, s.booking ? 1 : 0);
      if (!ok) {
        this.toast(c.offline ? `${c.name} is offline for maintenance` : c.occupied ? `${c.name} is occupied until ${c.until}` : `You already have an active booking (${s.booking.charger})`);
        return this.render();
      }
      s.sel = cid; s.battery = ''; s.duration = '60'; s.errB = ''; s.errD = ''; s.screen = 'form';
      this.render();
    }
    confirm() {
      const s = this.s, R = this.rules, c = s.chargers.find(x => x.id === s.sel);
      s.toast = null;
      const b = /^-?\d+$/.test(s.battery.trim()) ? parseInt(s.battery, 10) : NaN;
      s.errB = isNaN(b) || !R.validateBattery(b) ? 'Battery level must be between 0 and 100' : '';
      s.errD = R.validateDuration(+s.duration) ? '' : 'Choose 15–120 minutes in 15-minute blocks';
      if (s.errB || s.errD) { this.toast('Please fix the highlighted fields'); return this.render(); }
      const rate = R.tariffFor(c.base, s.load);
      s.booking = { cid: c.id, charger: c.name, battery: b, duration: +s.duration, priority: R.priorityFor(b), rate, cost: R.costFor(c.kw, +s.duration, rate) };
      c.occupied = true; c.until = 'later';
      s.screen = 'confirm';
      this.render();
    }
    cancel() {
      const s = this.s, c = s.chargers.find(x => x.id === s.booking.cid);
      c.occupied = false;
      const name = s.booking.charger;
      s.booking = null; s.screen = 'list';
      this.toast(`Booking for ${name} cancelled`, true);
      this.render();
    }
  }
  CF.Phone = Phone;

  // ---------------------------------------------------------------- automation cursor
  let cursor;
  function getCursor() {
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.className = 'cursor';
      cursor.innerHTML = '<span class="tap"></span><svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.5L16 20l-3 1.5-3.4-7.5L4 18z" fill="#fff" stroke="#082b42" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.body.appendChild(cursor);
    }
    return cursor;
  }
  CF.hideCursor = () => { if (cursor) cursor.style.display = 'none'; };

  class StepFailed extends Error {}
  CF.StepFailed = StepFailed;

  // ---------------------------------------------------------------- Katalon-like WebUI driver
  class Driver {
    constructor(phone, opts) {
      this.phone = phone;
      this.log = (opts && opts.log) || (() => {});
      this.heal = !!(opts && opts.heal);
      this.healed = [];
    }
    resolve(obj) {
      const L = CF.objLocators(obj);
      const r = document.evaluate(L.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (r) return { el: r, how: 'XPath' };
      if (this.heal) {
        const c = this.phone.root.querySelector(L.css);
        if (c) return { el: c, how: 'CSS', healed: true };
      }
      return null;
    }
    async find(obj, timeout) {
      const end = performance.now() + (timeout || 1500);
      for (;;) {
        const r = this.resolve(obj);
        if (r) {
          if (r.healed && !this.healed.includes(obj)) {
            this.healed.push(obj);
            this.log('wn', `Self-healing: XPath ${CF.objLocators(obj).xpath} broken → found '${CF.objPath(obj)}' using CSS ${CF.objLocators(obj).css}`);
          }
          return r.el;
        }
        if (performance.now() > end) return null;
        await new Promise(res => setTimeout(res, 60));
      }
    }
    async need(obj) {
      const el = await this.find(obj);
      if (!el) throw new StepFailed(`Unable to find the element located by '${CF.objLocators(obj).xpath}'. Object: 'Object Repository/${CF.objPath(obj)}'`);
      return el;
    }
    async moveTo(el) {
      const c = getCursor();
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      c.style.display = 'block';
      c.style.transitionDuration = (0.55 / CF.speed) + 's';
      c.style.transform = `translate(${r.left + Math.min(r.width / 2, 40)}px, ${r.top + r.height / 2}px)`;
      el.classList.add('hl-target');
      await CF.sleep(620);
    }
    async tap() {
      const c = getCursor();
      c.classList.remove('click'); void c.offsetWidth; c.classList.add('click');
      await CF.sleep(200);
    }
    unmark(el) { el && el.classList.remove('hl-target'); }
    async flash(el, ok) {
      if (!el) return;
      el.classList.remove('hl-target');
      el.classList.add(ok ? 'hl-pass' : 'hl-fail');
      await CF.sleep(500);
      el.classList.remove('hl-pass', 'hl-fail');
    }

    async exec(step) {
      const P = this.phone;
      switch (step.k) {
        case 'openBrowser': P.reset(); P.root.classList.add('opened'); await CF.sleep(500); return 'Browser is opened (Chrome 131, headless=false)';
        case 'navigate': P.reset(); await CF.sleep(500); return `Navigate to '${step.v || 'https://staging.chargeflow.app/station/BLR-07'}' successfully`;
        case 'api': {
          await CF.sleep(500);
          P.setLoad(step.v);
          return `PUT /api/test/station-load {"load": ${step.v}} → 200 OK (response verified)`;
        }
        case 'click': {
          const el = await this.need(step.o);
          await this.moveTo(el); await this.tap();
          this.unmark(el); el.click();
          await CF.sleep(350);
          return `Object: '${CF.objPath(step.o)}' is clicked on`;
        }
        case 'setText': {
          const el = await this.need(step.o);
          await this.moveTo(el); await this.tap();
          el.focus(); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true }));
          for (const ch of String(step.v)) {
            el.value += ch; el.dispatchEvent(new Event('input', { bubbles: true }));
            await CF.sleep(110);
          }
          el.dispatchEvent(new Event('change', { bubbles: true }));
          this.unmark(el); el.blur();
          return `Text '${step.v}' is set on object '${CF.objPath(step.o)}'`;
        }
        case 'select': {
          const el = await this.need(step.o);
          await this.moveTo(el); await this.tap();
          el.value = String(step.v); el.dispatchEvent(new Event('change', { bubbles: true }));
          await CF.sleep(300); this.unmark(el);
          return `Option value '${step.v}' is selected in '${CF.objPath(step.o)}'`;
        }
        case 'verifyText': case 'verifyContains': {
          const el = await this.need(step.o);
          await this.moveTo(el);
          const txt = el.textContent.trim();
          const ok = step.k === 'verifyText' ? txt === step.v : txt.toLowerCase().includes(String(step.v).toLowerCase());
          await this.flash(el, ok);
          if (!ok) throw new StepFailed(step.k === 'verifyText'
            ? `Unable to verify object '${CF.objPath(step.o)}' text: actual text '${txt}' and expected text '${step.v}' are not matched`
            : `Text '${txt}' of '${CF.objPath(step.o)}' does not contain '${step.v}'`);
          return step.k === 'verifyText' ? `Text of object '${CF.objPath(step.o)}' is: '${txt}' ✓` : `'${txt}' contains '${step.v}' ✓`;
        }
        case 'verifyPresent': {
          const el = await this.find(step.o, 1200);
          if (el) { await this.moveTo(el); await this.flash(el, true); return `Object '${CF.objPath(step.o)}' is present`; }
          throw new StepFailed(`Object '${CF.objPath(step.o)}' is not present within 5 second(s)`);
        }
        case 'verifyNotPresent': {
          await CF.sleep(400);
          const el = this.resolve(step.o);
          if (!el) return `Object '${CF.objPath(step.o)}' is not present`;
          await this.moveTo(el.el); await this.flash(el.el, false);
          throw new StepFailed(`Object '${CF.objPath(step.o)}' is present but expected NOT present`);
        }
        case 'screenshot': {
          const ph = P.root.querySelector('.phone');
          ph.style.transition = 'filter .15s'; ph.style.filter = 'brightness(1.6)';
          await CF.sleep(220); ph.style.filter = '';
          return `Taking screenshot successfully → Reports/screenshots/${Date.now() % 100000}.png`;
        }
        case 'closeBrowser': await CF.sleep(300); CF.hideCursor(); return 'Browser is closed';
        case 'comment': await CF.sleep(250); return step.v;
        default: throw new Error('Unknown step ' + step.k);
      }
    }
  }
  CF.Driver = Driver;

  // ---------------------------------------------------------------- Groovy rendering of steps
  const fo = o => `findTestObject('${CF.objPath(o)}')`;
  CF.stepToGroovy = function (s) {
    switch (s.k) {
      case 'openBrowser': return `WebUI.openBrowser('')`;
      case 'navigate': return `WebUI.navigateToUrl(GlobalVariable.baseUrl + '/station/BLR-07')`;
      case 'api': return `WS.sendRequestAndVerify(findTestObject('API/PUT_station_load', [('load') : ${s.v}]))`;
      case 'click': return `WebUI.click(${fo(s.o)})`;
      case 'setText': return `WebUI.setText(${fo(s.o)}, '${s.v}')`;
      case 'select': return `WebUI.selectOptionByValue(${fo(s.o)}, '${s.v}', false)`;
      case 'verifyText': return `WebUI.verifyElementText(${fo(s.o)}, '${s.v}')`;
      case 'verifyContains': return `WebUI.verifyMatch(WebUI.getText(${fo(s.o)}), '.*${s.v}.*', true)`;
      case 'verifyPresent': return `WebUI.verifyElementPresent(${fo(s.o)}, 5)`;
      case 'verifyNotPresent': return `WebUI.verifyElementNotPresent(${fo(s.o)}, 5)`;
      case 'screenshot': return `WebUI.takeScreenshot()`;
      case 'closeBrowser': return `WebUI.closeBrowser()`;
      case 'comment': return `WebUI.comment('${s.v}')`;
    }
    return '// ' + s.k;
  };
  CF.stepAction = s => ({ openBrowser: 'Open Browser', navigate: 'Navigate To Url', api: 'Send Request (WS)', click: 'Click', setText: 'Set Text', select: 'Select Option By Value', verifyText: 'Verify Element Text', verifyContains: 'Verify Match', verifyPresent: 'Verify Element Present', verifyNotPresent: 'Verify Element Not Present', screenshot: 'Take Screenshot', closeBrowser: 'Close Browser', comment: 'Comment' }[s.k] || s.k);

  // ---------------------------------------------------------------- shared nav
  CF.nav = function (active) {
    const links = [['index.html', 'Overview'], ['runner.html', 'Test Runner'], ['katalon.html', 'Katalon Lab'], ['pit.html', 'PIT Lab'], ['architecture.html', 'Live Architecture']];
    const n = document.createElement('nav');
    n.className = 'nav';
    n.innerHTML = `<div class="nav-in"><a class="brand" href="index.html"><span class="zap">ϟ</span>ChargeFlow</a><div class="nav-links">${links.map(([h, t]) => `<a href="${h}" class="${h === active ? 'on' : ''}">${t}</a>`).join('')}</div><span class="tag nav-tag">EV Testing Lab · AAT</span></div>`;
    document.body.prepend(n);
  };
})();
