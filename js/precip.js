/*
 * Srážkový graf — jeden renderer, několik způsobů, jak zakódovat intenzitu.
 *
 * Druhé kolo variant. První kolo měnilo jen dekoraci sloupců, takže všechny
 * varianty vypadaly stejně a z grafu nešlo poznat, co výška znamená.
 * Tady se liší samotné kódování informace a každá varianta nese vlastní
 * vysvětlení svislé osy.
 *
 * Svislá škála je nově LINEÁRNÍ v mm/h. Dřívější mocninná škála dělala
 * z výšky needečitatelnou veličinu — proto to nešlo popsat.
 *
 * Volba vzhledu: data.js → precip.barStyle. Přehled: lab/precip-styles.html
 */
(function () {
  'use strict';

  /* Barvy podle třídy intenzity. Index odpovídá classOf(). */
  /*
   * Ramp jde od bledé k syté, ne naopak. Dřív byl silný déšť nejsvětlejší
   * a slabý nejsytější, což čtenáři říká pravý opak toho, co se děje.
   */
  var CLASS_COLOR = [
    'rgba(150, 190, 230, 0.16)',   // 0 — beze srážek
    'rgba(178, 208, 234, 0.42)',   // 1 — slabý: bledý, sotva přítomný
    'rgba(108, 172, 238, 0.88)',   // 2 — mírný: zřetelná modrá
    'rgba(48, 138, 255, 1)',       // 3 — silný: sytá modrá
  ];

  var INK       = 'rgba(160, 200, 240, 0.95)';
  var INK_SOFT  = 'rgba(160, 200, 240, 0.24)';
  var GUIDE     = 'rgba(255, 255, 255, 0.14)';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /*
   * Začátek řady. Ve výchozím stavu skutečné teď, zaokrouhlené dolů na krok
   * řady — díky tomu sloupce sedí na celé a půlhodiny a popisky os na ně
   * padnou přesně. `startHour` v datech to přebije pevným časem (pro fixture).
   */
  function seriesStart(p) {
    // Skutečný čas prvního vzorku, pokud ho zdroj dat zná. Zaokrouhlené
    // „teď" by se od něj mohlo lišit až o krok řady a osa by lhala.
    if (p.startISO) {
      var d = new Date(p.startISO);
      if (!isNaN(d)) return d;
    }
    var t = new Date();
    if (p.startHour != null) {
      t.setHours(p.startHour, p.startMinute || 0, 0, 0);
      return t;
    }
    t.setSeconds(0, 0);
    t.setMinutes(Math.floor(t.getMinutes() / p.stepMinutes) * p.stepMinutes);
    return t;
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function text(x, y, str, cls, anchor) {
    return '<text class="' + cls + '" x="' + (+x).toFixed(1) + '" y="' + (+y).toFixed(1) +
           '" text-anchor="' + (anchor || 'start') + '">' + esc(str) + '</text>';
  }

  /* Hladká křivka přes vrcholy — pro plošné varianty. */
  function smoothPath(pts) {
    var d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], cx = (a.x + b.x) / 2;
      d += ' C' + cx.toFixed(1) + ' ' + a.y.toFixed(1) +
           ' ' + cx.toFixed(1) + ' ' + b.y.toFixed(1) +
           ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    }
    return d;
  }

  /* ---------------------------------------------------------------
     Varianty. `gutter` je místo vlevo na popisky svislé osy.
     --------------------------------------------------------------- */


  /*
   * Mřížka teček. Počet rozsvícených řad odpovídá intenzitě na stejné škále
   * jako sloupce, takže se řady dělí mezi pásma rovným dílem — při 12 řadách
   * a třech pásmech připadají na slabý, mírný a silný déšť vždy čtyři řady.
   *
   * `look`: 'round' kulaté tečky · 'wide' široké buňky přes celý sloupec.
   * Doslova čtvercová mřížka nejde — na 24 sloupců vychází rozteč 49 px,
   * na 12 řad zbývá přes sto pixelů výšky. Buňka je proto vždy plochá.
   */
  function dotGrid(rows, look, showOff) {
    return {
      label: 'Mřížka ' + rows + ' řad, ' + (look === 'wide' ? 'široké buňky' : 'kulaté tečky') +
             (showOff === false ? ', bez zhasnutých' : ''),
      gutter: 92,
      draw: function (g) {
        var top = g.padT + 5;
        var bottom = g.base - 7;
        var rowGap = (bottom - top) / (rows - 1);
        var perBand = rows / g.levels.length;

        var s = '';

        // Popisky u horní řady každého pásma — stejné místo jako u sloupců.
        g.levels.forEach(function (lvl, i) {
          var row = Math.round((i + 1) * perBand) - 1;
          s += text(g.padL - 12, bottom - row * rowGap + 4.5,
                    lvl.label.toUpperCase(), 'y-label', 'end');
        });

        var r = Math.min(rowGap * 0.36, 4.2);
        var cw = g.slot * 0.56;
        var ch = Math.min(rowGap * 0.62, 7);

        g.series.forEach(function (v, i) {
          // Jakýkoli déšť rozsvítí aspoň jednu řadu, jinak by slabé
          // srážky zmizely úplně.
          var lit = (typeof v === 'number' && v > 0) ? Math.max(Math.ceil(g.frac(v) * rows), 1) : 0;
          var cx = g.padL + (i + 0.5) * g.slot;

          for (var k = 0; k < rows; k++) {
            var cy = bottom - k * rowGap;
            var on = k < lit;
            if (!on && showOff === false) continue;
            var band = Math.min(Math.floor(k / perBand) + 1, g.levels.length);
            var fill = on ? CLASS_COLOR[band] : 'rgba(255,255,255,0.05)';

            if (look === 'wide') {
              s += '<rect x="' + (cx - cw / 2).toFixed(1) + '" y="' + (cy - ch / 2).toFixed(1) +
                   '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) +
                   '" rx="' + (ch / 2).toFixed(1) + '" fill="' + fill + '"/>';
            } else {
              s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) +
                   '" r="' + (on ? r : r - 1.2).toFixed(1) + '" fill="' + fill + '"/>';
            }
          }
        });
        return s;
      },
    };
  }


  var STYLES = {

    /* 1. Sloupce + pásma intenzity pojmenovaná slovy. */
    'bands': {
      label: 'Sloupce + pojmenovaná pásma intenzity',
      gutter: 92,
      draw: function (g) {
        var s = '';
        var edges = g.levels.map(function (l) { return l.from; }).concat([g.scaleMax]);
        // Na nízkém panelu leží prahy blízko u sebe; popisek, který by se
        // překryl s předchozím, raději vynech, než aby se slil v kaši.
        var MIN_GAP = 15;
        var lastLabelY = -Infinity;

        g.levels.slice().reverse().forEach(function (lvl) {
          var i = g.levels.indexOf(lvl);
          var yTop = g.y(edges[i + 1]);
          var yBot = g.y(lvl.from);
          if (i > 0) {
            s += '<line x1="' + g.padL + '" y1="' + yBot.toFixed(1) + '" x2="' + (g.W - g.padR) +
                 '" y2="' + yBot.toFixed(1) + '" stroke="' + GUIDE +
                 '" stroke-width="1" stroke-dasharray="2 4"/>';
          }
          // U horní hrany pásma. Ve středu se LIGHT a MODERATE slévaly,
          // protože prahy 2,5 a 7,6 leží na dvacetimilimetrové škále blízko sebe.
          var ly = Math.min(yTop + 13, yBot - 2);
          if (ly - lastLabelY >= MIN_GAP) {
            s += text(g.padL - 12, ly, lvl.label.toUpperCase(), 'y-label', 'end');
            lastLabelY = ly;
          }
        });

        return s + g.bars(0.58);
      },
    },

    /* 2. Sloupce + číselná osa v mm/h. */
    'mm-axis': {
      label: 'Sloupce + číselná osa v mm/h',
      gutter: 46,
      scale: 'linear',
      draw: function (g) {
        var s = '';
        var step = g.scaleMax > 12 ? 5 : (g.scaleMax > 5 ? 2 : 1);
        for (var v = step; v <= g.scaleMax; v += step) {
          var yy = g.y(v);
          s += '<line x1="' + g.padL + '" y1="' + yy.toFixed(1) + '" x2="' + (g.W - g.padR) +
               '" y2="' + yy.toFixed(1) + '" stroke="' + GUIDE + '" stroke-width="1"/>';
          s += text(g.padL - 10, yy + 3.5, v, 'y-label', 'end');
        }
        s += text(g.padL - 10, g.H - 8, 'mm/h', 'y-unit', 'end');

        return s + g.bars(0.58);
      },
    },

    /* Sloupce bez svislé osy. */
    'plain': {
      label: 'Jen sloupce, bez svislé osy',
      gutter: 6,
      draw: function (g) { return g.bars(0.58); },
    },

    /* 3. Pás konstantní výšky — intenzitu nese barva, ne výška. */
    'ribbon': {
      label: 'Barevný pás — intenzitu nese barva, ne výška',
      gutter: 6,
      draw: function (g) {
        var bandH = 34;
        var top = g.padT + (g.plotH - bandH) / 2 + 6;
        var s = '<clipPath id="rib' + g.uid + '"><rect x="' + g.padL + '" y="' + top +
                '" width="' + (g.W - g.padL - g.padR) + '" height="' + bandH + '" rx="7"/></clipPath>';

        s += '<g clip-path="url(#rib' + g.uid + ')">';
        g.series.forEach(function (v, i) {
          s += '<rect x="' + (g.padL + i * g.slot - 0.5).toFixed(1) + '" y="' + top +
               '" width="' + (g.slot + 1).toFixed(1) + '" height="' + bandH +
               '" fill="' + CLASS_COLOR[g.classOf(v)] + '"/>';
        });
        s += '</g>';

        // Legenda
        var lx = g.W - g.padR;
        for (var c = 3; c >= 1; c--) {
          var label = g.levels[c - 1].label;
          lx -= 7 + label.length * 6.1;
          s += text(lx + 16, top - 11, label, 'legend-label');
          s += '<rect x="' + (lx) + '" y="' + (top - 20) + '" width="11" height="11" rx="2.5" fill="' +
               CLASS_COLOR[c] + '"/>';
          lx -= 22;
        }
        return s;
      },
    },

    /* 4. Tři pevné stupně — sloupec doroste jen tam, kam patří. */
    'stepped': {
      label: 'Tři pevné stupně — bez mezihodnot',
      gutter: 92,
      draw: function (g) {
        var rowH = 14, gap = 5;
        var rows = 3;
        var bottom = g.padT + g.plotH / 2 + (rows * rowH + (rows - 1) * gap) / 2;
        var s = '';

        for (var r = 0; r < rows; r++) {
          var ry = bottom - (r + 1) * rowH - r * gap;
          s += text(g.padL - 12, ry + rowH / 2 + 3.5,
                    g.levels[r].label.toUpperCase(), 'y-label', 'end');
        }

        var bw = g.slot * 0.62;
        g.series.forEach(function (v, i) {
          var cls = g.classOf(v);
          for (var r = 0; r < rows; r++) {
            var ry = bottom - (r + 1) * rowH - r * gap;
            var on = r < cls;
            s += '<rect x="' + (g.padL + i * g.slot + (g.slot - bw) / 2).toFixed(1) +
                 '" y="' + ry.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + rowH +
                 '" rx="3" fill="' + (on ? CLASS_COLOR[r + 1] : 'rgba(255,255,255,0.045)') + '"/>';
          }
        });
        return s;
      },
    },

    /* 5. Plocha na podbarvených pásmech intenzity. */
    'area-bands': {
      label: 'Plocha na podbarvených pásmech',
      gutter: 6,
      draw: function (g) {
        var s = '';
        var edges = g.levels.map(function (l) { return l.from; }).concat([g.scaleMax]);
        // Na nízkém panelu leží prahy blízko u sebe; popisek, který by se
        // překryl s předchozím, raději vynech, než aby se slil v kaši.
        var MIN_GAP = 15;
        var lastLabelY = -Infinity;

        g.levels.slice().reverse().forEach(function (lvl) {
          var i = g.levels.indexOf(lvl);
          var yTop = g.y(edges[i + 1]);
          var yBot = g.y(lvl.from);
          s += '<rect x="' + g.padL + '" y="' + yTop.toFixed(1) + '" width="' +
               (g.W - g.padL - g.padR) + '" height="' + Math.max(yBot - yTop, 0).toFixed(1) +
               '" fill="rgba(150,195,240,' + (0.03 + i * 0.045).toFixed(3) + ')"/>';
          if (yBot - yTop > 14) {
            s += text(g.W - g.padR - 8, yTop + 13, lvl.label.toUpperCase(), 'y-label', 'end');
          }
        });

        var pts = g.series.map(function (v, i) {
          return { x: g.padL + (i + 0.5) * g.slot, y: g.y(v) };
        });
        var d = smoothPath(pts);
        return s +
          '<path d="' + d + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + g.base +
          ' L' + pts[0].x.toFixed(1) + ' ' + g.base + ' Z" fill="rgba(140,190,240,0.22)"/>' +
          '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="2"/>';
      },
    },

    /* 6. Výška i barva nesou intenzitu současně. */
    'color-bars': {
      label: 'Výška i barva současně',
      gutter: 6,
      draw: function (g) {
        var s = '';
        var lx = g.W - g.padR;
        for (var c = 3; c >= 1; c--) {
          var label = g.levels[c - 1].label;
          lx -= 7 + label.length * 6.1;
          s += text(lx + 16, g.padT + 9, label, 'legend-label');
          s += '<rect x="' + lx + '" y="' + g.padT + '" width="11" height="11" rx="2.5" fill="' +
               CLASS_COLOR[c] + '"/>';
          lx -= 22;
        }
        return s + g.bars(0.58, function (b) {
          return '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h +
                 '" rx="3" fill="' + CLASS_COLOR[g.classOf(b.v)] + '"/>';
        });
      },
    },

    /* 7. Mřížka — počet rozsvícených řad nese intenzitu. */
    'dots': dotGrid(3, 'round'),
  };

  var uid = 0;

  window.PRECIP_STYLES = Object.keys(STYLES);
  window.PRECIP_STYLE_LABEL = function (n) { return STYLES[n] ? STYLES[n].label : n; };

  window.renderPrecip = function (host, p, styleName, opts) {
    var W = Math.round(host.clientWidth);
    var H = Math.round(host.clientHeight);
    if (!W || !H) return;

    /*
     * `uniform`: všechny sloupce stejně vysoké. Tvar dat pak neruší
     * porovnání samotného vzhledu. Jen pro laboratoř, ne pro aplikaci.
     */
    var uniform = !!(opts && opts.uniform);
    if (uniform) {
      p = Object.assign({}, p, {
        series: p.series.map(function () { return 6.2; }),   // třída „moderate“
      });
    }

    var style = STYLES[styleName] || STYLES.bands;
    var padL = style.gutter, padR = 6, padT = 12, padB = 32;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var base = padT + plotH;

    // Lineární škála zaokrouhlená nahoru na násobek pěti — osa jde popsat.
    var known = p.series.filter(function (v) { return typeof v === 'number' && isFinite(v); });
    var peak = known.length ? Math.max.apply(null, known) : 0;
    // V režimu stejné výšky pevné měřítko, ať sloupce vyplní panel stejně.
    var scaleMax = uniform ? 10 : Math.max(Math.ceil((peak * 1.12) / 5) * 5, 5);
    var slot = plotW / p.series.length;

    var levels = p.levels;

    /*
     * Dvě škály:
     *  banded — každé pásmo intenzity zabírá stejný díl výšky. Uvnitř pásma
     *           je mapování lineární. Slabý déšť tak není nečitelný pahýl
     *           a popisky pásem leží v pravidelných rozestupech.
     *  linear — skutečně lineární v mm/h. Nutné tam, kde osa nese čísla.
     */
    var edges = levels.map(function (l) { return l.from; }).concat([scaleMax]);
    edges[0] = 0;

    function fracBanded(v) {
      var band = 1 / levels.length;
      for (var i = levels.length - 1; i >= 0; i--) {
        if (v >= edges[i]) {
          var span = edges[i + 1] - edges[i];
          return i * band + (span > 0 ? Math.min((v - edges[i]) / span, 1) : 1) * band;
        }
      }
      return 0;
    }

    var banded = style.scale !== 'linear';
    function frac(v) {
      return banded ? fracBanded(v) : Math.min(v, scaleMax) / scaleMax;
    }

    var g = {
      uid: ++uid,
      W: W, H: H, padL: padL, padR: padR, padT: padT, padB: padB,
      base: base, plotH: plotH, slot: slot,
      series: p.series, levels: levels, scaleMax: scaleMax,

      y: function (v) { return base - frac(v) * plotH; },
      frac: frac,

      classOf: function (v) {
        for (var i = levels.length - 1; i >= 0; i--) {
          if (v >= levels[i].from) return i + 1;
        }
        return 0;
      },

      /*
       * Kresbu jednoho sloupce má na starost js/bar-shapes.js, takže graf
       * i galerie kreslí doslova totéž. `draw` je volitelné přebití
       * pro varianty, které si sloupec kreslí po svém (color-bars).
       */
      bars: function (widthRatio, draw) {
        var shape = window.BAR_SHAPES[p.barShape] || window.BAR_SHAPES.solid;
        var ctx = window.barContext(g.uid, 1);
        var bw = slot * widthRatio;
        return p.series.map(function (v, i) {
          if (typeof v !== 'number' || !isFinite(v) || v <= 0) return '';
          var yy = g.y(v);
          var b = {
            v: v,
            x: +(padL + i * slot + (slot - bw) / 2).toFixed(1),
            y: +yy.toFixed(1),
            w: +bw.toFixed(1),
            h: +Math.max(base - yy, 2).toFixed(1),
          };
          if (draw) return draw(b);
          ctx.intensity = Math.min(v / scaleMax, 1);
          return shape.draw(b.x, b.y, b.w, b.h, ctx);
        }).join('');
      },
    };

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '">';
    svg += style.draw(g);

    // Základní linie
    svg += '<line x1="' + padL + '" y1="' + base + '" x2="' + (W - padR) + '" y2="' + base +
           '" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>';

    /*
     * Časová osa. Vlevo „Now", pak popisky na celých sudých hodinách — ne
     * v pevných odstupech od začátku. Díky tomu jsou to vždy kulaté časy
     * (20:00, 22:00…), nikdy 17:43, ať se graf vykreslí kdykoli.
     * Popisek, který by se otřel o „Now" nebo o pravý okraj, se vynechá.
     */
    var start = seriesStart(p);
    var totalMin = p.series.length * p.stepMinutes;
    var MIN_GAP = 52;

    var nowX = padL;
    svg += text(nowX, H - 7, 'Now', 'axis-label', 'start');

    var stepH = Math.max(Math.round(p.tickEveryMinutes / 60), 1);
    var probe = new Date(start.getTime());
    probe.setMinutes(0, 0, 0);
    if (probe < start) probe.setHours(probe.getHours() + 1);
    while (probe.getHours() % stepH !== 0) probe.setHours(probe.getHours() + 1);

    var occupiedLeft = nowX + 34;          // šířka popisku „Now"
    for (; ; probe.setHours(probe.getHours() + stepH)) {
      var offMin = (probe - start) / 60000;
      if (offMin > totalMin) break;
      var tx = padL + plotW * (offMin / totalMin);
      if (tx - occupiedLeft < MIN_GAP) continue;
      if (W - padR - tx < MIN_GAP - 22) continue;
      svg += text(tx, H - 7, pad2(probe.getHours()) + ':00', 'axis-label', 'middle');
      occupiedLeft = tx + 22;
    }

    svg += '</svg>';
    host.innerHTML = svg;
  };
}());
