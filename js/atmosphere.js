(function () {
  'use strict';
  var host = document.querySelector('.sky');
  if (!host || new URLSearchParams(location.search).has('mock')) return;
  var frame = document.createElement('iframe');
  frame.src = 'WeatherAnimationLab/dist/index.html?embedded=1';
  frame.title = 'Weather background';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  var model = null, ready = false;
  function send(data) { frame.contentWindow.postMessage(data, location.origin); }
  window.Atmosphere = {
    update: function (next) {
      if (next.meta.mock || !Number.isInteger(next.current.weatherCode)) return;
      model = next;
      if (ready) send({ type: 'weather-model', model: model });
    }
  };
  window.addEventListener('message', function (event) {
    if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
    if (event.data?.type === 'atmosphere-ready') {
      ready = true;
      if (model) send({ type: 'weather-model', model: model });
    } else if (event.data?.type === 'atmosphere-rendered') {
      frame.classList.add('ready');
      host.closest('.app').classList.add('has-atmosphere');
    } else if (event.data?.type === 'atmosphere-error') {
      ready = false;
      frame.classList.remove('ready');
      host.closest('.app').classList.remove('has-atmosphere');
    }
  });
  host.append(frame);
}());
