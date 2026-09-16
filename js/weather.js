/*
 * Živá meteorologická data (Etapa 6).
 *
 * Zdroj předpovědi: Open-Meteo. Bez klíče, bez účtu, bezplatné pro nekomerční
 * použití. Ověřeno 2026-09-16: odpovídá s `access-control-allow-origin: *`
 * i pro `Origin: null`, takže to funguje i ze stránky načtené přes file://.
 *
 * Poloha podle IP: geojs.io, při selhání ipwho.is. Obě HTTPS, bez klíče,
 * s CORS. Je to odhad — při VPN vyjde jinde, což uživatel výslovně přijal.
 *
 * Vrací stejný tvar dat, jaký měla mock data, takže vykreslování se nemění.
 * Chybějící hodnoty zůstávají `null`; nikdy se netváří jako nula.
 */
(function () {
  'use strict';

  var FORECAST = 'https://api.open-meteo.com/v1/forecast';
  var GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
  var IP_SERVICES = [
    { url: 'https://get.geojs.io/v1/ip/geo.json', parse: function (d) {
        return d && d.latitude != null && d.longitude != null ? {
          latitude: +d.latitude, longitude: +d.longitude,
          city: d.city, region: d.country, timezone: d.timezone,
        } : null;
      } },
    { url: 'https://ipwho.is/', parse: function (d) {
        return d && d.success !== false && d.latitude != null && d.longitude != null ? {
          latitude: +d.latitude, longitude: +d.longitude,
          city: d.city, region: d.country,
          timezone: d.timezone && d.timezone.id,
        } : null;
      } },
  ];

  /*
   * Úložiště. V desktopovém obalu jde přes `window.appStore` do souboru —
   * Chromium totiž localStorage pro schéma app:// mezi spuštěními nezachová.
   * V prohlížeči (screenshoty přes shot.sh) se použije localStorage.
   */
  var store = window.appStore ? {
    get: function (k) { return window.appStore.get(k); },
    set: function (k, v) { window.appStore.set(k, v); },
  } : {
    get: function (k) {
      try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }
      catch (e) { return null; }
    },
    set: function (k, v) {
      try {
        if (v === null || v === undefined) localStorage.removeItem(k);
        else localStorage.setItem(k, JSON.stringify(v));
      } catch (e) { /* bez persistence se dá běžet dál */ }
    },
  };

  var CACHE_KEY = 'weatherapp.cache.v1';
  var PLACE_KEY = 'weatherapp.place.v1';
  var REFRESH_MS = 10 * 60 * 1000;      // 10 minut; denní limit je 10 000 volání
  var RETRY_MS = 60 * 1000;

  /* --- Převod WMO kódů na stav a ikonu -------------------------- */

  var CODES = {
    0:  ['Clear',                  'sun'],
    1:  ['Mainly Clear',           'sun'],
    2:  ['Partly Cloudy',          'partly'],
    3:  ['Overcast',               'cloud'],
    45: ['Fog',                    'fog'],
    48: ['Freezing Fog',           'fog'],
    51: ['Light Drizzle',          'drizzle'],
    53: ['Drizzle',                'drizzle'],
    55: ['Heavy Drizzle',          'drizzle'],
    56: ['Freezing Drizzle',       'drizzle'],
    57: ['Freezing Drizzle',       'drizzle'],
    61: ['Light Rain',             'rain'],
    63: ['Rain',                   'rain'],
    65: ['Heavy Rain',             'rain'],
    66: ['Freezing Rain',          'rain'],
    67: ['Freezing Rain',          'rain'],
    71: ['Light Snow',             'snow'],
    73: ['Snow',                   'snow'],
    75: ['Heavy Snow',             'snow'],
    77: ['Snow Grains',            'snow'],
    80: ['Light Showers',          'rain'],
    81: ['Showers',                'rain'],
    82: ['Heavy Showers',          'rain'],
    85: ['Snow Showers',           'snow'],
    86: ['Snow Showers',           'snow'],
    95: ['Thunderstorms',          'bolt'],
    96: ['Thunderstorms',          'bolt'],
    99: ['Thunderstorms',          'bolt'],
  };

  var NIGHT = { sun: 'moon', partly: 'partly-night' };

  function describe(code, isDay) {
    var e = CODES[code] || ['—', 'cloud'];
    var icon = e[1];
    if (isDay === false && NIGHT[icon]) icon = NIGHT[icon];
    return { condition: e[0], icon: icon };
  }

  /* --- Síť ------------------------------------------------------- */

  function getJSON(url, timeoutMs) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 12000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) { clearTimeout(timer); return d; },
            function (e) { clearTimeout(timer); throw e; });
  }

  /* --- Poloha ---------------------------------------------------- */

  function savedPlace() { return store.get(PLACE_KEY); }
  function savePlace(place) { store.set(PLACE_KEY, place || null); }

  function locateByIP(i) {
    i = i || 0;
    if (i >= IP_SERVICES.length) return Promise.reject(new Error('IP poloha selhala'));
    var svc = IP_SERVICES[i];
    return getJSON(svc.url, 8000).then(function (d) {
      var p = svc.parse(d);
      if (!p || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) throw new Error('neočekávaná odpověď');
      p.source = 'ip';
      return p;
    }).catch(function () { return locateByIP(i + 1); });
  }

  function resolvePlace() {
    var manual = savedPlace();
    if (manual) return Promise.resolve(manual);
    return locateByIP();
  }

  /* --- Mapování odpovědi na interní model ------------------------ */

  function hoursBetween(fromISO, toISO) {
    return Math.round((new Date(toISO) - new Date(fromISO)) / 3600000);
  }

  /*
   * Srážky. `minutely_15.precipitation` je úhrn v mm za 15 minut, ne mm/h —
   * převádí se proto na mm/h. Dvojice patnáctiminutovek se slučuje na
   * půlhodinový krok, aby graf zůstal ve stejné hustotě jako dosud.
   * Když patnáctiminutová data pro lokalitu nejsou, použije se hodinová.
   */
  function buildPrecip(d, startIdx) {
    var m = d.minutely_15;
    var out = [];

    if (m && m.precipitation && m.precipitation.length > startIdx + 1) {
      for (var i = startIdx; i + 1 < m.precipitation.length && out.length < 24; i += 2) {
        var a = m.precipitation[i];
        var b = m.precipitation[i + 1];
        if (a == null || b == null) { out.push(null); continue; }
        out.push((a + b) * 2);       // mm za 30 min → mm/h
      }
      if (out.length >= 12) {
        return {
          series: out, stepMinutes: 30, resolution: '15min',
          startISO: m.time[startIdx],
        };
      }
    }

    // Náhrada: hodinové úhrny, každý se rozdělí na dvě půlhodiny.
    var h = d.hourly || {};
    var hp = h.precipitation || [];
    var nowIdx = nearestHourIndex(h.time);
    out = [];
    for (var k = nowIdx; k < hp.length && out.length < 24; k++) {
      out.push(hp[k] == null ? null : hp[k]);
      out.push(hp[k] == null ? null : hp[k]);
    }
    return {
      series: out.slice(0, 24), stepMinutes: 30, resolution: 'hourly',
      startISO: h.time && h.time[nowIdx],
    };
  }

  function nearestHourIndex(times) {
    if (!times || !times.length) return 0;
    var now = Date.now();
    for (var i = 0; i < times.length; i++) {
      if (new Date(times[i]).getTime() + 3600000 > now) return i;
    }
    return 0;
  }

  function nearest15Index(times) {
    if (!times || !times.length) return 0;
    var now = Date.now();
    for (var i = 0; i < times.length; i++) {
      if (new Date(times[i]).getTime() + 900000 > now) return i;
    }
    return 0;
  }

  function toModel(place, d) {
    // Request absolute API timestamps; never parse another city's wall clock locally.
    ['hourly', 'daily', 'minutely_15'].forEach(function (key) {
      if (d[key] && d[key].time) d[key].time = d[key].time.map(function (t) {
        return typeof t === 'number' ? new Date(t * 1000).toISOString() : t;
      });
    });
    var cur = d.current || {};
    var h = d.hourly || {};
    var day = d.daily || {};
    var desc = describe(cur.weather_code, cur.is_day == null ? null : cur.is_day === 1);

    var hIdx = nearestHourIndex(h.time);
    var hourly = [];
    for (var k = 0; k < 8; k++) {
      var idx = hIdx + k * 3;
      if (!h.time || idx >= h.time.length) break;
      var hd = describe(h.weather_code && h.weather_code[idx],
                        h.is_day ? h.is_day[idx] === 1 : true);
      hourly.push({
        timeISO: h.time[idx],
        hours: k === 0 ? 0 : hoursBetween(h.time[hIdx], h.time[idx]),
        icon: k === 0 ? desc.icon : hd.icon,
        temp: h.temperature_2m ? round(h.temperature_2m[idx]) : null,
        pop: h.precipitation_probability ? h.precipitation_probability[idx] : null,
      });
    }
    if (hourly.length) {
      hourly[0].hours = 0;
      // Hodinová hodnota je za celou uplynulou hodinu; velká teplota nahoře
      // je aktuální. Kdyby se lišily, vypadá to jako chyba.
      if (cur.temperature_2m != null) hourly[0].temp = round(cur.temperature_2m);
    }

    var daily = [];
    for (var j = 0; j < 5 && day.time && j < day.time.length; j++) {
      var dd = describe(day.weather_code && day.weather_code[j], true);
      daily.push({
        dateISO: day.time[j],
        days: j,
        icon: dd.icon,
        pop: day.precipitation_probability_max ? day.precipitation_probability_max[j] : null,
        low: round(day.temperature_2m_min && day.temperature_2m_min[j]),
        high: round(day.temperature_2m_max && day.temperature_2m_max[j]),
        now: j === 0 ? round(cur.temperature_2m) : undefined,
      });
    }

    var p = buildPrecip(d, d.minutely_15 ? nearest15Index(d.minutely_15.time) : 0);

    return {
      location: {
        city: place.city || 'Unknown',
        region: place.region || '',
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: d.timezone || place.timezone,
        source: place.source || 'manual',
      },
      current: {
        weatherCode: Number.isInteger(cur.weather_code) ? cur.weather_code : null,
        cloudCover: Number.isFinite(cur.cloud_cover) ? cur.cloud_cover : null,
        windSpeed: Number.isFinite(cur.wind_speed_10m) ? cur.wind_speed_10m : null,
        precipitation: Number.isFinite(cur.precipitation) ? cur.precipitation : null,
        temp: round(cur.temperature_2m),
        condition: desc.condition,
        icon: desc.icon,
        feelsLike: round(cur.apparent_temperature),
        high: daily.length ? daily[0].high : null,
        low: daily.length ? daily[0].low : null,
        isDay: cur.is_day == null ? null : cur.is_day === 1,
      },
      precip: {
        timezone: d.timezone || place.timezone,
        series: p.series,
        startISO: p.startISO,
        stepMinutes: p.stepMinutes,
        resolution: p.resolution,
        tickEveryMinutes: 120,
        levels: LEVELS,
        barShape: 'hatched-uniform',
        barStyle: 'bands',
      },
      hourly: hourly,
      daily: daily,
      meta: {
        fetchedAt: Date.now(),
        source: 'Open-Meteo',
        stale: false,
      },
    };
  }

  function round(v) { return v == null ? null : Math.round(v); }

  // Meteorologické prahy v mm/h. Stejné jako dosud.
  var LEVELS = [
    { label: 'Light',    from: 0.1 },
    { label: 'Moderate', from: 2.5 },
    { label: 'Heavy',    from: 7.6 },
  ];

  /* --- Cache ----------------------------------------------------- */

  function readCache() {
    var m = store.get(CACHE_KEY);
    return m && m.meta ? m : null;
  }

  function writeCache(model) { store.set(CACHE_KEY, model); }

  /* --- Veřejné API ----------------------------------------------- */

  function fetchForecast(place) {
    var url = FORECAST +
      '?latitude=' + encodeURIComponent(place.latitude) +
      '&longitude=' + encodeURIComponent(place.longitude) +
      '&current=temperature_2m,apparent_temperature,weather_code,is_day,precipitation,cloud_cover,wind_speed_10m' +
      '&minutely_15=precipitation' +
      '&forecast_minutely_15=64' +
      '&hourly=temperature_2m,weather_code,precipitation,precipitation_probability,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&forecast_days=6&timezone=auto&timeformat=unixtime';
    return getJSON(url).then(function (d) { return toModel(place, d); });
  }

  window.Weather = {
    LEVELS: LEVELS,

    /* Poslední známá data, i stará. Vrací null, když se nic nepodařilo. */
    cached: function () {
      var m = readCache();
      if (!m) return null;
      m.meta.stale = true;
      return m;
    },

    /*
     * Spustí načítání a volá `onModel(model)` pokaždé, když jsou nová data.
     * `onError(err)` se volá při neúspěchu; poslední data zůstávají na obrazovce.
     * Vrací funkci pro zastavení.
     */
    start: function (onModel, onError) {
      var stopped = false;
      var timer = null;

      function schedule(ms) {
        if (stopped) return;
        clearTimeout(timer);
        timer = setTimeout(tick, ms);
      }

      function tick() {
        if (stopped) return;
        resolvePlace()
          .then(fetchForecast)
          .then(function (model) {
            if (stopped) return;
            writeCache(model);
            onModel(model);
            schedule(REFRESH_MS);
          })
          .catch(function (err) {
            if (stopped) return;
            if (onError) onError(err);
            schedule(RETRY_MS);
          });
      }

      tick();
      return function () { stopped = true; clearTimeout(timer); };
    },

    /* Ruční volba města. `null` vrátí zpět na polohu podle IP. */
    setPlace: function (place) { savePlace(place); },
    place: savedPlace,

    search: function (query) {
      return getJSON(GEOCODE + '?name=' + encodeURIComponent(query) +
                     '&count=8&language=en&format=json')
        .then(function (d) {
          return (d.results || []).map(function (r) {
            return {
              city: r.name,
              region: r.country,
              admin: r.admin1,
              latitude: r.latitude,
              longitude: r.longitude,
              timezone: r.timezone,
              source: 'manual',
            };
          });
        });
    },
  };
}());
