import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Switch,
  Dimensions,
  Image,
  Vibration,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import AddUserModal from './components/AddUserModal';
import DiscordMessages from './components/DiscordMessages';
import GoogleMapsView from './components/GoogleMapsView';

// Get device dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 400;
const isMediumScreen = screenWidth >= 400 && screenWidth < 600;

// Configure notifications for mobile alerts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Theme Context für Dark/Light Mode
const ThemeContext = createContext();

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Fehler beim Laden des Themes:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Fehler beim Speichern des Themes:', error);
    }
  };

  const colors = {
    primary: '#1E40AF',
    secondary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    background: isDarkMode ? '#1F2937' : '#F8FAFC',
    surface: isDarkMode ? '#374151' : '#FFFFFF',
    surfaceVariant: isDarkMode ? '#4B5563' : '#F1F5F9',
    text: isDarkMode ? '#F9FAFB' : '#1E293B',
    textSecondary: isDarkMode ? '#D1D5DB' : '#64748B',
    textMuted: isDarkMode ? '#9CA3AF' : '#94A3B8',
    border: isDarkMode ? '#4B5563' : '#E2E8F0',
    input: isDarkMode ? '#374151' : '#FFFFFF',
    inputBorder: isDarkMode ? '#4B5563' : '#D1D5DB',
    shadow: isDarkMode ? '#000000' : '#64748B',
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.background}
      />
      {children}
    </ThemeContext.Provider>
  );
};

// Auth Context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Base URL für API-Calls
  const BACKEND_BASE_URL = "http://212.227.57.238:8001";

  useEffect(() => {
    checkAuth();
    setupLocationServices();
    setupNotifications();
  }, []);

  // Setup GPS und Location Services für Mobile
  const setupLocationServices = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Standort-Berechtigung erforderlich',
          'Diese App benötigt Zugriff auf Ihren Standort für GPS-Funktionen.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Background location permission for team alerts
      const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus.status !== 'granted') {
        console.warn('Background location permission not granted');
      }
    } catch (error) {
      console.error('Location setup error:', error);
    }
  };

  // Setup Push Notifications für Team Alerts
  const setupNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Benachrichtigungen erforderlich',
          'Diese App benötigt Benachrichtigungen für Team-Alarme.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get notification token for team alerts
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Notification token:', token);
      
      // Send token to backend for team alerts
      if (user) {
        await sendNotificationTokenToBackend(token);
      }
    } catch (error) {
      console.error('Notification setup error:', error);
    }
  };

  const sendNotificationTokenToBackend = async (notificationToken) => {
    try {
      await axios.post(`${BACKEND_BASE_URL}/api/user/notification-token`, {
        token: notificationToken
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error sending notification token:', error);
    }
  };

  const checkAuth = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('authToken');
      const savedUser = await AsyncStorage.getItem('userData');
      
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${BACKEND_BASE_URL}/api/login`, {
        email,
        password
      });

      if (response.data.success) {
        const { token: authToken, user: userData } = response.data;
        
        await AsyncStorage.setItem('authToken', authToken);
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        
        setToken(authToken);
        setUser(userData);
        
        // Setup notifications after login
        setupNotifications();
        
        return { success: true };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Verbindungsfehler' 
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      BACKEND_BASE_URL
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Mobile optimized Login Screen
const LoginScreen = ({ appConfig }) => {
  const [email, setEmail] = useState(__DEV__ ? 'benutzer@stadtwache.de' : '');
  const [password, setPassword] = useState(__DEV__ ? 'sicherPasswort123' : '');
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Fehler', 'Bitte füllen Sie alle Felder aus.');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Anmeldung fehlgeschlagen', result.message);
    }
  };

  const mobileStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      paddingHorizontal: isSmallScreen ? 20 : 40,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: isSmallScreen ? 30 : 50,
    },
    logo: {
      width: isSmallScreen ? 80 : 100,
      height: isSmallScreen ? 80 : 100,
      borderRadius: isSmallScreen ? 40 : 50,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    title: {
      fontSize: isSmallScreen ? 28 : 32,
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: isSmallScreen ? 14 : 16,
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
    },
    formContainer: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: isSmallScreen ? 20 : 30,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 12,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: isSmallScreen ? 12 : 16,
      fontSize: 16,
      color: colors.text,
    },
    loginButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: isSmallScreen ? 14 : 18,
      alignItems: 'center',
      marginTop: 10,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    loginButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    serverInfo: {
      marginTop: 30,
      alignItems: 'center',
    },
    serverText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });

  return (
    <KeyboardAvoidingView 
      style={mobileStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={{ flex: 1, justifyContent: 'center' }}>
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={mobileStyles.logoContainer}>
            <View style={mobileStyles.logo}>
              <Ionicons name="shield-checkmark" size={isSmallScreen ? 40 : 50} color={colors.primary} />
            </View>
            <Text style={mobileStyles.title}>{appConfig.app_name}</Text>
            <Text style={mobileStyles.subtitle}>{appConfig.organization_name}</Text>
          </View>

          <View style={mobileStyles.formContainer}>
            <View style={mobileStyles.inputContainer}>
              <Text style={mobileStyles.label}>E-Mail Adresse</Text>
              <TextInput
                style={mobileStyles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="benutzer@stadtwache.de"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={mobileStyles.inputContainer}>
              <Text style={mobileStyles.label}>Passwort</Text>
              <TextInput
                style={mobileStyles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Passwort eingeben"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <TouchableOpacity 
              style={mobileStyles.loginButton}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="log-in" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={mobileStyles.loginButtonText}>Anmelden</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={mobileStyles.serverInfo}>
            <Text style={mobileStyles.serverText}>Stadtwache Schwelm</Text>
            <Text style={mobileStyles.serverText}>
              Sichere Verbindung • Server: 212.227.57.238:8001
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

// Mobile optimized Main App Component
const MainApp = ({ appConfig, setAppConfig }) => {
  const { user, logout, BACKEND_BASE_URL } = useAuth();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    loadData();
    getCurrentLocation();
    setupLocationTracking();
    listenForTeamAlerts();
  }, []);

  // GPS Location Services
  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location.coords);
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const setupLocationTracking = async () => {
    try {
      await Location.startLocationUpdatesAsync('LOCATION_TRACKING', {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000, // Update every 30 seconds
        distanceInterval: 100, // Update every 100 meters
        foregroundService: {
          notificationTitle: 'Stadtwache GPS',
          notificationBody: 'Standort wird für Team-Koordination verfolgt',
        },
      });
    } catch (error) {
      console.error('Location tracking error:', error);
    }
  };

  // Team Alert System
  const listenForTeamAlerts = () => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const { title, body, data } = notification.request.content;
      
      // Team alert for incidents
      if (data?.type === 'team_alert') {
        triggerTeamAlert(title, body, data);
      }
    });

    return () => subscription.remove();
  };

  const triggerTeamAlert = (title, body, data) => {
    // Vibration for alert
    Vibration.vibrate([1000, 500, 1000]);
    
    // Play alert sound
    playAlertSound();
    
    // Show alert
    Alert.alert(
      title,
      body,
      [
        { text: 'Später', style: 'cancel' },
        { 
          text: 'Anzeigen', 
          onPress: () => {
            if (data.incidentId) {
              loadIncidentDetails(data.incidentId);
            }
          }
        }
      ],
      { cancelable: false }
    );
  };

  const playAlertSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/alert-sound.mp3'),
        { shouldPlay: true }
      );
      await sound.playAsync();
    } catch (error) {
      console.error('Sound error:', error);
    }
  };

  const sendTeamAlert = async (incident, action) => {
    try {
      await axios.post(`${BACKEND_BASE_URL}/api/team/alert`, {
        incidentId: incident.id,
        action: action,
        location: currentLocation,
        userId: user.id
      });
    } catch (error) {
      console.error('Team alert error:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [incidentsResponse, teamResponse] = await Promise.all([
        axios.get(`${BACKEND_BASE_URL}/api/incidents`),
        axios.get(`${BACKEND_BASE_URL}/api/team/members`)
      ]);
      
      setIncidents(incidentsResponse.data || []);
      setTeamMembers(teamResponse.data || []);
    } catch (error) {
      console.error('Load data error:', error);
      Alert.alert('Fehler', 'Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadIncidentDetails = async (incidentId) => {
    try {
      const response = await axios.get(`${BACKEND_BASE_URL}/api/incidents/${incidentId}`);
      setSelectedIncident(response.data);
    } catch (error) {
      console.error('Load incident error:', error);
    }
  };

  // FIXED: Mobile optimized incident actions
  const handleIncidentAction = async (incident, action) => {
    try {
      console.log(`Processing ${action} for incident:`, incident);
      
      // Prevent multiple rapid taps
      if (loading) return;
      setLoading(true);

      const endpoint = `${BACKEND_BASE_URL}/api/incidents/${incident.id}/status`;
      
      let status = 'open';
      switch (action) {
        case 'accept':
          status = 'in_progress';
          break;
        case 'in_progress':
          status = 'in_progress';
          break;
        case 'complete':
          status = 'completed';
          break;
        case 'delete':
          // Delete action
          await axios.delete(`${BACKEND_BASE_URL}/api/incidents/${incident.id}`);
          await loadData();
          await sendTeamAlert(incident, 'deleted');
          setLoading(false);
          return;
      }

      const response = await axios.put(endpoint, { 
        status,
        userId: user.id,
        location: currentLocation 
      });

      if (response.data.success) {
        // Send team alert for status changes
        await sendTeamAlert(incident, action);
        
        // Reload data
        await loadData();
        
        // Show success feedback
        Alert.alert(
          'Erfolgreich',
          `Vorfall wurde ${getActionText(action)}.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error(`${action} error:`, error);
      Alert.alert(
        'Fehler',
        `Vorfall konnte nicht ${getActionText(action)} werden.`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case 'accept': return 'angenommen';
      case 'in_progress': return 'in Bearbeitung gesetzt';
      case 'complete': return 'abgeschlossen';
      case 'delete': return 'gelöscht';
      default: return 'bearbeitet';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      case 'low': return colors.success;
      default: return colors.primary;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return colors.success;
      case 'in_progress': return colors.warning;
      case 'open': return colors.error;
      default: return colors.textMuted;
    }
  };

  // Mobile optimized styles
  const mobileStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.surface,
      paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
      paddingHorizontal: 16,
      paddingBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 10,
    },
    headerTitle: {
      fontSize: isSmallScreen ? 18 : 20,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      padding: 8,
      marginLeft: 8,
      borderRadius: 8,
      backgroundColor: colors.surfaceVariant,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      marginHorizontal: 4,
    },
    activeTab: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    activeTabText: {
      color: 'white',
    },
    content: {
      flex: 1,
    },
    incidentCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      shadowColor: colors.shadow,
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
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      flex: 1,
      alignItems: 'center',
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      color: 'white',
    },
    incidentTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    incidentDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    incidentLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    locationText: {
      fontSize: 12,
      color: colors.textMuted,
      marginLeft: 4,
    },
    actionButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      minWidth: (screenWidth - 64) / 2 - 4,
      justifyContent: 'center',
    },
    acceptButton: {
      backgroundColor: colors.success,
    },
    progressButton: {
      backgroundColor: colors.warning,
    },
    completeButton: {
      backgroundColor: colors.primary,
    },
    deleteButton: {
      backgroundColor: colors.error,
    },
    mapButton: {
      backgroundColor: colors.secondary,
    },
    actionButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.text,
    },
  });

  // FIXED: Mobile optimized incident action buttons  
  const renderActionButtons = (incident) => {
    const buttons = [];
    
    if (incident.status !== 'in_progress' && incident.status !== 'completed') {
      buttons.push(
        <TouchableOpacity
          key="accept"
          style={[mobileStyles.actionButton, mobileStyles.acceptButton]}
          onPress={() => handleIncidentAction(incident, 'accept')}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={16} color="white" />
          <Text style={mobileStyles.actionButtonText}>Annehmen</Text>
        </TouchableOpacity>
      );
    }

    if (incident.status === 'in_progress') {
      buttons.push(
        <TouchableOpacity
          key="complete"
          style={[mobileStyles.actionButton, mobileStyles.completeButton]}
          onPress={() => handleIncidentAction(incident, 'complete')}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-done" size={16} color="white" />
          <Text style={mobileStyles.actionButtonText}>Abschließen</Text>
        </TouchableOpacity>
      );
    }

    if (incident.status !== 'completed') {
      buttons.push(
        <TouchableOpacity
          key="in_progress"
          style={[mobileStyles.actionButton, mobileStyles.progressButton]}
          onPress={() => handleIncidentAction(incident, 'in_progress')}
          activeOpacity={0.8}
        >
          <Ionicons name="time" size={16} color="white" />
          <Text style={mobileStyles.actionButtonText}>Bearbeitung</Text>
        </TouchableOpacity>
      );
    }

    // Map button
    if (incident.location || incident.coordinates) {
      buttons.push(
        <TouchableOpacity
          key="map"
          style={[mobileStyles.actionButton, mobileStyles.mapButton]}
          onPress={() => {
            setSelectedIncident(incident);
            setShowMap(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="map" size={16} color="white" />
          <Text style={mobileStyles.actionButtonText}>🗺️ Karte</Text>
        </TouchableOpacity>
      );
    }

    // Delete button (admin only)
    if (user?.role === 'admin') {
      buttons.push(
        <TouchableOpacity
          key="delete"
          style={[mobileStyles.actionButton, mobileStyles.deleteButton]}
          onPress={() => {
            Alert.alert(
              'Vorfall löschen',
              'Sind Sie sicher, dass Sie diesen Vorfall löschen möchten?',
              [
                { text: 'Abbrechen', style: 'cancel' },
                { 
                  text: 'Löschen', 
                  style: 'destructive',
                  onPress: () => handleIncidentAction(incident, 'delete')
                }
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="trash" size={16} color="white" />
          <Text style={mobileStyles.actionButtonText}>Löschen</Text>
        </TouchableOpacity>
      );
    }

    return buttons;
  };

  const renderIncidentCard = (incident) => (
    <View key={incident.id} style={mobileStyles.incidentCard}>
      <View style={mobileStyles.incidentHeader}>
        <View style={[mobileStyles.priorityBadge, { backgroundColor: getPriorityColor(incident.priority) }]}>
          <Text style={mobileStyles.priorityText}>
            {incident.priority?.toUpperCase() || 'NORMAL'}
          </Text>
        </View>
        <View style={[mobileStyles.statusBadge, { backgroundColor: getStatusColor(incident.status) }]}>
          <Text style={mobileStyles.statusText}>
            {incident.status?.toUpperCase() || 'OFFEN'}
          </Text>
        </View>
      </View>

      <Text style={mobileStyles.incidentTitle}>{incident.title || 'Unbekannter Vorfall'}</Text>
      <Text style={mobileStyles.incidentDescription}>
        {incident.description || 'Keine Beschreibung verfügbar'}
      </Text>

      {(incident.location || incident.coordinates) && (
        <View style={mobileStyles.incidentLocation}>
          <Ionicons name="location" size={16} color={colors.textMuted} />
          <Text style={mobileStyles.locationText}>
            {incident.address || 'Standort verfügbar'}
          </Text>
        </View>
      )}

      <View style={mobileStyles.actionButtons}>
        {renderActionButtons(incident)}
      </View>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={mobileStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={mobileStyles.loadingText}>Daten werden geladen...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <ScrollView
            style={mobileStyles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          >
            {incidents.length === 0 ? (
              <View style={mobileStyles.emptyState}>
                <Ionicons name="clipboard-outline" size={64} color={colors.textMuted} />
                <Text style={mobileStyles.emptyText}>Keine Vorfälle vorhanden</Text>
              </View>
            ) : (
              incidents.map(renderIncidentCard)
            )}
          </ScrollView>
        );
      case 'team':
        return (
          <View style={mobileStyles.content}>
            <Text style={mobileStyles.emptyText}>Team-Übersicht wird geladen...</Text>
          </View>
        );
      case 'settings':
        return (
          <ScrollView style={mobileStyles.content}>
            <View style={mobileStyles.incidentCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={mobileStyles.incidentTitle}>Dark Mode</Text>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[mobileStyles.incidentCard, { alignItems: 'center' }]}
              onPress={logout}
            >
              <Ionicons name="log-out" size={24} color={colors.error} />
              <Text style={[mobileStyles.incidentTitle, { color: colors.error, marginTop: 8 }]}>
                Abmelden
              </Text>
            </TouchableOpacity>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={mobileStyles.container}>
      <View style={mobileStyles.header}>
        <View style={mobileStyles.headerContent}>
          <Text style={mobileStyles.headerTitle}>
            {appConfig.app_name} - {user?.name}
          </Text>
          <View style={mobileStyles.headerButtons}>
            <TouchableOpacity
              style={mobileStyles.headerButton}
              onPress={() => setShowAddUser(true)}
            >
              <Ionicons name="person-add" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={mobileStyles.headerButton}
              onPress={() => setShowMessages(true)}
            >
              <Ionicons name="chatbubbles" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={mobileStyles.tabContainer}>
        {[
          { key: 'dashboard', icon: 'grid', label: 'Dashboard' },
          { key: 'team', icon: 'people', label: 'Team' },
          { key: 'settings', icon: 'settings', label: 'Einstellungen' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              mobileStyles.tab,
              activeTab === tab.key && mobileStyles.activeTab,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? 'white' : colors.textSecondary}
            />
            <Text
              style={[
                mobileStyles.tabText,
                activeTab === tab.key && mobileStyles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {renderContent()}

      {/* Mobile optimized modals */}
      <Modal
        visible={showAddUser}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <AddUserModal
          onClose={() => setShowAddUser(false)}
          onUserAdded={loadData}
        />
      </Modal>

      <Modal
        visible={showMessages}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <DiscordMessages onClose={() => setShowMessages(false)} />
      </Modal>

      <Modal
        visible={showMap}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <GoogleMapsView
          incident={selectedIncident}
          onClose={() => {
            setShowMap(false);
            setSelectedIncident(null);
          }}
        />
      </Modal>
    </SafeAreaView>
  );
};

// App Content Wrapper
const AppContent = () => {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  
  // App Configuration States
  const [appConfig, setAppConfig] = useState({
    app_name: 'Stadtwache',
    app_subtitle: 'Polizei Management System',
    app_icon: null,
    organization_name: 'Sicherheitsbehörde Schwelm',
    primary_color: '#1E40AF',
    secondary_color: '#3B82F6'
  });

  const API_URL = "http://212.227.57.238:8001";

  // Load app configuration
  const loadAppConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/app/config`);
      setAppConfig(response.data);
      console.log('📱 App configuration loaded:', response.data);
    } catch (error) {
      console.error('❌ Failed to load app configuration:', error);
    }
  };

  useEffect(() => {
    loadAppConfig();
  }, []);

  const dynamicStyles = StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 20,
      fontSize: 18,
      color: colors.text,
      fontWeight: '600',
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={dynamicStyles.loadingText}>Stadtwache wird geladen...</Text>
      </SafeAreaView>
    );
  }

  return user ? <MainApp appConfig={appConfig} setAppConfig={setAppConfig} /> : <LoginScreen appConfig={appConfig} />;
};

// Main App Component
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}