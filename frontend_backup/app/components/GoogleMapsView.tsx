import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  Platform, 
  Linking, 
  SafeAreaView,
  ScrollView,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 400;

const GoogleMapsView = ({ incident, onClose }: { incident: any; onClose: () => void }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  const colors = {
    text: '#1a1a1a',
    textMuted: '#6c757d',
    background: '#ffffff',
    surface: '#f8f9fa',
    border: '#e9ecef',
    primary: '#2196F3',
    error: '#DC3545',
    warning: '#FFC107',
    success: '#28A745'
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Standort-Berechtigung wird für die Navigation benötigt.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location.coords);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
    } finally {
      setLoading(false);
    }
  };

  const getCoordinates = () => {
    if (incident?.location?.lat && incident?.location?.lng) {
      return {
        lat: parseFloat(incident.location.lat),
        lng: parseFloat(incident.location.lng)
      };
    }
    if (incident?.coordinates?.lat && incident?.coordinates?.lng) {
      return {
        lat: parseFloat(incident.coordinates.lat),
        lng: parseFloat(incident.coordinates.lng)
      };
    }
    return null;
  };

  const coordinates = getCoordinates();

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      case 'low': return colors.success;
      default: return colors.primary;
    }
  };

  // FIXED: Mobile optimized Google Maps integration
  const openInGoogleMaps = async () => {
    if (!coordinates) {
      Alert.alert('Fehler', 'Keine Koordinaten verfügbar.');
      return;
    }

    const { lat, lng } = coordinates;
    
    try {
      // Try to open in Google Maps app first (mobile optimized)
      const googleMapsUrl = Platform.select({
        ios: `comgooglemaps://?q=${lat},${lng}&center=${lat},${lng}&zoom=16`,
        android: `google.navigation:q=${lat},${lng}`,
      });

      const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

      // Check if Google Maps app is available
      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
      
      if (canOpenGoogleMaps) {
        await Linking.openURL(googleMapsUrl);
      } else {
        // Fallback to web version
        const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
        if (canOpenFallback) {
          await Linking.openURL(fallbackUrl);
        } else {
          Alert.alert('Fehler', 'Google Maps kann nicht geöffnet werden.');
        }
      }
    } catch (error) {
      console.error('Maps error:', error);
      Alert.alert('Fehler', 'Karte konnte nicht geöffnet werden.');
    }
  };

  const openNavigation = async () => {
    if (!coordinates || !currentLocation) {
      Alert.alert('Fehler', 'Navigation nicht möglich. Standort erforderlich.');
      return;
    }

    const { lat, lng } = coordinates;
    
    try {
      // Mobile optimized navigation URLs
      const navigationUrl = Platform.select({
        ios: `maps://app?saddr=${currentLocation.latitude},${currentLocation.longitude}&daddr=${lat},${lng}&dirflg=d`,
        android: `google.navigation:q=${lat},${lng}&mode=d`,
      });

      const fallbackUrl = `https://www.google.com/maps/dir/${currentLocation.latitude},${currentLocation.longitude}/${lat},${lng}`;

      const canOpenNavigation = await Linking.canOpenURL(navigationUrl);
      
      if (canOpenNavigation) {
        await Linking.openURL(navigationUrl);
      } else {
        const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
        if (canOpenFallback) {
          await Linking.openURL(fallbackUrl);
        } else {
          Alert.alert('Fehler', 'Navigation kann nicht gestartet werden.');
        }
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Fehler', 'Navigation konnte nicht gestartet werden.');
    }
  };

  const shareLocation = async () => {
    if (!coordinates) {
      Alert.alert('Fehler', 'Keine Koordinaten zum Teilen verfügbar.');
      return;
    }

    const { lat, lng } = coordinates;
    const shareUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    
    try {
      // Use system share functionality (mobile optimized)
      const { Share } = require('react-native');
      await Share.share({
        message: `Standort: ${incident?.title || 'Vorfall'}\n${shareUrl}`,
        title: 'Standort teilen',
        url: shareUrl,
      });
    } catch (error) {
      console.error('Share error:', error);
      // Fallback: copy to clipboard
      Alert.alert(
        'Standort teilen',
        `Standort-Link: ${shareUrl}`,
        [
          { text: 'OK', onPress: () => {} }
        ]
      );
    }
  };

  const mobileStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: isSmallScreen ? 18 : 20,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
      marginRight: 16,
    },
    closeButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    incidentCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    incidentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    priorityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
    },
    priorityText: {
      fontSize: 10,
      fontWeight: '600',
      color: 'white',
    },
    incidentTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    incidentDescription: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 16,
      lineHeight: 20,
    },
    locationSection: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 20,
    },
    locationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    locationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 8,
    },
    coordinatesText: {
      fontSize: 14,
      color: colors.textMuted,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    addressText: {
      fontSize: 14,
      color: colors.text,
      marginTop: 4,
    },
    actionButtons: {
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    successButton: {
      backgroundColor: colors.success,
    },
    warningButton: {
      backgroundColor: colors.warning,
    },
    actionButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textMuted,
    },
    noLocationContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    noLocationText: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 24,
    },
    distanceInfo: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 20,
    },
    distanceText: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
    },
  });

  const calculateDistance = () => {
    if (!coordinates || !currentLocation) return null;
    
    const R = 6371; // Earth's radius in km
    const dLat = (coordinates.lat - currentLocation.latitude) * Math.PI / 180;
    const dLng = (coordinates.lng - currentLocation.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(currentLocation.latitude * Math.PI / 180) * Math.cos(coordinates.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
  };

  if (!coordinates) {
    return (
      <SafeAreaView style={mobileStyles.container}>
        <View style={mobileStyles.header}>
          <View style={mobileStyles.headerContent}>
            <Text style={mobileStyles.headerTitle}>🗺️ Standort-Karte</Text>
            <TouchableOpacity style={mobileStyles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={mobileStyles.noLocationContainer}>
          <Ionicons name="location-outline" size={64} color={colors.textMuted} />
          <Text style={mobileStyles.noLocationText}>
            Für diesen Vorfall sind keine Standortdaten verfügbar.
            {'\n\n'}GPS-Koordinaten konnten nicht gefunden werden.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={mobileStyles.container}>
        <View style={mobileStyles.header}>
          <View style={mobileStyles.headerContent}>
            <Text style={mobileStyles.headerTitle}>🗺️ Standort-Karte</Text>
            <TouchableOpacity style={mobileStyles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={mobileStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={mobileStyles.loadingText}>GPS wird initialisiert...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const distance = calculateDistance();

  return (
    <SafeAreaView style={mobileStyles.container}>
      <View style={mobileStyles.header}>
        <View style={mobileStyles.headerContent}>
          <Text style={mobileStyles.headerTitle}>🗺️ Standort-Karte</Text>
          <TouchableOpacity style={mobileStyles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={mobileStyles.content}>
        <View style={mobileStyles.incidentCard}>
          <View style={mobileStyles.incidentHeader}>
            <View style={[
              mobileStyles.priorityBadge, 
              { backgroundColor: getPriorityColor(incident?.priority) }
            ]}>
              <Text style={mobileStyles.priorityText}>
                {incident?.priority?.toUpperCase() || 'NORMAL'}
              </Text>
            </View>
          </View>
          
          <Text style={mobileStyles.incidentTitle}>
            {incident?.title || 'Unbekannter Vorfall'}
          </Text>
          <Text style={mobileStyles.incidentDescription}>
            {incident?.description || 'Keine Beschreibung verfügbar'}
          </Text>
        </View>

        <View style={mobileStyles.locationSection}>
          <View style={mobileStyles.locationHeader}>
            <Ionicons name="location" size={20} color={colors.primary} />
            <Text style={mobileStyles.locationTitle}>GPS-Koordinaten</Text>
          </View>
          <Text style={mobileStyles.coordinatesText}>
            {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
          </Text>
          {incident?.address && (
            <Text style={mobileStyles.addressText}>{incident.address}</Text>
          )}
        </View>

        {distance && (
          <View style={mobileStyles.distanceInfo}>
            <Text style={mobileStyles.distanceText}>
              📍 Entfernung zu Ihrem Standort: {distance}
            </Text>
          </View>
        )}

        <View style={mobileStyles.actionButtons}>
          <TouchableOpacity
            style={[mobileStyles.actionButton, mobileStyles.primaryButton]}
            onPress={openInGoogleMaps}
            activeOpacity={0.8}
          >
            <Ionicons name="map" size={20} color="white" />
            <Text style={mobileStyles.actionButtonText}>🗺️ In Google Maps öffnen</Text>
          </TouchableOpacity>

          {currentLocation && (
            <TouchableOpacity
              style={[mobileStyles.actionButton, mobileStyles.successButton]}
              onPress={openNavigation}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate" size={20} color="white" />
              <Text style={mobileStyles.actionButtonText}>🧭 Navigation starten</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[mobileStyles.actionButton, mobileStyles.warningButton]}
            onPress={shareLocation}
            activeOpacity={0.8}
          >
            <Ionicons name="share" size={20} color="white" />
            <Text style={mobileStyles.actionButtonText}>📤 Standort teilen</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default GoogleMapsView;