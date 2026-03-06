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
    userNameSpan.textContent = `Hello, \${displayName.split(' ')[0]}`;
  } else {
    currentUser = null;
    loginBtn.classList.remove('hidden');
    userInfoDiv.classList.add('hidden');
    userNameSpan.textContent = '';
  }
});

loginBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code === 'auth/invalid-api-key') {
      alert('Firebase config is empty. Please replace YOUR_API_KEY in src/firebase/config.js with your real project keys!');
    } else {
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

// Add Premium Dark CartoDB Tiles (Dark Matter) for a high-end feel
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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

    const iconHtml = `<div class="marker-pin \${spot.type}"></div>`;
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
  
  const typeColor = spot.type === 'pub' ? 'rgba(255,51,102,0.2)' : 'rgba(0,210,255,0.2)';
  const textColor = spot.type === 'pub' ? '#ff3366' : '#00d2ff';

  spotDetailsContainer.innerHTML = `
    <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 12px;">
      <div class="spot-title">\${spot.name}</div>
      <div class="spot-type" style="background: \${typeColor}; color: \${textColor};">
        \${spot.type}
      </div>
    </div>
    <div class="spot-info">
      <div style="width: 100%; height: 120px; border-radius: 8px; overflow: hidden; margin-bottom: 8px;">
        <img src="\${spot.image}" alt="\${spot.name}" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      <div><strong>Address:</strong> \${spot.address}</div>
      <div><strong>Parking:</strong> \${spot.parking}</div>
      <div style="margin-top: 4px; border-left: 2px solid var(--accent-color); padding-left: 8px; font-style: italic; color: #fff;">
        "\${spot.vibe}"
      </div>
      <button id="checkin-btn" class="filter-btn" style="margin-top: 10px; width: 100%; background: rgba(0,255,100,0.1); border-color: #00ff64; color: #00ff64;">
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
      alert("Please Sign In with Google first to check into a spot!");
      return;
    }
    
    try {
      // Create a document in Firestore under /checkins/{spotId_userId}
      const checkinRef = doc(db, 'checkins', `\${spot.id}_\${currentUser.uid}`);
      await setDoc(checkinRef, {
        spotId: spot.id,
        spotName: spot.name,
        userId: currentUser.uid,
        userName: currentUser.displayName,
        timestamp: serverTimestamp()
      });
      alert(`Success! You checked into \${spot.name}`);
    } catch (error) {
      if (error.code === 'permission-denied' || error.message.includes('API key not valid')) {
        alert('Firebase not configured. Setup Firestore rules and add your API keys to config.js.');
      } else {
        alert("Error checking in: " + error.message);
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