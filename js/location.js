(function () {
  'use strict';
  var dialog = document.getElementById('location-dialog');
  var input = document.getElementById('location-search');
  var results = document.getElementById('location-results');
  var status = document.getElementById('location-status');
  var timer, revision = 0;
  function select(place) {
    window.Weather.setPlace(place);
    window.dispatchEvent(new Event('weather-place-changed'));
    dialog.close();
  }
  function search() {
    clearTimeout(timer);
    var query = input.value.trim(), request = ++revision;
    results.replaceChildren();
    if (query.length < 2) { status.textContent = 'Enter at least two characters.'; return; }
    status.textContent = 'Searching…';
    window.Weather.search(query).then(function (places) {
      if (request !== revision || !dialog.open) return;
      status.textContent = places.length ? '' : 'No cities found. Try another name.';
      places.forEach(function (place) {
        var item = document.createElement('li'), button = document.createElement('button');
        button.type = 'button';
        var name = document.createElement('span'), detail = document.createElement('small');
        name.textContent = place.city;
        detail.textContent = [place.admin, place.region].filter(Boolean).join(', ');
        button.append(name, detail);
        button.addEventListener('click', function () { select(place); });
        item.append(button); results.append(item);
      });
    }, function () {
      if (request === revision && dialog.open) status.textContent = 'Search unavailable. Check your connection and try again.';
    });
  }
  document.getElementById('choose-city').addEventListener('click', function () {
    dialog.showModal(); input.focus();
  });
  document.getElementById('location-close').addEventListener('click', function () { dialog.close(); });
  document.getElementById('location-current').addEventListener('click', function () { select(null); });
  document.getElementById('location-form').addEventListener('submit', function (event) { event.preventDefault(); search(); });
  input.addEventListener('input', function () {
    clearTimeout(timer); ++revision; results.replaceChildren();
    status.textContent = input.value.trim().length < 2 ? 'Enter at least two characters.' : 'Searching…';
    if (input.value.trim().length >= 2) timer = setTimeout(search, 300);
  });
  dialog.addEventListener('close', function () {
    clearTimeout(timer); ++revision; input.value = ''; results.replaceChildren(); status.textContent = '';
  });
}());
