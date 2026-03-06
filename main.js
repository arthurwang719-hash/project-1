import L from 'leaflet';
import { routes } from './src/data/routes.js';
import { auth, provider, db } from './src/firebase/config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// --- Custom Theme Variables --- //
const BRAND_COLOR = '#fc4c02';

// --- Auth State UI Management --- //
let currentUser = null;
const loginBtn = document.getElementById('login-btn');
const userInfoDiv = document.getElementById('user-info');
const userNameSpan = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginBtn.classList.add('hidden');
    userInfoDiv.classList.remove('hidden');
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Cyclist');
    userNameSpan.textContent = `Hello, ${displayName.split(' ')[0]}`;
  } else {
    currentUser = null;
    loginBtn.classList.remove('hidden');
    userInfoDiv.classList.add('hidden');
    userNameSpan.textContent = '';
  }
});

const toastContainer = document.getElementById('toast-container');
function showToast(message, isSuccess = false) {
  toastContainer.textContent = message;
  toastContainer.className = isSuccess ? 'success' : '';
  toastContainer.classList.remove('hidden');
  setTimeout(() => toastContainer.classList.add('hidden'), 4000);
}

loginBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    showToast(`Login Failed: ${error.message}`);
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- Open-Meteo Weather API Integration --- //
async function fetchWeather() {
  try {
    // Coordinates for Central London
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=51.5085&longitude=-0.1257&current=temperature_2m,wind_speed_10m,precipitation_probability');
    const data = await res.json();
    document.getElementById('weather-temp').textContent = `${Math.round(data.current.temperature_2m)}°C`;
    document.getElementById('weather-wind').textContent = Math.round(data.current.wind_speed_10m);
    document.getElementById('weather-rain').textContent = `${data.current.precipitation_probability}%`;
  } catch (err) {
    console.warn("Weather fetch failed:", err);
  }
}
fetchWeather();

// --- Map Initialization --- //
const LONDON_CENTER = [51.5074, -0.1278];
const map = L.map('map', { center: LONDON_CENTER, zoom: 11, zoomControl: false });

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// --- Routes & Data Rendering --- //
const mapLayers = [];
const spotDetailsContainer = document.getElementById('spot-details');
const filterBtns = document.querySelectorAll('.filter-btn');

function renderData(filterType = 'all') {
  // Clear map layers
  mapLayers.forEach(layer => map.removeLayer(layer));
  mapLayers.length = 0;

  routes.forEach(route => {
    // 1. Render Route Polyline (if filter is All or Route)
    if (filterType === 'all' || filterType === 'route') {
      const polyline = L.polyline(route.path, {
        color: BRAND_COLOR,
        weight: 5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      
      polyline.on('click', () => showDetails(route, 'route'));
      mapLayers.push(polyline);
    }

    // 2. Render POIs (if filter is All, Cafe, or Bakery)
    route.pois.forEach(poi => {
      if (filterType === 'all' || filterType === poi.type) {
        const iconHtml = `<div class="marker-pin" data-emoji="${poi.emoji}" style="background: ${poi.type === 'bakery' ? '#e1b12c' : '#44bd32'}"></div>`;
        const customIcon = L.divIcon({ className: 'custom-marker', html: iconHtml, iconSize: [34, 34], iconAnchor: [17, 34] });
        
        const marker = L.marker(poi.coordinates, { icon: customIcon }).addTo(map);
        marker.on('click', () => showDetails(poi, 'poi', route.id));
        mapLayers.push(marker);
      }
    });
  });

  // Fit bounds to all rendered layers if any exist
  if (mapLayers.length > 0) {
    const group = L.featureGroup(mapLayers);
    map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 14 });
  }
}

function showDetails(item, itemType, parentRouteId = null) {
  const isRoute = itemType === 'route';
  
  // Pan to center of item
  const centerCoord = isRoute ? item.path[Math.floor(item.path.length / 2)] : item.coordinates;
  map.flyTo(centerCoord, 14, { animate: true, duration: 1.5 });
  
  const typeLabel = isRoute ? '🚴 Route' : (item.type === 'bakery' ? '🥐 Bakery' : '☕ Cafe');
  const typeBg = isRoute ? 'rgba(252, 76, 2, 0.1)' : 'rgba(46, 213, 115, 0.1)';
  const typeColor = isRoute ? BRAND_COLOR : '#2ed573';

  // Specific HTML blocks
  const metricsHtml = isRoute ? `
    <div class="metrics-row">
      <div class="metric"><div class="metric-val">${item.distance}</div><div class="metric-label">Distance</div></div>
      <div class="metric"><div class="metric-val">${item.elevation}</div><div class="metric-label">Elevation</div></div>
      <div class="metric"><div class="metric-val">${item.difficulty}</div><div class="metric-label">Difficulty</div></div>
    </div>
    <div style="font-style: italic; color: var(--text-secondary); margin-bottom: 12px;">"${item.description}"</div>
  ` : `
    <div style="width: 100%; height: 160px; border-radius: 12px; overflow: hidden; margin-top: 12px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;" />
    </div>
    <div style="font-weight: 500;">📍 ${item.address}</div>
    <div style="margin-top: 8px; color: var(--text-secondary); font-style: italic;">"${item.vibe}"</div>
  `;

  spotDetailsContainer.innerHTML = `
    <div style="border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 12px; margin-bottom: 4px;">
      <div class="spot-title">${item.name}</div>
      <div class="spot-type" style="background: ${typeBg}; color: ${typeColor};">${typeLabel}</div>
    </div>
    <div class="spot-info">
      ${metricsHtml}
      <button id="checkin-btn" class="filter-btn" style="margin-top: 14px; width: 100%; background: var(--accent-color); color: #fff; border: none; font-size: 0.95rem; padding: 12px;">
        GPS Check-In (${isRoute ? 'Start Route' : 'Arrived'})
      </button>
    </div>
  `;
  
  if (spotDetailsContainer.classList.contains('hidden')) {
    spotDetailsContainer.classList.remove('hidden');
  }

  // Geolocation Check-in Logic
  document.getElementById('checkin-btn').addEventListener('click', async () => {
    if (!currentUser) return showToast("Please Sign In with Google first!");
    if (!navigator.geolocation) return showToast("Geolocation unsupported by browser.");
    
    showToast("Verifying GPS location...", true);
    document.getElementById('checkin-btn').textContent = "Locating...";
    
    navigator.geolocation.getCurrentPosition(async (position) => {
      const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
      
      // Calculate minimum distance to either the route or the exact POI point
      let minDistance = Infinity;
      if (isRoute) {
        // Distance to the closest point on the route
        item.path.forEach(coord => {
          const pt = L.latLng(coord[0], coord[1]);
          const d = userLatLng.distanceTo(pt);
          if (d < minDistance) minDistance = d;
        });
      } else {
        const spotLatLng = L.latLng(item.coordinates[0], item.coordinates[1]);
        minDistance = userLatLng.distanceTo(spotLatLng);
      }
      
      // Enforce 1000m radius for routes, 500m for cafes
      const maxDistance = isRoute ? 1000 : 500;
      
      if (minDistance > maxDistance) {
        document.getElementById('checkin-btn').textContent = "Check-In";
        return showToast(`Locate Failed: You are ${(minDistance/1609.34).toFixed(1)} miles away.`);
      }
      
      try {
        const dbId = `${item.id}_${currentUser.uid}`;
        await setDoc(doc(db, 'checkins', dbId), {
          itemId: item.id,
          itemName: item.name,
          type: itemType,
          userId: currentUser.uid,
          userName: currentUser.displayName,
          timestamp: serverTimestamp()
        });
        document.getElementById('checkin-btn').textContent = "Checked In ✅";
        document.getElementById('checkin-btn').style.background = "#2ed573";
        showToast(`Success! You checked into ${item.name}`, true);
      } catch (error) {
        document.getElementById('checkin-btn').textContent = "Check-In";
        showToast("Error checking in: " + error.message);
      }
    });
  });
}

// Event Listeners for Filters
filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderData(btn.getAttribute('data-type'));
    spotDetailsContainer.classList.add('hidden');
  });
});

// Initial Render
renderData('all');