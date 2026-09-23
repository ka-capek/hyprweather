(function (root) {
  'use strict';
  var CAPACITY = 64;
  function ContactField(random) {
    this.random = random || Math.random;
    this.items = Array.from({ length: CAPACITY }, function () { return { active: false }; });
    this.width = 1; this.height = 1; this.surfaces = [];
    this.rain = 0; this.snow = 0; this.wind = 0; this.night = 0;
    this.credit = 0; this.tick = 0;
  }
  ContactField.prototype.setWeather = function (state) {
    var clamp = function (x) { return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0; };
    this.rain = clamp(state.rain); this.snow = clamp(state.snow); this.night = clamp(state.night);
    this.wind = Number.isFinite(state.wind) ? Math.max(0, Math.min(80, state.wind)) : 0;
    // A dry scene must not keep dripping/frosting over its UI after scene tests.
    for (var p of this.items) {
      if ((p.snow ? this.snow : this.rain) <= .001) p.active = false;
    }
    if (this.rain + this.snow <= .001) this.credit = 0;
  };
  ContactField.prototype.resize = function (width, height, surfaces) {
    this.width = width; this.height = height;
    this.surfaces = surfaces.filter(function (s) { return s.right - s.left > 35 && s.top > 45 && s.top < height - 10; });
    // Old particles must not hit invisible edges after a layout/city change.
    for (var p of this.items) p.active = false;
  };
  ContactField.prototype.add = function (values) {
    var p = this.items.find(function (item) { return !item.active; });
    if (!p) return null;
    Object.assign(p, { active: true, age: 0, vx: 0, vy: 0, rotation: this.random() * Math.PI, life: 1, born: this.tick }, values);
    return p;
  };
  ContactField.prototype.spawn = function () {
    var r = this.random;
    var snow = r() * (this.rain + this.snow) < this.snow;
    if (r() < .48 || !this.surfaces.length) {
      if (this.items.filter(function (p) { return p.active && p.kind === 'glass'; }).length >= 7) return;
      this.add({ kind: 'glass', snow: snow, x: ( .06 + r() * .88) * this.width,
        y: (.08 + r() * .76) * this.height, radius: snow ? 2.5 + r() * 2 : 3 + r() * 3.5,
        vy: snow ? 1 + r() * 2 : 4 + r() * 10, life: snow ? 3 + r() * 2 : 5 + r() * 3 });
    } else {
      var edge = this.surfaces[Math.floor(r() * this.surfaces.length)];
      var fall = 40 + r() * 65, speed = snow ? 34 + r() * 16 : 250 + r() * 90;
      var vx = this.wind * (snow ? .4 : .8);
      var hitX = edge.left + 18 + r() * Math.max(0, edge.right - edge.left - 36);
      this.add({ kind: 'incoming', snow: snow, x: hitX - vx * fall / speed, y: edge.top - fall,
        radius: snow ? 2 + r() * 1.4 : 1, vx: vx, vy: speed, life: fall / speed + .3 });
    }
  };
  ContactField.prototype.impact = function (p, x, y) {
    p.active = false;
    for (var i = 0; i < (p.snow ? 4 : 5); i++) {
      var side = (i - (p.snow ? 1.5 : 2));
      this.add({ kind: 'spray', snow: p.snow, x: x, y: y - 1, radius: p.snow ? .8 + this.random() : .65 + this.random() * .5,
        vx: side * (p.snow ? 8 : 18), vy: -(p.snow ? 9 : 25) - this.random() * (p.snow ? 15 : 40), life: p.snow ? .8 : .48 });
    }
    if (p.snow) this.add({ kind: 'settled', snow: true, x: x, y: y - 1, radius: 2.5, life: 1.8 });
  };
  ContactField.prototype.update = function (dt) {
    dt = Math.min(.05, Math.max(0, dt));
    this.tick++;
    var rate = this.rain * 1.8 + this.snow * 1.05;
    this.credit += rate * dt;
    if (this.credit >= 1) { this.credit -= 1; this.spawn(); }
    // A generation marker keeps recycled splash slots out of this tick.
    for (var p of this.items) {
      if (!p.active || p.born === this.tick) continue;
      p.age += dt;
      if (p.age >= p.life || p.y > this.height + 30) { p.active = false; continue; }
      var oldX = p.x, oldY = p.y;
      if (p.kind === 'glass') {
        if (p.age > 1.2) p.y += p.vy * dt * (p.snow ? .25 : 1);
      } else if (p.kind !== 'settled') {
        if (p.kind === 'spray') p.vy += (p.snow ? 35 : 250) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.kind === 'incoming') {
        var hit = null, hitX = 0;
        for (var edge of this.surfaces) {
          if (oldY <= edge.top && p.y >= edge.top) {
            var x = oldX + (p.x - oldX) * (edge.top - oldY) / Math.max(.0001, p.y - oldY);
            if (x > edge.left + 12 && x < edge.right - 12 && (!hit || edge.top < hit.top)) { hit = edge; hitX = x; }
          }
        }
        if (hit) this.impact(p, hitX, hit.top);
      }
    }
    return rate > .001 || this.items.some(function (p) { return p.active; });
  };

  function create(host) {
    var canvas = document.createElement('canvas');
    canvas.className = 'weather-contacts'; canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);
    var context = canvas.getContext('2d');
    if (!context) { canvas.remove(); return { update: function () {}, clear: function () {}, diagnostics: function () { return { active: 0, capacity: 0, surfaces: 0, running: false }; } }; }
    var field = new ContactField(), frame = 0, previous = 0, layoutFrame = 0;
    function measure() {
      layoutFrame = 0;
      var box = host.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      var surfaces = Array.from(host.querySelectorAll('.panel, #choose-city')).map(function (element) {
        var r = element.getBoundingClientRect();
        return { left: r.left - box.left, right: r.right - box.left, top: r.top - box.top };
      });
      field.resize(box.width, box.height, surfaces);
    }
    function scheduleMeasure() { if (!layoutFrame) layoutFrame = requestAnimationFrame(measure); }
    var observer = new ResizeObserver(scheduleMeasure);
    observer.observe(host);
    host.querySelectorAll('.panel, #choose-city').forEach(function (element) { observer.observe(element); });
    function flake(radius, rotation) {
      context.rotate(rotation);
      context.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3;
        context.moveTo(0, 0); context.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      }
      context.lineWidth = .85; context.strokeStyle = 'rgba(225,238,250,.85)'; context.stroke();
    }
    function draw(p) {
      var fade = Math.min(1, p.age / .12) * Math.min(1, (p.life - p.age) / (p.kind === 'glass' ? 1 : .3));
      context.save(); context.translate(p.x, p.y); context.globalAlpha = fade * (1 - field.night * .22);
      if (p.snow) {
        if (p.kind === 'settled') { context.scale(1.7, .45); }
        flake(p.radius, p.rotation + (p.kind === 'incoming' ? p.age * .4 : 0));
      } else if (p.kind === 'glass') {
        var r = p.radius;
        context.scale(1, 1.22 + Math.min(.8, p.age * .08));
        var fill = context.createRadialGradient(-r*.25, -r*.35, 0, 0, 0, r);
        fill.addColorStop(0, 'rgba(215,235,255,.02)'); fill.addColorStop(.73, 'rgba(10,22,38,.03)'); fill.addColorStop(1, 'rgba(3,12,25,.36)');
        context.beginPath(); context.arc(0, 0, r, 0, Math.PI*2); context.fillStyle = fill; context.fill();
        context.lineWidth = .7; context.strokeStyle = 'rgba(155,205,238,.35)'; context.stroke();
        context.beginPath(); context.arc(-r*.07, -r*.08, r*.72, Math.PI*1.1, Math.PI*1.65);
        context.lineWidth = .9; context.strokeStyle = 'rgba(233,245,255,.85)'; context.stroke();
        context.beginPath(); context.arc(r*.28, r*.48, r*.16, 0, Math.PI*2);
        context.fillStyle = 'rgba(205,235,255,.6)'; context.fill();
        if (p.age < .32) {
          context.beginPath(); context.ellipse(0, 0, r*(1+p.age*2), r*(.5+p.age), 0, 0, Math.PI*2);
          context.strokeStyle = 'rgba(210,235,255,' + (.22*(1-p.age/.32)) + ')'; context.stroke();
        }
      } else {
        context.beginPath(); context.moveTo(0, 0);
        context.lineTo(-p.vx*.015, -Math.max(2,p.vy*.025));
        context.lineWidth = p.radius; context.lineCap = 'round'; context.strokeStyle = 'rgba(205,228,248,.78)'; context.stroke();
      }
      context.restore();
    }
    function tick(now) {
      frame = 0;
      if (document.hidden) { previous = 0; return; }
      var active = field.update(previous ? (now - previous) / 1000 : 0); previous = now;
      // Only invalidate the small regions occupied by these sparse effects.
      for (var p of field.items) if (p.drawn) { context.clearRect(p.drawX-24,p.drawY-30,48,60); p.drawn=false; }
      for (var p of field.items) if (p.active) { draw(p); p.drawn=true; p.drawX=p.x; p.drawY=p.y; }
      if (active) frame = requestAnimationFrame(tick); else previous = 0;
    }
    function start() { if (!frame && !document.hidden) frame = requestAnimationFrame(tick); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && (field.rain + field.snow > .001)) start(); });
    measure();
    return {
      update: function (state) { field.setWeather(state); start(); },
      clear: function () { field.setWeather({}); start(); },
      diagnostics: function () { return { active: field.items.filter(function (p) { return p.active; }).length, capacity: CAPACITY,
        surfaces: field.surfaces.length, rain: field.rain, snow: field.snow, running: Boolean(frame) }; }
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { ContactField: ContactField };
  else root.WeatherContacts = { create: create };
}(typeof window === 'undefined' ? globalThis : window));
