const CONSTANTS = require('../constants.js');

module.exports.getToken = function () {
  const token = localStorage.getItem('jwt') || null;

  if (token) {
    // Validate the JWT expiry
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      console.warn('JWT token has expired');
      localStorage.removeItem('jwt');
      return null;
    }
  }

  return token;
};

module.exports.setToken = function (token) {
  if (token) {
    localStorage.setItem('jwt', token);
  } else {
    localStorage.removeItem('jwt');
  }
};

module.exports.clearToken = function () {
  localStorage.removeItem('jwt');
};

module.exports.loadOverlays = function (overlayId) {
  const id = `overlay-${overlayId}`;
  const url = `${CONSTANTS.DEFAULT_ENDPOINT}/admin/geojson/overlay/${overlayId}`;
  const headers = {
    'Content-Type': 'application/json'
  };

  const jwtToken = localStorage.getItem('jwt');
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }

  fetch(url, { headers })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then((data) => {
      // Add to Mapbox
      window.api.map.addSource(id, {
        type: 'geojson',
        data: data
      });

      window.api.map.addLayer({
        id: id,
        type: 'line',
        source: id,
        paint: {
          'line-width': 6,
          'line-color': [
            'match',
            ['get', 'grade'],
            0,
            '#A2FF25', // Grade 0 → Easy
            1,
            '#A2FF25', // Grade 1 → Easy
            2,
            '#FFDD00', // Grade 2 → Medium
            3,
            '#EB3B1A', // Grade 3 → Hard
            4,
            '#EB3B1A', // Grade 4 → Hard
            '#A2FF25' // Default → Easy
          ]
        }
      });
    })
    .catch((error) => {
      console.error('Error loading overlays:', error);
    });
};

module.exports.loadData = function () {
  const jwtToken = localStorage.getItem('jwt');

  this.loadOverlays('north_1');
  this.loadOverlays('north_2');
  this.loadOverlays('south_1');
  this.loadOverlays('south_2');

  const url = 'http://localhost:5050/admin/geojson/fetch';

  const headers = {
    'Content-Type': 'application/json'
  };

  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }

  fetch(url, { headers })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then((data) => {
      window.api.data.set({ map: data });
    })
    .catch((error) => {
      console.error('Error loading data:', error);
    });
};

module.exports.saveData = function (data) {
  const jwtToken = localStorage.getItem('jwt');

  const url = 'http://localhost:5050/admin/geojson/post';

  const headers = {
    'Content-Type': 'application/json'
  };

  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }

  fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data)
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then((data) => {
      window.api.data.set({ map: data });
      alert('Data saved successfully!');
    })
    .catch((error) => {
      console.error('Error saving data:', error);
      alert('Error saving data: ' + error.message);
    });
};
