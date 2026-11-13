/* The 12 ChargeFlow test cases: Katalon UI steps + JUnit unit tests + the rule PIT mutates. */
(function () {
  const CF = window.CF, T = CF.makeTest;
  const open = [{ k: 'openBrowser' }, { k: 'navigate' }];
  const close = [{ k: 'screenshot' }, { k: 'closeBrowser' }];
  const book = (c, battery, dur) => [
    { k: 'click', o: 'btn_reserve_' + c },
    { k: 'setText', o: 'input_battery', v: String(battery) },
    ...(dur ? [{ k: 'select', o: 'sel_duration', v: String(dur) }] : []),
    { k: 'click', o: 'btn_confirm' },
  ];

  CF.CASES = [
    {
      id: 'TC01', title: 'Reserve an available slot', group: 'Functional', tech: 'Positive · equivalence class',
      why: 'Happy path: a free charger, a valid battery level and a valid duration must produce a confirmed booking with the right cost.',
      steps: [...open, { k: 'verifyText', o: 'txt_load', v: 'Station load 60%' }, { k: 'click', o: 'btn_reserve_C01' },
        { k: 'setText', o: 'input_battery', v: '45' }, { k: 'select', o: 'sel_duration', v: '60' },
        { k: 'verifyText', o: 'txt_cost', v: '₹86.80' }, { k: 'click', o: 'btn_confirm' },
        { k: 'verifyText', o: 'txt_confirm', v: 'Booking confirmed for C-01' }, { k: 'verifyText', o: 'txt_priority', v: 'NORMAL PRIORITY' }, ...close],
      junit: [T('costFor', [7, 60, 12.4], 86.8, 'booking cost for C-01, 60 min')], pit: 'canReserve',
    },
    {
      id: 'TC02', title: 'Reject an occupied charger', group: 'Functional', tech: 'Negative test',
      why: 'C-02 is already in use. The app must refuse the booking and explain why, without opening the booking form.',
      steps: [...open, { k: 'verifyText', o: 'btn_reserve_C02', v: 'UNAVAILABLE' }, { k: 'click', o: 'btn_reserve_C02' },
        { k: 'verifyText', o: 'txt_toast', v: 'C-02 is occupied until 20:00' }, { k: 'verifyNotPresent', o: 'input_battery' }, ...close],
      junit: [], pit: 'canReserve',
    },
    {
      id: 'TC03', title: 'Battery priority at exactly 20%', group: 'Boundary', tech: 'Boundary value analysis',
      why: 'The rule is "20% or less is HIGH priority". Testing 19% and 21% is not enough; the boundary value 20 itself must be tested. This is the test PIT asked us to add.',
      steps: [...open, ...book('C01', 20), { k: 'verifyText', o: 'txt_priority', v: 'HIGH PRIORITY' }, ...close],
      junit: [T('priorityFor', [20], 'HIGH', 'priority is HIGH at exactly 20%')], pit: 'priorityFor',
    },
    {
      id: 'TC04', title: 'Battery 21% gets normal priority', group: 'Boundary', tech: 'Boundary value analysis',
      why: 'Just above the boundary. Together with TC03 this pins the rule on both sides of 20%.',
      steps: [...open, ...book('C03', 21), { k: 'verifyText', o: 'txt_priority', v: 'NORMAL PRIORITY' }, ...close],
      junit: [T('priorityFor', [0], 'HIGH', 'priority is HIGH at 0%')], pit: 'priorityFor',
    },
    {
      id: 'TC05', title: 'Peak tariff at exactly 80% load', group: 'Boundary', tech: 'Boundary value · API + UI',
      why: 'Katalon first sets the station load to 80% through the test API (WS keyword), then checks the UI shows the peak rate ₹15.20/kWh.',
      steps: [...open, { k: 'api', v: 80 }, { k: 'verifyText', o: 'txt_load', v: 'Station load 80%' }, { k: 'click', o: 'btn_reserve_C01' },
        { k: 'verifyText', o: 'txt_rate', v: '₹15.20/kWh' }, { k: 'setText', o: 'input_battery', v: '35' }, { k: 'click', o: 'btn_confirm' },
        { k: 'verifyText', o: 'txt_price', v: '₹106.40' }, ...close],
      junit: [T('tariffFor', [12.4, 81], 15.2, 'peak tariff at 81% load')], pit: 'tariffFor',
    },
    {
      id: 'TC06', title: 'Off-peak tariff at 79% load', group: 'Boundary', tech: 'Boundary value · API + UI',
      why: 'One below the peak threshold must still charge the base rate.',
      steps: [...open, { k: 'api', v: 79 }, { k: 'verifyText', o: 'txt_load', v: 'Station load 79%' }, { k: 'click', o: 'btn_reserve_C01' },
        { k: 'verifyText', o: 'txt_rate', v: '₹12.40/kWh' }, ...close],
      junit: [T('tariffFor', [12.4, 79], 12.4, 'base tariff at 79% load')], pit: 'tariffFor',
    },
    {
      id: 'TC07', title: 'Reject battery level 101%', group: 'Validation', tech: 'Negative · invalid partition',
      why: 'Input outside 0–100 is invalid. The form must show an error and must not create a booking.',
      steps: [...open, ...book('C01', 101), { k: 'verifyText', o: 'err_battery', v: 'Battery level must be between 0 and 100' },
        { k: 'verifyNotPresent', o: 'txt_confirm' }, ...close],
      junit: [T('validateBattery', [100], true, 'battery 100 is accepted')], pit: 'validateBattery',
    },
    {
      id: 'TC08', title: 'Accept battery level 0%', group: 'Validation', tech: 'Boundary value (lower edge)',
      why: 'An empty battery (0%) is valid and must be HIGH priority. PIT shows the default suite never tests 0.',
      steps: [...open, ...book('C05', 0), { k: 'verifyText', o: 'txt_confirm', v: 'Booking confirmed for C-05' },
        { k: 'verifyText', o: 'txt_priority', v: 'HIGH PRIORITY' }, ...close],
      junit: [T('validateBattery', [0], true, 'battery 0 is accepted')], pit: 'validateBattery',
    },
    {
      id: 'TC09', title: 'Reject a 135-minute session', group: 'Validation', tech: 'Negative · boundary',
      why: 'Sessions are capped at 120 minutes. Picking 135 must show an inline error.',
      steps: [...open, ...book('C03', 50, 135), { k: 'verifyText', o: 'err_duration', v: 'Choose 15–120 minutes in 15-minute blocks' }, ...close],
      junit: [T('validateDuration', [120], true, '120 min is the maximum'), T('validateDuration', [15], true, '15 min is the minimum')], pit: 'validateDuration',
    },
    {
      id: 'TC10', title: 'Prevent a double booking', group: 'State', tech: 'State-based test',
      why: 'After booking C-01 the driver goes back and tries C-03. The system must allow only one active booking per driver.',
      steps: [...open, ...book('C01', 50), { k: 'verifyText', o: 'txt_confirm', v: 'Booking confirmed for C-01' }, { k: 'click', o: 'btn_done' },
        { k: 'click', o: 'btn_reserve_C03' }, { k: 'verifyText', o: 'txt_toast', v: 'You already have an active booking (C-01)' }, ...close],
      junit: [T('canReserve', [{ offline: false, occupied: false }, 1], false, 'second active booking is rejected')], pit: 'canReserve',
    },
    {
      id: 'TC11', title: 'Reject an offline charger', group: 'Functional', tech: 'Negative test',
      why: 'C-04 is under maintenance. Booking it must be refused with a clear reason.',
      steps: [...open, { k: 'verifyText', o: 'btn_reserve_C04', v: 'OFFLINE' }, { k: 'click', o: 'btn_reserve_C04' },
        { k: 'verifyText', o: 'txt_toast', v: 'C-04 is offline for maintenance' }, ...close],
      junit: [T('canReserve', [{ offline: true, occupied: false }, 0], false, 'offline charger is rejected')], pit: 'canReserve',
    },
    {
      id: 'TC12', title: 'Cancel a booking frees the slot', group: 'State', tech: 'State transition',
      why: 'Book C-03 for 30 min (₹144.10), cancel it, and check the charger shows RESERVE again: available → reserved → available.',
      steps: [...open, ...book('C03', 60, 30), { k: 'verifyText', o: 'txt_price', v: '₹144.10' }, { k: 'click', o: 'btn_cancel' },
        { k: 'verifyText', o: 'txt_toast', v: 'Booking for C-03 cancelled' }, { k: 'verifyText', o: 'btn_reserve_C03', v: 'RESERVE' }, ...close],
      junit: [T('costFor', [22, 30, 13.1], 144.1, '22 kW for 30 min at ₹13.10')], pit: 'costFor',
    },
  ];
})();
