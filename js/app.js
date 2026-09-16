/*
 * Vykreslení aplikace.
 *
 * Data přicházejí z js/weather.js (živé Open-Meteo). Mock data v js/data.js
 * slouží jen jako fixture pro laboratoře a pro `?mock` — do produkčního
 * zobrazení se nikdy nedostanou, aby se smyšlené hodnoty nedaly splést
 * se skutečnou předpovědí.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var deg = function (v) { return v == null ? '—' : v + '°'; };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  var model = null;
  var precipHost = $('precip-chart');
  var lastSize = '';

  /* --- Popisky času se odvozují od teď, ne z pevných řetězců ----- */

  function hourLabel(offsetHours) {
    if (!offsetHours) return 'Now';
    var t = new Date();
    t.setHours(t.getHours() + offsetHours, 0, 0, 0);
    return pad2(t.getHours());
  }

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function dayLabel(offsetDays) {
    if (!offsetDays) return 'Today';
    var t = new Date();
    t.setDate(t.getDate() + offsetDays);
    return WEEKDAYS[t.getDay()];
  }

  function icon(name, cls) {
    return '<svg class="wicon ' + cls + '" viewBox="0 0 24 24" aria-hidden="true">' +
           '<use href="#i-' + name + '"/></svg>';
  }

  /* --- Stavový popisek vlevo nahoře ------------------------------ */

  function ago(ms) {
    var min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min ago';
    var h = Math.round(min / 60);
    return h + (h === 1 ? ' hour ago' : ' hours ago');
  }

  var statusOverride = null;

  function drawStatus() {
    var el = $('badge');
    if (statusOverride) { el.textContent = statusOverride; return; }
    if (!model) { el.textContent = 'Loading…'; return; }
    if (model.meta.mock) { el.textContent = 'Design preview · Sample weather'; return; }
    el.textContent = model.meta.stale
      ? 'Offline · last update ' + ago(model.meta.fetchedAt)
      : model.meta.source + ' · updated ' + ago(model.meta.fetchedAt);
  }

  /* --- Jednotlivé části ------------------------------------------ */

  function drawHero() {
    var c = model.current, l = model.location;
    $('city').textContent = l.city || '—';
    $('region').textContent = l.region || '';
    $('temp').innerHTML = (c.temp == null ? '—' : c.temp) + '<span class="deg">°</span>';
    $('condition').textContent = c.condition || '';
    $('feels').textContent = c.feelsLike == null ? '' : 'Feels like ' + deg(c.feelsLike);
    $('range').innerHTML = 'H:' + deg(c.high) + '<span class="sep">·</span>L:' + deg(c.low);
  }

  function drawPrecip() {
    if (!model || !precipHost.clientWidth || !precipHost.clientHeight) return;
    lastSize = precipHost.clientWidth + 'x' + precipHost.clientHeight;
    window.renderPrecip(precipHost, model.precip, model.precip.barStyle);
  }

  function drawHourly() {
    $('hourly').innerHTML = model.hourly.map(function (h) {
      return '<li>' +
               '<span class="hour-label">' + hourLabel(h.hours) + '</span>' +
               icon(h.icon, 'hour-icon') +
               '<span class="hour-pop">' + (h.pop >= 30 ? h.pop + '%' : '') + '</span>' +
               '<span class="hour-temp">' + deg(h.temp) + '</span>' +
             '</li>';
    }).join('');
  }

  function drawDaily() {
    var days = model.daily.filter(function (d) { return d.low != null && d.high != null; });
    if (!days.length) { $('daily').innerHTML = ''; return; }

    var min = Math.min.apply(null, days.map(function (d) { return d.low; }));
    var max = Math.max.apply(null, days.map(function (d) { return d.high; }));
    var span = Math.max(max - min, 1);
    var pct = function (v) { return ((v - min) / span) * 100; };

    $('daily').innerHTML = days.map(function (d) {
      var left = pct(d.low);
      var width = pct(d.high) - left;
      var dot = d.now != null
        ? '<span class="now" style="left:' + pct(d.now).toFixed(1) + '%"></span>'
        : '';
      return '<li>' +
               '<span class="day-label">' + dayLabel(d.days) + '</span>' +
               icon(d.icon, 'day-icon') +
               '<span class="day-pop">' + (d.pop >= 20 ? d.pop + '%' : '') + '</span>' +
               '<span class="day-low">' + deg(d.low) + '</span>' +
               '<span class="day-bar">' +
                 '<span class="fill" style="left:' + left.toFixed(1) +
                 '%;width:' + width.toFixed(1) + '%"></span>' + dot +
               '</span>' +
               '<span class="day-high">' + deg(d.high) + '</span>' +
             '</li>';
    }).join('');
  }

  function render(m) {
    model = m;
    statusOverride = null;
    drawHero();
    drawPrecip();
    drawHourly();
    drawDaily();
    drawStatus();
  }

  /* --- Průběžná aktualizace -------------------------------------- */

  /*
   * Graf se kreslí do SVG s viewBox v pixelech. Bez překreslení po změně
   * velikosti by se jen roztáhl podle starého viewBoxu a obsah by se zmenšil
   * do letterboxu.
   */
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      if (precipHost.clientWidth + 'x' + precipHost.clientHeight !== lastSize) drawPrecip();
    }).observe(precipHost);
  } else {
    window.addEventListener('resize', drawPrecip);
  }

  /*
   * Okno běží hodiny. Časové popisky i údaj o stáří dat by jinak zamrzly
   * na okamžiku spuštění. Překresluje se až při skutečné změně.
   */
  function timeStamp() {
    var t = new Date();
    return t.getHours() + ':' + Math.floor(t.getMinutes() / 30) + ':' + t.getDate();
  }

  var lastStamp = timeStamp();

  setInterval(function () {
    if (!model) return;
    drawStatus();
    var stamp = timeStamp();
    if (stamp === lastStamp) return;
    lastStamp = stamp;
    drawPrecip();
    drawHourly();
    drawDaily();
  }, 15000);

  /* --- Start ------------------------------------------------------ */

  // `?mock` zobrazí fixture z js/data.js. Slouží k posuzování vzhledu,
  // je zřetelně označené a nikdy se nespustí samo od sebe.
  if (new URLSearchParams(location.search).has('mock') && window.MOCK) {
    var m = window.MOCK;
    render({
      location: m.location,
      current: m.current,
      precip: m.precip,
      hourly: m.hourly,
      daily: m.daily,
      meta: { fetchedAt: Date.now(), source: 'Mock', stale: false, mock: true },
    });
    return;
  }

  drawStatus();

  // Poslední známá data ukaž hned, ať okno nezeje prázdnotou, ale označ je
  // jako stará. Živá data je přepíšou, jakmile dorazí.
  var cached = window.Weather.cached();
  if (cached) render(cached);

  window.Weather.start(render, function (err) {
    if (model) { model.meta.stale = true; drawStatus(); }
    else {
      statusOverride = 'Weather unavailable — ' + (err && err.message ? err.message : 'no data');
      drawStatus();
    }
  });
}());
