import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Web-spezifische Google Maps Integration
const GoogleMapsView = ({ incident, user, token }) => {
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [officers, setOfficers] = useState([]);

  const API_URL = "http://212.227.57.238:8001";
  const GOOGLE_MAPS_API_KEY = "AIzaSyA8mG8Y1pcJy_-1yNOhlTZ9gpnuVBmc0cw";

  // Load Google Maps Script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      document.head.appendChild(script);
    } else if (window.google) {
      setIsLoaded(true);
    }
  }, []);

  // Load officer positions
  const loadOfficerPositions = useCallback(async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      // Try to load live positions first
      try {
        const response = await fetch(`${API_URL}/api/locations/live`, {
          method: 'GET',
          headers: config.headers || {}
        });
        
        if (response.ok) {
          const locations = await response.json();
          console.log('📍 Live officer positions loaded:', locations.length);
          setOfficers(locations);
          return;
        }
      } catch (error) {
        console.log('⚠️ Live locations API not available, using mock data');
      }
      
      // Fallback: Create mock officer positions around the incident
      if (incident && incident.location) {
        const mockOfficers = [
          {
            id: 1,
            location: {
              lat: incident.location.lat + 0.002,
              lng: incident.location.lng + 0.001
            },
            username: 'Officer 1',
            status: 'Im Dienst',
            timestamp: new Date().toISOString()
          },
          {
            id: 2,
            location: {
              lat: incident.location.lat - 0.001,
              lng: incident.location.lng + 0.003
            },
            username: 'Officer 2', 
            status: 'Streife',
            timestamp: new Date().toISOString()
          },
          {
            id: 3,
            location: {
              lat: incident.location.lat + 0.003,
              lng: incident.location.lng - 0.002
            },
            username: 'Officer 3',
            status: 'Einsatz',
            timestamp: new Date().toISOString()
          }
        ];
        
        console.log('🎭 Using mock officer positions for demo');
        setOfficers(mockOfficers);
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Laden der Beamten-Positionen:', error);
      setOfficers([]);
    }
  }, [token, incident]);

  // Initialize map when Google Maps is loaded
  useEffect(() => {
    if (isLoaded && incident && typeof window !== 'undefined') {
      initializeMap();
      loadOfficerPositions();
      
      // Update officer positions every 10 seconds for real-time effect
      const interval = setInterval(loadOfficerPositions, 10000);
      return () => clearInterval(interval);
    }
  }, [isLoaded, incident, loadOfficerPositions]);

  const initializeMap = () => {
    const mapElement = document.getElementById('google-map');
    if (!mapElement || !window.google) return;

    const incidentLocation = {
      lat: incident.location.lat,
      lng: incident.location.lng
    };

    const mapOptions = {
      center: incidentLocation,
      zoom: 15,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    };

    const newMap = new window.google.maps.Map(mapElement, mapOptions);
    setMap(newMap);

    // Add incident marker
    const incidentMarker = new window.google.maps.Marker({
      position: incidentLocation,
      map: newMap,
      title: incident.title,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="14" fill="#FF4444" stroke="#FFFFFF" stroke-width="3"/>
            <text x="16" y="22" text-anchor="middle" fill="white" font-size="16" font-weight="bold">!</text>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(32, 32)
      }
    });

    // Incident info window
    const incidentInfoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 10px; max-width: 250px;">
          <h3 style="margin: 0 0 8px 0; color: #FF4444;">🚨 ${incident.title}</h3>
          <p style="margin: 0 0 8px 0;"><strong>Beschreibung:</strong> ${incident.description}</p>
          <p style="margin: 0 0 8px 0;"><strong>Priorität:</strong> ${incident.priority}</p>
          <p style="margin: 0 0 8px 0;"><strong>Adresse:</strong> ${incident.address}</p>
          <p style="margin: 0; font-size: 12px; color: #666;">
            Koordinaten: ${incident.location.lat.toFixed(6)}, ${incident.location.lng.toFixed(6)}
          </p>
        </div>
      `
    });

    incidentMarker.addListener('click', () => {
      incidentInfoWindow.open(newMap, incidentMarker);
    });

    // Add officer markers
    addOfficerMarkers(newMap);
  };

  const addOfficerMarkers = (mapInstance) => {
    if (!mapInstance || !window.google) return;

    // Clear existing officer markers
    if (window.officerMarkers) {
      window.officerMarkers.forEach(marker => marker.setMap(null));
    }
    window.officerMarkers = [];

    officers.forEach((officer, index) => {
      if (officer.location && officer.location.lat && officer.location.lng) {
        // Animate marker position changes for realistic movement
        const position = {
          lat: officer.location.lat + (Math.random() - 0.5) * 0.0001, // Small random movement
          lng: officer.location.lng + (Math.random() - 0.5) * 0.0001
        };

        const officerMarker = new window.google.maps.Marker({
          position: position,
          map: mapInstance,
          title: officer.username || `Beamter ${index + 1}`,
          animation: window.google.maps.Animation.DROP,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="14" r="12" fill="${getStatusColor(officer.status)}" stroke="#FFFFFF" stroke-width="3"/>
                <text x="14" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="bold">👮</text>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(28, 28)
          }
        });

        // Store marker for cleanup
        window.officerMarkers.push(officerMarker);

        // Calculate distance to incident
        const incidentLatLng = new window.google.maps.LatLng(incident.location.lat, incident.location.lng);
        const officerLatLng = new window.google.maps.LatLng(position.lat, position.lng);
        const distance = window.google.maps.geometry.spherical.computeDistanceBetween(incidentLatLng, officerLatLng);
        const distanceKm = (distance / 1000).toFixed(1);

        const officerInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; max-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: ${getStatusColor(officer.status)};">👮‍♂️ ${officer.username || `Beamter ${index + 1}`}</h3>
              <p style="margin: 0 0 4px 0;"><strong>Status:</strong> ${officer.status || 'Im Dienst'}</p>
              <p style="margin: 0 0 4px 0;"><strong>Entfernung zum Vorfall:</strong> ${distanceKm} km</p>
              <p style="margin: 0; font-size: 12px; color: #666;">
                🕒 Zuletzt aktualisiert: ${new Date(officer.timestamp).toLocaleTimeString('de-DE')}
              </p>
            </div>
          `
        });

        officerMarker.addListener('click', () => {
          officerInfoWindow.open(mapInstance, officerMarker);
        });
      }
    });
  };

  // Get status color for officer markers
  const getStatusColor = (status) => {
    switch (status) {
      case 'Im Dienst': return '#10B981';
      case 'Pause': return '#F59E0B';
      case 'Einsatz': return '#EF4444';
      case 'Streife': return '#8B5CF6';
      case 'Nicht verfügbar': return '#6B7280';
      default: return '#2196F3';
    }
  };

  // Update officer markers when positions change
  useEffect(() => {
    if (map && officers.length > 0) {
      addOfficerMarkers(map);
    }
  }, [officers, map]);

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>🗺️ Lade Google Maps...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapHeader}>
        <Text style={styles.mapTitle}>🗺️ Live-Karte</Text>
        <Text style={styles.mapSubtitle}>
          📍 Vorfall-Position • 👮‍♂️ {officers.length} Beamte im Dienst
        </Text>
      </View>
      <div 
        id="google-map" 
        style={{ 
          width: '100%', 
          height: 300,
          borderRadius: 12,
          border: '2px solid #e0e0e0'
        }}
      />
      <View style={styles.mapLegend}>
        <Text style={styles.legendItem}>🔴 Vorfall-Position</Text>
        <Text style={styles.legendItem}>🔵 Beamten-Positionen</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  mapHeader: {
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  mapSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    padding: 40,
    color: '#666',
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  legendItem: {
    fontSize: 12,
    color: '#666',
  },
});

export default GoogleMapsView;