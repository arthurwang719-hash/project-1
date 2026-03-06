import L from 'leaflet';
import { locations } from './src/data/locations.js';
import { auth, provider, db } from './src/firebase/config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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
    
    // Safely handle display names for CJK characters or missing names
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Driver');
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
  setTimeout(() => {
    toastContainer.classList.add('hidden');
  }, 4000);
}

loginBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code === 'auth/invalid-api-key') {
      showToast('API Key missing. Please update src/firebase/config.js');
    } else if (error.code === 'auth/unauthorized-domain') {
      showToast('Domain not authorized. Please add this URL in Firebase Console settings.');
    } else if (error.message) {
      showToast(`Login Failed: ${error.message}`);
    } else {
      showToast('Login Failed. Please check console for details.');
      console.error(error);
    }
  }
});

logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

// Central London Coordinates
const LONDON_CENTER = [51.5074, -0.1278];

// Initialize Map
const map = L.map('map', {
  center: LONDON_CENTER,
  zoom: 11,
  zoomControl: false
});

// Add Premium Vibrant CartoDB Tiles (Voyager) for a modern, beautiful aesthetic
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

const markers = [];
const spotDetailsContainer = document.getElementById('spot-details');
const filterBtns = document.querySelectorAll('.filter-btn');

function renderMarkers(filterType = 'all') {
  markers.forEach(marker => map.removeLayer(marker));
  markers.length = 0;

  locations.forEach(spot => {
    if (filterType !== 'all' && spot.type !== filterType) return;

    const iconHtml = `<div class="marker-pin ${spot.type}"></div>`;
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: iconHtml,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker(spot.coordinates, { icon: customIcon }).addTo(map);

    marker.on('click', () => {
      showSpotDetails(spot);
    });

    markers.push(marker);
  });
}

function showSpotDetails(spot) {
  map.panTo(spot.coordinates, { animate: true, duration: 0.5 });
  
  const typeColor = spot.type === 'pub' ? 'rgba(255,71,87,0.1)' : 'rgba(0,85,255,0.1)';
  const textColor = spot.type === 'pub' ? '#ff4757' : '#0055ff';

  spotDetailsContainer.innerHTML = `
    <div style="border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 12px; margin-bottom: 12px;">
      <div class="spot-title">${spot.name}</div>
      <div class="spot-type" style="background: ${typeColor}; color: ${textColor};">
        ${spot.type}
      </div>
    </div>
    <div class="spot-info">
      <div style="width: 100%; height: 160px; border-radius: 12px; overflow: hidden; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <!-- Using high quality curated unspash architecture/car matches to prevent 404s -->
        <img src="${spot.image}" alt="${spot.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1511527661048-7fe73d85e9a4?auto=format&fit=crop&q=80&w=400&h=250'" />
      </div>
      <div><strong>Address:</strong> ${spot.address}</div>
      <div><strong>Parking:</strong> ${spot.parking}</div>
      <div style="margin-top: 4px; border-left: 3px solid var(--accent-color); padding-left: 10px; font-style: italic; color: var(--text-secondary); background: rgba(0,0,0,0.02); padding-top: 6px; padding-bottom: 6px;">
        "${spot.vibe}"
      </div>
      <button id="checkin-btn" class="filter-btn" style="margin-top: 14px; width: 100%; background: #2ed573; color: #fff; border: none; font-size: 0.9rem; padding: 10px;">
        Verify Location & Check-in
      </button>
    </div>
  `;
  
  if (spotDetailsContainer.classList.contains('hidden')) {
    spotDetailsContainer.classList.remove('hidden');
    spotDetailsContainer.style.animation = 'none';
    spotDetailsContainer.offsetHeight;
    spotDetailsContainer.style.animation = null; 
  }

  // Handle Check-in logic
  document.getElementById('checkin-btn').addEventListener('click', async () => {
    if (!currentUser) {
      showToast("Please Sign In with Google first to check into a spot!");
      return;
    }
    
    try {
      const checkinRef = doc(db, 'checkins', `${spot.id}_${currentUser.uid}`);
      await setDoc(checkinRef, {
        spotId: spot.id,
        spotName: spot.name,
        userId: currentUser.uid,
        userName: currentUser.displayName,
        timestamp: serverTimestamp()
      });
      showToast(`Success! You checked into ${spot.name}`, true);
    } catch (error) {
      if (error.code === 'permission-denied' || error.message.includes('API key not valid')) {
        showToast('Firebase DB missing permission. Update rules in console.');
      } else {
        showToast("Error checking in: " + error.message);
      }
    }
  });
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const type = btn.getAttribute('data-type');
    renderMarkers(type);
    spotDetailsContainer.classList.add('hidden');
  });
});

renderMarkers('all');