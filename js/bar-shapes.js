/*
 * Tvary sloupce srážkového grafu.
 *
 * Jedno místo, kde je popsáno, jak může sloupec vypadat. Používá to jak graf
 * v aplikaci (js/precip.js), tak galerie (lab/bar-shapes.html), takže to,
 * co si vybereš ve velkém, je doslova totéž, co se vykreslí v malém.
 *
 * draw(x, y, w, h, ctx) — x,y je LEVÝ HORNÍ roh sloupce, h roste vzhůru
 * od základní linie. ctx nese barvy a jedinečné id pro <defs>.
 */
(function () {
  'use strict';

  function n(v) { return (+v).toFixed(1); }

  function rect(x, y, w, h, rx, attrs) {
    return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) +
           '" height="' + n(h) + '" rx="' + n(rx) + '" ' + attrs + '/>';
  }


  var HATCH_THIN = 1.5;
  var HATCH_THICK = 2.0;

  function hatchedFade(topMode) {
    return function (x, y, w, h, c) {
      var pid = 'htf' + c.uid;
      var defs = c.once(pid, '<pattern id="' + pid + '" width="6" height="6" ' +
        'patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<line x1="0" y1="0" x2="0" y2="6" stroke="' + c.ink + '" stroke-width="2.2"/>' +
        '</pattern>');

      // Gradient je v objectBoundingBox, takže stačí jeden pro všechny sloupce.
      // Maska musí být na sloupec vlastní — kreslí se v absolutních souřadnicích.
      var gid = pid + 'g';
      defs += c.once(gid, '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#fff" stop-opacity="1"/>' +
        '<stop offset="100%" stop-color="#fff" stop-opacity="0.22"/></linearGradient>');

      var seq = (c.seq = (c.seq || 0) + 1);
      var mid = pid + 'm' + seq;
      var bw = w - 1.5, bh = Math.max(h - 1.5, 1);
      var bx = x + 0.75, by = y + 0.75;

      var body = rect(bx, by, bw, bh, 3, 'fill="url(#' + pid + ')"');
      var extra = '';
      var stroke = HATCH_THIN;

      if (topMode === 'uniform') {
        stroke = HATCH_THICK;
      } else if (topMode === 'cap') {
        extra = '<line x1="' + n(x + 3.75) + '" y1="' + n(y + HATCH_THICK / 2) +
                '" x2="' + n(x + w - 3.75) + '" y2="' + n(y + HATCH_THICK / 2) +
                '" stroke="' + c.ink + '" stroke-width="' + HATCH_THICK +
                '" stroke-linecap="round"/>';
      } else if (topMode === 'taper') {
        // Silnější obrys navrstvený přes tenký a shora dolů vykrácený.
        // Půlpixelový rozdíl se tím čte jako plynulé ztenčení.
        var tid = pid + 't' + seq;
        var tg = pid + 'tg';
        defs += c.once(tg, '<linearGradient id="' + tg + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#fff" stop-opacity="1"/>' +
          '<stop offset="55%" stop-color="#fff" stop-opacity="0"/></linearGradient>');
        defs += '<defs><mask id="' + tid + '">' +
                  rect(bx - 3, by - 3, bw + 6, bh + 6, 3, 'fill="url(#' + tg + ')"') +
                '</mask></defs>';
        extra = rect(bx, by, bw, bh, 3,
                     'fill="none" stroke="' + c.ink + '" stroke-width="' + HATCH_THICK +
                     '" mask="url(#' + tid + ')"');
      }

      return defs +
        '<defs><mask id="' + mid + '">' +
          rect(x - 0.5, y - 1, bw + 2.5, bh + 3, 3, 'fill="url(#' + gid + ')"') +
        '</mask></defs>' +
        '<g mask="url(#' + mid + ')">' +
          body +
          rect(bx, by, bw, bh, 3,
               'fill="none" stroke="' + c.ink + '" stroke-width="' + stroke + '"') +
          extra +
        '</g>';
    };
  }

  var SHAPES = {

    'solid': {
      label: 'Plná výplň',
      draw: function (x, y, w, h, c) {
        return rect(x, y, w, h, Math.min(w / 2, 4), 'fill="' + c.ink + '"');
      },
    },

    'pill': {
      label: 'Zaoblená pilulka',
      draw: function (x, y, w, h, c) {
        // Minimální výška je průměr pilulky; musí narůst vzhůru,
        // jinak by nízké sloupce přetekly pod základní linii.
        var hh = Math.max(h, w);
        return rect(x, y + h - hh, w, hh, w / 2, 'fill="' + c.ink + '"');
      },
    },

    'square': {
      label: 'Ostré hrany',
      draw: function (x, y, w, h, c) {
        return rect(x, y, w, h, 0, 'fill="' + c.ink + '"');
      },
    },

    'outline': {
      label: 'Jen obrys',
      draw: function (x, y, w, h, c) {
        return rect(x + 0.75, y + 0.75, w - 1.5, Math.max(h - 1.5, 1), 4,
                    'fill="none" stroke="' + c.ink + '" stroke-width="1.5"');
      },
    },

    'outline-thick': {
      label: 'Silný obrys',
      draw: function (x, y, w, h, c) {
        return rect(x + 1.5, y + 1.5, w - 3, Math.max(h - 3, 1), 4,
                    'fill="none" stroke="' + c.ink + '" stroke-width="3"');
      },
    },

    'ghost': {
      label: 'Průsvitný s tenkým obrysem',
      draw: function (x, y, w, h, c) {
        return rect(x + 0.5, y + 0.5, w - 1, Math.max(h - 1, 1), 4,
                    'fill="rgba(160,200,240,0.10)" stroke="' + c.ink + '" stroke-width="1"');
      },
    },

    'outline-fill': {
      label: 'Obrys + slabá výplň',
      draw: function (x, y, w, h, c) {
        return rect(x + 0.75, y + 0.75, w - 1.5, Math.max(h - 1.5, 1), 4,
                    'fill="' + c.soft + '" stroke="' + c.ink + '" stroke-width="1.5"');
      },
    },

    'cap': {
      label: 'Tlumené tělo + světlý vrchol',
      draw: function (x, y, w, h, c) {
        var t = Math.max(w * 0.09, 2.5);
        return rect(x, y, w, h, 3, 'fill="rgba(160,200,240,0.14)"') +
               rect(x, y, w, t, t / 2, 'fill="' + c.ink + '"');
      },
    },

    'cap-only': {
      label: 'Jen vrchol, bez těla',
      draw: function (x, y, w, h, c) {
        var t = Math.max(w * 0.1, 2.5);
        return rect(x, y, w, t, t / 2, 'fill="' + c.ink + '"');
      },
    },

    'segments': {
      label: 'Dělené na dílky',
      draw: function (x, y, w, h, c) {
        var seg = Math.max(h * 0.055, 5), gap = seg * 0.55;
        var out = '', count = Math.max(Math.round(h / (seg + gap)), 1);
        for (var i = 0; i < count; i++) {
          var sy = y + h - (i + 1) * seg - i * gap;
          if (sy < y - 1) break;
          out += rect(x, sy, w, seg, seg * 0.28,
                      'fill="' + c.ink + '" opacity="' +
                      (0.52 + 0.48 * (1 - i / Math.max(count - 1, 1))).toFixed(2) + '"');
        }
        return out;
      },
    },

    'notched': {
      label: 'Plná s proříznutými zářezy',
      draw: function (x, y, w, h, c) {
        // Zářezy jsou skutečný výřez přes masku, ne tmavý pruh navrch —
        // na průsvitném panelu tak prosvítá obloha.
        var id = 'nt' + c.uid + (c.seq = (c.seq || 0) + 1);
        var step = Math.max(h / 7, 8);
        var cuts = '';
        for (var sy = y + step; sy < y + h - 2; sy += step) {
          cuts += rect(x - 1, sy, w + 2, Math.max(step * 0.16, 1.5), 0, 'fill="#000"');
        }
        return '<defs><mask id="' + id + '">' +
                 rect(x - 1, y - 1, w + 2, h + 2, 0, 'fill="#fff"') + cuts +
               '</mask></defs>' +
               rect(x, y, w, h, 3, 'fill="' + c.ink + '" mask="url(#' + id + ')"');
      },
    },

    'stem': {
      label: 'Tenká stopka s tečkou',
      draw: function (x, y, w, h, c) {
        var cx = x + w / 2;
        var r = Math.max(w * 0.17, 2.6);
        return '<line x1="' + n(cx) + '" y1="' + n(y + h) + '" x2="' + n(cx) + '" y2="' + n(y) +
               '" stroke="' + c.ink + '" stroke-width="' + n(Math.max(w * 0.1, 1.6)) +
               '" stroke-linecap="round" opacity="0.5"/>' +
               '<circle cx="' + n(cx) + '" cy="' + n(y) + '" r="' + n(r) + '" fill="' + c.ink + '"/>';
      },
    },

    'stem-thick': {
      label: 'Úzký sloupek',
      draw: function (x, y, w, h, c) {
        var bw = Math.max(w * 0.26, 2.5);
        return rect(x + (w - bw) / 2, y, bw, h, bw / 2, 'fill="' + c.ink + '"');
      },
    },

    'double': {
      label: 'Dvojitý',
      draw: function (x, y, w, h, c) {
        var bw = w * 0.3;
        return rect(x, y, bw, h, bw / 2, 'fill="' + c.ink + '"') +
               rect(x + w - bw, y, bw, h, bw / 2, 'fill="' + c.ink + '" opacity="0.45"');
      },
    },

    'lollipop': {
      label: 'Pilulka s tečkou uvnitř',
      draw: function (x, y, w, h, c) {
        var hh = Math.max(h, w);
        return rect(x + 0.7, y + h - hh + 0.7, w - 1.4, hh - 1.4, w / 2,
                    'fill="none" stroke="' + c.ink + '" stroke-width="1.4" opacity="0.7"') +
               '<circle cx="' + n(x + w / 2) + '" cy="' + n(y + h - hh + w / 2) +
               '" r="' + n(Math.max(w / 2 - w * 0.22, 1.5)) + '" fill="' + c.ink + '"/>';
      },
    },

    'inner-line': {
      label: 'Tlumené tělo se světlou osou',
      draw: function (x, y, w, h, c) {
        var lw = Math.max(w * 0.14, 2);
        return rect(x, y, w, h, 3, 'fill="rgba(160,200,240,0.16)"') +
               rect(x + (w - lw) / 2, y, lw, h, lw / 2, 'fill="' + c.ink + '"');
      },
    },

    'top-fade': {
      label: 'Nahoře prosvětlený',
      draw: function (x, y, w, h, c) {
        var id = 'tf' + c.uid + (c.seq = (c.seq || 0) + 1);
        return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
               '<stop offset="0%" stop-color="' + c.ink + '" stop-opacity="0.12"/>' +
               '<stop offset="100%" stop-color="' + c.ink + '" stop-opacity="1"/>' +
               '</linearGradient></defs>' +
               rect(x, y, w, h, 3, 'fill="url(#' + id + ')"');
      },
    },

    'bottom-fade': {
      label: 'Dole prosvětlený',
      draw: function (x, y, w, h, c) {
        var id = 'bf' + c.uid + (c.seq = (c.seq || 0) + 1);
        return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
               '<stop offset="0%" stop-color="' + c.ink + '" stop-opacity="1"/>' +
               '<stop offset="100%" stop-color="' + c.ink + '" stop-opacity="0.12"/>' +
               '</linearGradient></defs>' +
               rect(x, y, w, h, 3, 'fill="url(#' + id + ')"');
      },
    },

    'hatched': {
      label: 'Šrafovaný',
      draw: function (x, y, w, h, c) {
        var id = 'ht' + c.uid;
        var def = c.once(id, '<pattern id="' + id + '" width="6" height="6" ' +
          'patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
          '<line x1="0" y1="0" x2="0" y2="6" stroke="' + c.ink + '" stroke-width="2.2"/>' +
          '</pattern>');
        return def + rect(x + 0.75, y + 0.75, w - 1.5, Math.max(h - 1.5, 1), 3,
                          'fill="url(#' + id + ')" stroke="' + c.ink +
                          '" stroke-width="1.5" opacity="0.9"');
      },
    },

    /*
     * Šrafovaný sloupec se slábnutím dolů. Tři varianty horní hrany —
     * porovnání viz lab. Po rozhodnutí zůstane jedna.
     *
     *   topMode 'cap'     silnější tah jen nahoře (skok v rozích)
     *   topMode 'uniform' celý obrys silnější
     *   topMode 'taper'   silnější nahoře, plynule na základní tloušťku
     */
    'hatched-fade': {
      label: 'Šrafovaný, dole prosvětlený, silnější jen nahoře',
      draw: hatchedFade('cap'),
    },

    'hatched-uniform': {
      label: 'Šrafovaný, dole prosvětlený, celý obrys silnější',
      draw: hatchedFade('uniform'),
    },

    'hatched-taper': {
      label: 'Šrafovaný, dole prosvětlený, obrys se ztenčuje dolů',
      draw: hatchedFade('taper'),
    },

    'dotted': {
      label: 'Tečkovaná výplň',
      draw: function (x, y, w, h, c) {
        var id = 'dt' + c.uid;
        var def = c.once(id, '<pattern id="' + id + '" width="6" height="6" ' +
          'patternUnits="userSpaceOnUse">' +
          '<circle cx="3" cy="3" r="1.5" fill="' + c.ink + '"/></pattern>');
        return def + rect(x + 0.75, y + 0.75, w - 1.5, Math.max(h - 1.5, 1), 3,
                          'fill="url(#' + id + ')" stroke="' + c.ink + '" stroke-width="1.2"');
      },
    },

    'glow': {
      label: 'Se září',
      draw: function (x, y, w, h, c) {
        var id = 'gl' + c.uid;
        var def = c.once(id, '<filter id="' + id + '" x="-80%" y="-40%" width="260%" height="200%">' +
          '<feGaussianBlur stdDeviation="5"/></filter>');
        return def +
               rect(x, y, w, h, 3, 'fill="' + c.ink + '" opacity="0.55" filter="url(#' + id + ')"') +
               rect(x, y, w, h, 3, 'fill="' + c.ink + '"');
      },
    },

    'frost': {
      label: 'Bílá bez barvy',
      draw: function (x, y, w, h, c) {
        return rect(x, y, w, h, 3, 'fill="rgba(255,255,255,' +
                    (0.24 + 0.4 * (c.intensity == null ? 1 : c.intensity)).toFixed(2) + ')"');
      },
    },

    'gradient': {
      label: 'Přechod shora dolů',
      draw: function (x, y, w, h, c) {
        var id = 'gr' + c.uid;
        var def = c.once(id, '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#A6D0F7" stop-opacity="0.95"/>' +
          '<stop offset="100%" stop-color="#4F8FD4" stop-opacity="0.40"/></linearGradient>');
        return def + rect(x, y, w, h, 3, 'fill="url(#' + id + ')"');
      },
    },
  };

  window.BAR_SHAPES = SHAPES;
  window.BAR_SHAPE_NAMES = Object.keys(SHAPES);

  /* Kontext pro kreslení. `once` zajistí, že se <defs> vloží jen jednou. */
  window.barContext = function (uid, intensity) {
    var seen = {};
    return {
      uid: uid,
      intensity: intensity,
      ink:  'rgba(160, 200, 240, 0.95)',
      soft: 'rgba(160, 200, 240, 0.24)',
      bg:   '#111823',
      once: function (id, def) {
        if (seen[id]) return '';
        seen[id] = 1;
        return '<defs>' + def + '</defs>';
      },
    };
  };
}());
