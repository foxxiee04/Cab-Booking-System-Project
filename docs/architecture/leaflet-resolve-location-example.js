// Leaflet client example for realtime address resolution with debounce.
// Backend endpoint: GET /api/location/resolve-location?lat=...&lng=...&snapToRoad=true

const map = L.map('map').setView([10.7769, 106.7009], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

let marker = null;
let inflightAbort = null;
let debounceId = null;

async function resolveLocation(lat, lng) {
  if (inflightAbort) {
    inflightAbort.abort();
  }

  inflightAbort = new AbortController();

  const url = new URL('/api/location/resolve-location', window.location.origin);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lng));
  url.searchParams.set('snapToRoad', 'true');

  const response = await fetch(url.toString(), {
    method: 'GET',
    signal: inflightAbort.signal,
  });

  if (!response.ok) {
    throw new Error(`resolve-location failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload.data;
}

function scheduleResolve(lat, lng) {
  if (debounceId) {
    clearTimeout(debounceId);
  }

  debounceId = setTimeout(async () => {
    try {
      const location = await resolveLocation(lat, lng);

      if (!marker) {
        marker = L.marker([location.lat, location.lng], { draggable: true }).addTo(map);
        marker.on('dragend', (event) => {
          const p = event.target.getLatLng();
          scheduleResolve(p.lat, p.lng);
        });
      } else {
        marker.setLatLng([location.lat, location.lng]);
      }

      marker.bindPopup(location.display_address).openPopup();
      document.getElementById('address').textContent = location.display_address;
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error(error);
    }
  }, 350);
}

map.on('click', (event) => {
  scheduleResolve(event.latlng.lat, event.latlng.lng);
});
