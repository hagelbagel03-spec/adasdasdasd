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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
// Map functionality disabled for web compatibility
import AddUserModal from './components/AddUserModal';
import DiscordMessages from './components/DiscordMessages';
import GoogleMapsView from './components/GoogleMapsView';

const { width, height } = Dimensions.get('window');

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
      console.error('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try {
      await AsyncStorage.setItem('theme', newMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const theme = {
    isDarkMode,
    toggleTheme,
    colors: isDarkMode ? {
      // Dark Theme
      primary: '#3B82F6',          // Professional Blue
      secondary: '#60A5FA',        // Lighter Blue
      accent: '#22D3EE',           // Cyan accent
      success: '#10B981',          // Professional Green
      warning: '#F59E0B',          // Professional Orange
      error: '#EF4444',            // Professional Red
      background: '#0F172A',       // Dark Navy
      surface: '#1E293B',          // Dark Surface
      card: '#334155',             // Card Background
      elevated: '#475569',         // Elevated surfaces
      text: '#F8FAFC',             // Light text
      textSecondary: '#CBD5E1',    // Medium text
      textMuted: '#94A3B8',        // Muted text
      border: '#475569',           // Dark border
      shadow: 'rgba(0, 0, 0, 0.4)',
      overlay: 'rgba(0, 0, 0, 0.6)',
    } : {
      // Light Theme
      primary: '#1E40AF',          // Professional Blue
      secondary: '#3B82F6',        // Lighter Blue
      accent: '#06B6D4',           // Cyan accent
      success: '#059669',          // Professional Green
      warning: '#D97706',          // Professional Orange
      error: '#DC2626',            // Professional Red
      background: '#F8FAFC',       // Soft White
      surface: '#FFFFFF',          // Pure White
      card: '#FFFFFF',             // Card Background
      elevated: '#F1F5F9',         // Elevated surfaces
      text: '#0F172A',             // Dark text
      textSecondary: '#334155',    // Medium text
      textMuted: '#64748B',        // Light text
      border: '#E2E8F0',           // Light border
      shadow: 'rgba(15, 23, 42, 0.08)',
      overlay: 'rgba(15, 23, 42, 0.4)',
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

// Auth Context
const AuthContext = React.createContext(null);

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
  
const BACKEND_BASE_URL = "http://212.227.57.238:8001";

  useEffect(() => {
    checkAuthState();
    setupAxiosInterceptors();
  }, []);

  const setupAxiosInterceptors = () => {
    // Response Interceptor für automatische Token-Erneuerung
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          console.log('🔄 401 Fehler - Versuche Token-Erneuerung...');
          
          try {
            const savedToken = await AsyncStorage.getItem('stadtwache_token');
            const savedUser = await AsyncStorage.getItem('stadtwache_user');
            
            if (savedToken && savedUser) {
              // Teste Token erneut
              const response = await axios.get(`${BACKEND_BASE_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${savedToken}` }
              });
              
              // Token ist wieder gültig
              console.log('✅ Token wieder gültig nach Server-Neustart');
              axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
              originalRequest.headers['Authorization'] = `Bearer ${savedToken}`;
              
              // Wiederhole Original-Request
              return axios(originalRequest);
            }
          } catch (retryError) {
            console.log('❌ Token-Erneuerung fehlgeschlagen, Logout...');
            // Nur bei echtem Token-Fehler ausloggen
            await AsyncStorage.removeItem('stadtwache_token');
            await AsyncStorage.removeItem('stadtwache_user');
            setUser(null);
            setToken(null);
            delete axios.defaults.headers.common['Authorization'];
          }
        }
        
        return Promise.reject(error);
      }
    );
  };

  const checkAuthState = async () => {
    try {
      // Versuche gespeicherten Token zu laden
      const savedToken = await AsyncStorage.getItem('stadtwache_token');
      const savedUser = await AsyncStorage.getItem('stadtwache_user');
      
      if (savedToken && savedUser) {
        console.log('🔐 Gespeicherte Login-Daten gefunden');
        
        // Validiere Token mit Backend
        try {
          const response = await axios.get(`${BACKEND_BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` }
          });
          
          console.log('✅ Token noch gültig, Auto-Login...');
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
          
        } catch (error) {
          console.log('❌ Token abgelaufen, lösche gespeicherte Daten');
          await AsyncStorage.removeItem('stadtwache_token');
          await AsyncStorage.removeItem('stadtwache_user');
        }
      }
    } catch (error) {
      console.error('❌ Auto-Login Fehler:', error);
    } finally {
      // Kurze Verzögerung für bessere UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${BACKEND_BASE_URL}/api/auth/login`, {
        email,
        password
      });

      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      
      await AsyncStorage.setItem('stadtwache_token', access_token);
      await AsyncStorage.setItem('stadtwache_user', JSON.stringify(userData));
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Verbindung zum Server fehlgeschlagen. Bitte versuchen Sie es später erneut.' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${BACKEND_BASE_URL}/api/auth/register`, userData);
      return { success: true, user: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Registrierung fehlgeschlagen. Bitte versuchen Sie es später erneut.' 
      };
    }
  };

  const updateUser = async (updatedData) => {
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    await AsyncStorage.setItem('stadtwache_user', JSON.stringify(updatedUser));
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem('stadtwache_token');
    await AsyncStorage.removeItem('stadtwache_user');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Modern Login Screen
const LoginScreen = ({ appConfig }) => {
  const { login } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);


  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Fehler', 'Bitte E-Mail und Passwort eingeben');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Verbindungsfehler', result.error);
    }
  };

  // Schnell-Login entfernt auf Benutzerwunsch

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
    },
    content: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 50,
    },
    logoContainer: {
      marginBottom: 24,
    },
    logoCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    title: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#FFFFFF',
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 18,
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
    },
    form: {
      marginBottom: 40,
    },
    inputGroup: {
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.9)',
      marginBottom: 8,
    },
    input: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      fontSize: 16,
      color: '#FFFFFF',
      backdropFilter: 'blur(10px)',
    },
    loginButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      paddingVertical: 18,
      paddingHorizontal: 32,
      borderRadius: 12,
      marginTop: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    loginButtonDisabled: {
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },
    loginButtonText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '700',
      marginLeft: 12,
    },
    registerLink: {
      alignItems: 'center',
      marginTop: 24,
      paddingVertical: 12,
    },
    registerLinkText: {
      color: colors.textSecondary,
      fontSize: 16,
      textDecorationLine: 'underline',
    },
    demoInfo: {
      marginTop: 24,
      padding: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    demoText: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 6,
    },
    demoSubtext: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 14,
      textAlign: 'center',
    },
    footer: {
      alignItems: 'center',
    },
    footerText: {
      fontSize: 18,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.9)',
      marginBottom: 4,
    },
    footerSubtext: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.6)',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <KeyboardAvoidingView 
        style={dynamicStyles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={dynamicStyles.header}>
          <View style={dynamicStyles.logoContainer}>
            <View style={dynamicStyles.logoCircle}>
              <Ionicons name="shield-checkmark" size={50} color="#FFFFFF" />
            </View>
          </View>
          <Text style={dynamicStyles.title}>{appConfig.app_name}</Text>
          <Text style={dynamicStyles.subtitle}>{appConfig.organization_name}</Text>
        </View>

        <View style={dynamicStyles.form}>
          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>E-Mail Adresse</Text>
            <TextInput
              style={dynamicStyles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="benutzer@stadtwache.de"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>Passwort</Text>
            <TextInput
              style={dynamicStyles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Passwort eingeben"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[dynamicStyles.loginButton, loading && dynamicStyles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Ionicons name="log-in" size={24} color={colors.primary} />
                <Text style={dynamicStyles.loginButtonText}>Anmelden</Text>
              </>
            )}
          </TouchableOpacity>


        </View>

        <View style={dynamicStyles.footer}>
          <Text style={dynamicStyles.footerText}>Stadtwache Schwelm</Text>
          <Text style={dynamicStyles.footerSubtext}>
            Sichere Verbindung • Server: 212.227.57.238:8001
          </Text>
        </View>


      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Modern Map View for Incidents - Web-compatible version
const IncidentMapModal = ({ visible, onClose, incident }) => {
  const { colors } = useTheme();
  
  const dynamicStyles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
      backgroundColor: colors.card,
      borderRadius: 8,
    },
    mapContainer: {
      flex: 1,
      margin: 16,
      borderRadius: 16,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    webMapContainer: {
      flex: 1,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mapPlaceholder: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
    },
    incidentInfo: {
      backgroundColor: colors.surface,
      margin: 16,
      padding: 20,
      borderRadius: 16,
      elevation: 4,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    incidentTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    incidentDetail: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    priorityBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginTop: 8,
    },
    priorityText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return colors.textMuted;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={dynamicStyles.modalContainer}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity style={dynamicStyles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>Vorfall auf Karte</Text>
          <View style={{ width: 40 }} />
        </View>

        {incident ? (
          <GoogleMapsView incident={incident} />
        ) : (
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background
          }}>
            <Ionicons name="warning" size={64} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 16 }}>
              Keine Vorfall-Daten verfügbar
            </Text>
          </View>
        )}

        {incident && (
          <View style={dynamicStyles.incidentInfo}>
            <Text style={dynamicStyles.incidentTitle}>{incident.title}</Text>
            <Text style={dynamicStyles.incidentDetail}>📍 {incident.address}</Text>
            <Text style={dynamicStyles.incidentDetail}>
              🕒 {new Date(incident.created_at).toLocaleString('de-DE')}
            </Text>
            <Text style={dynamicStyles.incidentDetail}>📝 {incident.description}</Text>
            
            <View style={[
              dynamicStyles.priorityBadge,
              { backgroundColor: getPriorityColor(incident.priority) }
            ]}>
              <Text style={dynamicStyles.priorityText}>
                {incident.priority === 'high' ? '🚨 HOHE PRIORITÄT' : 
                 incident.priority === 'medium' ? '⚠️ MITTLERE PRIORITÄT' : 
                 '✅ NIEDRIGE PRIORITÄT'}
              </Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// Modern Main App
const MainApp = ({ appConfig, setAppConfig }) => {
  const { user, updateUser, logout, token } = useAuth();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('home');
  const [stats, setStats] = useState({ incidents: 0, officers: 0, messages: 0 });
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAdminSettingsModal, setShowAdminSettingsModal] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);

  // SOS Alarm Function - Send real notification with GPS to all team members
  const sendSOSAlarm = async () => {
    try {
      console.log('🚨 SOS-Alarm wird gesendet...');
      
      // Vibration/Sound Alarm
      if (Platform.OS !== 'web') {
        try {
          const { Haptics } = require('expo-haptics');
          if (Haptics) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 500);
            setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 1000);
          }
        } catch (hapticsError) {
          console.log('⚠️ Haptics nicht verfügbar:', hapticsError.message);
        }
      }

      // Get GPS location with robust error handling
      let locationData = null;
      let locationStatus = 'Nicht verfügbar';
      
      try {
        console.log('📍 Starte GPS-Standort-Ermittlung...');
        
        // Import Location dynamically to avoid issues
        const Location = require('expo-location');
        
        // Request permissions
        console.log('📍 Fordere GPS-Berechtigung an...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          console.log('✅ GPS-Berechtigung erhalten');
          
          // Get current position with timeout
          const location = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              timeout: 10000,
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('GPS Timeout')), 12000)
            )
          ]);
          
          locationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp
          };
          
          locationStatus = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
          console.log('✅ GPS-Standort ermittelt:', locationData);
          
        } else {
          console.log('❌ GPS-Berechtigung verweigert');
          locationStatus = 'Berechtigung verweigert';
        }
        
      } catch (locationError) {
        console.log('⚠️ GPS-Fehler:', locationError.message);
        locationStatus = `Fehler: ${locationError.message}`;
        
        // App soll NICHT crashen bei GPS-Problemen
        locationData = null;
      }

      // Send emergency broadcast to all team members (GPS or not)
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      const emergencyData = {
        type: 'sos_alarm',
        message: `🚨 NOTFALL-ALARM von ${user?.username}`,
        sender_id: user?.id,
        sender_name: user?.username,
        location: locationData,
        location_status: locationStatus,
        timestamp: new Date().toISOString(),
        priority: 'critical'
      };

      console.log('📡 Sende Notfall-Broadcast:', emergencyData);
      
      await axios.post(`${BACKEND_BASE_URL}/api/emergency/broadcast`, emergencyData, config);
      
      setShowSOSModal(false);
      
      const successMessage = locationData 
        ? `Alle Team-Mitglieder wurden alarmiert!\n📍 Standort: ${locationStatus}\n⚡ Genauigkeit: ±${Math.round(locationData.accuracy || 0)}m`
        : `Alle Team-Mitglieder wurden alarmiert!\n📍 Standort: ${locationStatus}`;
      
      Alert.alert(
        '🚨 SOS-ALARM GESENDET!', 
        successMessage,
        [{ text: 'OK', style: 'default' }]
      );
      
    } catch (error) {
      console.error('❌ SOS-Alarm Fehler:', error);
      
      // Auch bei Fehlern versuchen eine Basis-Nachricht zu senden
      try {
        const fallbackData = {
          type: 'sos_alarm',
          message: `🚨 NOTFALL-ALARM von ${user?.username} (Fallback)`,
          sender_id: user?.id,
          sender_name: user?.username,
          location: null,
          location_status: 'Unbekannt - Technischer Fehler',
          timestamp: new Date().toISOString(),
          priority: 'critical'
        };
        
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        await axios.post(`${BACKEND_BASE_URL}/api/emergency/broadcast`, fallbackData, config);
        
        Alert.alert('🚨 SOS-ALARM GESENDET!', 'Notfall-Alarm wurde gesendet (ohne GPS-Standort)');
        setShowSOSModal(false);
        
      } catch (fallbackError) {
        console.error('❌ Auch Fallback-Alarm fehlgeschlagen:', fallbackError);
        Alert.alert('❌ Kritischer Fehler', 'SOS-Alarm konnte nicht gesendet werden. Bitte direkt Kollegen kontaktieren!');
      }
    }
  };
  
  // Profile states
  const [userStatus, setUserStatus] = useState(user?.status || 'Im Dienst');
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    phone: user?.phone || '',
    service_number: user?.service_number || '',
    rank: user?.rank || '',
    department: user?.department || '',
    photo: user?.photo || ''
  });

  // Incident states
  const [incidentFormData, setIncidentFormData] = useState({
    title: '',
    description: '',
    location: '',
    coordinates: null,
    priority: 'medium',
    incident_type: 'general',
    photo: '' // base64 encoded photo (optional)
  });
  const [submittingIncident, setSubmittingIncident] = useState(false);
  
  // Admin Settings States
  const [adminSettingsData, setAdminSettingsData] = useState({
    app_name: '',
    app_subtitle: '',
    app_icon: '',
    organization_name: '',
    primary_color: '',
    secondary_color: ''
  });

  // Report/Berichte states
  const [reports, setReports] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportDetailModal, setShowReportDetailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [reportFormData, setReportFormData] = useState({
    title: '',
    content: '',
    shift_date: new Date().toISOString().split('T')[0],
    images: [] // Array for multiple images like incidents
  });
  const [savingReport, setSavingReport] = useState(false);

  // Team states
  const [usersByStatus, setUsersByStatus] = useState({});
  const [teamLoading, setTeamLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Incidents states
  const [showIncidentsScreen, setShowIncidentsScreen] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [showIncidentDetailModal, setShowIncidentDetailModal] = useState(false);
  const [editingIncident, setEditingIncident] = useState(false);
  const [showIncidentMap, setShowIncidentMap] = useState(false);
  const [showAllIncidentsModal, setShowAllIncidentsModal] = useState(false);
  
  // Private Messaging States
  const [showPrivateMessageModal, setShowPrivateMessageModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [privateMessage, setPrivateMessage] = useState('');
  const [privateMessages, setPrivateMessages] = useState([]);
  const [sendingPrivateMessage, setSendingPrivateMessage] = useState(false);
  
  // Chat Management States
  const [recentMessages, setRecentMessages] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showAllMessagesModal, setShowAllMessagesModal] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatReply, setChatReply] = useState('');
  
  // Private Chat Management States
  const [privateChats, setPrivateChats] = useState([]);
  const [showChatOptions, setShowChatOptions] = useState(null);
  const [editingChatName, setEditingChatName] = useState(null);
  const [newChatName, setNewChatName] = useState('');
  const [chatList, setChatList] = useState([]);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Channel States
  const [selectedChannel, setSelectedChannel] = useState('general');
  const [channelMessages, setChannelMessages] = useState({});
  
  // Location States
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  
  // Incident Form States
  const [sendingMessage, setSendingMessage] = useState(false);
  const [location, setLocation] = useState(''); // Missing location state
  
  // Notifications States
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  // Database states
  const [persons, setPersons] = useState([]);  
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showPersonDetailModal, setShowPersonDetailModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [personFilter, setPersonFilter] = useState('all');
  const [personFormData, setPersonFormData] = useState({
    first_name: '',
    last_name: '',
    address: '',
    age: '',
    birth_date: '',
    status: 'vermisst',
    description: '',
    last_seen_location: '',
    last_seen_date: '',
    contact_info: '',
    case_number: '',
    priority: 'medium',
    photo: '' // base64 encoded photo
  });
  const [personStats, setPersonStats] = useState({
    total_persons: 0,
    missing_persons: 0,
    wanted_persons: 0,
    found_persons: 0
  });
  const [savingPerson, setSavingPerson] = useState(false);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  
  const API_URL = "http://212.227.57.238:8001";
  
  useEffect(() => {
    if (selectedChannel && selectedChannel !== 'private') {
      loadChannelMessages(selectedChannel);
    }
  }, [selectedChannel]);

  useEffect(() => {
    loadData();
    loadRecentMessages();
    loadChatList();
    // Load initial channel messages
    loadChannelMessages('general');
    loadChannelMessages('emergency');  
    loadChannelMessages('service');
    if (user) {
      setUserStatus(user.status || 'Im Dienst');
      setProfileData({
        username: user.username || '',
        phone: user.phone || '',
        service_number: user.service_number || '',
        rank: user.rank || '',
        department: user.department || ''
      });
      
      // Starte automatische Aktualisierung
      startAutoRefresh();
    }
    
    return () => {
      stopAutoRefresh();
    };
  }, [user]);

  // Auto-refresh Setup
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);

  const startAutoRefresh = () => {
    // Verhindere mehrere Intervalle
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    // Aktualisiere alle 30 Sekunden
    const interval = setInterval(() => {
      console.log('🔄 Auto-Aktualisierung der Daten...');
      
      // Aktuelle Tab-Daten aktualisieren
      if (activeTab === 'home') {
        loadData();
        loadRecentMessages();
      } else if (activeTab === 'team') {
        loadUsersByStatus();
      } else if (activeTab === 'database') {
        loadPersons();
        loadPersonStats();
      } else if (activeTab === 'berichte') {
        loadReports();
      }
    }, 30000); // 30 Sekunden

    setAutoRefreshInterval(interval);
  };

  const stopAutoRefresh = () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      setAutoRefreshInterval(null);
      console.log('⏹️ Auto-Aktualisierung gestoppt');
    }
  };

  // Load reports data
  const loadReports = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      console.log('📄 Loading reports...');
      const reportsResponse = await axios.get(`${API_URL}/api/reports`, config);
      console.log('✅ Reports loaded:', reportsResponse.data.length);
      setReports(reportsResponse.data);
      
    } catch (error) {
      console.error('❌ Error loading reports:', error);
      setReports([]);
    }
  };

  // Save or update report
  const saveReport = async () => {
    if (!reportFormData.title || !reportFormData.content) {
      Alert.alert('⚠️ Fehler', 'Bitte füllen Sie Titel und Inhalt aus');
      return;
    }

    setSavingReport(true);

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const reportData = {
        title: reportFormData.title.trim(),
        content: reportFormData.content.trim(),
        shift_date: reportFormData.shift_date,
        author_id: user.id,
        author_name: user.username,
        images: reportFormData.images || []
      };

      if (editingReport) {
        // Update existing report
        console.log('📝 Updating report:', editingReport.id);
        const response = await axios.put(`${API_URL}/api/reports/${editingReport.id}`, reportData, config);
        console.log('✅ Report updated successfully');
        Alert.alert('✅ Erfolg', 'Bericht wurde erfolgreich aktualisiert!');
      } else {
        // Create new report
        console.log('📝 Creating new report');
        const response = await axios.post(`${API_URL}/api/reports`, reportData, config);
        console.log('✅ Report created successfully');
        Alert.alert('✅ Erfolg', 'Bericht wurde erfolgreich erstellt!');
      }

      setShowReportModal(false);
      setEditingReport(null);
      // Reset form data including images
      setReportFormData({
        title: '',
        content: '',
        shift_date: new Date().toISOString().split('T')[0],
        images: []
      });
      
      // Reload reports
      await loadReports();

    } catch (error) {
      console.error('❌ Error saving report:', error);
      Alert.alert('❌ Fehler', 'Bericht konnte nicht gespeichert werden');
    } finally {
      setSavingReport(false);
    }
  };

  // Create new report
  const createNewReport = () => {
    setEditingReport(null);
    setReportFormData({
      title: '',
      content: '',
      shift_date: new Date().toISOString().split('T')[0],
      images: []
    });
    setShowReportModal(true);
  };

  // Open report for editing
  const editReport = (report) => {
    setEditingReport(report);
    setReportFormData({
      title: report.title,
      content: report.content,
      shift_date: report.shift_date,
      images: report.images || []
    });
    setShowReportModal(true);
  };

  // View report details with status actions
  const viewReportDetails = (report) => {
    setSelectedReport(report);
    setShowReportDetailModal(true);
  };

  useEffect(() => {
    if (activeTab === 'team') {
      loadUsersByStatus();
    }
    if (activeTab === 'berichte') {
      loadReports();
    }
    if (activeTab === 'database') {
      loadPersons();
      loadPersonStats();
    }
  }, [activeTab]);

  useEffect(() => {
    if (showIncidentsScreen) {
      loadAllIncidents();
    }
  }, [showIncidentsScreen]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Loading incidents and stats...');
      console.log('🔗 API URL:', API_URL);
      console.log('👤 User:', user?.username, 'Token available:', !!token);
      
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      // Load incidents - CRITICAL FIX: Make sure this works without auth too
      try {
        const incidentsResponse = await axios.get(`${API_URL}/api/incidents`, config);
        console.log('✅ Incidents API response:', incidentsResponse.status, incidentsResponse.data.length, 'incidents');
        
        // CRITICAL FIX: Show all incidents, not just first 10
        const allIncidents = incidentsResponse.data || [];
        setRecentIncidents(allIncidents);
        
        console.log('📊 Setting incidents in state:', allIncidents.length);
        
        // Debug: Log first few incidents
        allIncidents.slice(0, 3).forEach((incident, i) => {
          console.log(`📋 Incident ${i+1}:`, {
            id: incident.id,
            title: incident.title,
            status: incident.status,
            created_at: incident.created_at
          });
        });
        
      } catch (incidentError) {
        console.error('❌ Error loading incidents:', incidentError);
        console.error('❌ Incident error details:', incidentError.response?.data);
        
        // Set empty array if error
        setRecentIncidents([]);
      }
      
      // Load stats if admin
      if (user?.role === 'admin') {
        try {
          const statsResponse = await axios.get(`${API_URL}/api/admin/stats`, config);
          setStats({
            incidents: statsResponse.data.total_incidents,
            officers: statsResponse.data.total_users,
            messages: statsResponse.data.total_messages
          });
          console.log('✅ Stats loaded:', statsResponse.data);
        } catch (statsError) {
          console.error('❌ Error loading stats:', statsError);
          // Set default stats on error
          setStats({ incidents: 0, officers: 0, messages: 0 });
        }
      } else {
        // For non-admin users, set stats based on actual data
        setStats(prev => ({
          ...prev,
          incidents: recentIncidents.length
        }));
      }

      // Load team data to count officers "Im Dienst" - FIXED
      console.log('👮‍♂️ Loading team data...');
      await loadUsersByStatus();
      
    } catch (error) {
      console.error('❌ Error in loadData:', error);
      Alert.alert('Verbindungsfehler', 'Kann Daten nicht vom Server laden. Bitte prüfen Sie Ihre Internetverbindung.');
    } finally {
      setLoading(false);
    }
  };

  const loadUsersByStatus = async () => {
    console.log('👮‍♂️ [DEBUG] Starting loadUsersByStatus...');
    setTeamLoading(true);
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log('👮‍♂️ [DEBUG] Making API call to /api/users/by-status...');
      const response = await axios.get(`${API_URL}/api/users/by-status`, config);
      console.log('👮‍♂️ [DEBUG] API Response status:', response.status);
      console.log('👮‍♂️ [DEBUG] API Response data:', response.data);
      
      setUsersByStatus(response.data);
      console.log('✅ [DEBUG] Team data loaded:', Object.keys(response.data).length, 'status groups');
      
      // Count officers "Im Dienst" for stats
      const imDienstOfficers = response.data['Im Dienst'] || [];
      const officersOnDuty = imDienstOfficers.length;
      
      console.log('👮‍♂️ [DEBUG] Officers "Im Dienst" array:', imDienstOfficers);
      console.log('👮‍♂️ [DEBUG] Officers count:', officersOnDuty);
      
      // CRITICAL: Update stats immediately
      setStats(prev => {
        const newStats = {
          ...prev,
          officers: officersOnDuty
        };
        console.log('📊 [DEBUG] Updating stats from', prev.officers, 'to', officersOnDuty);
        console.log('📊 [DEBUG] New stats object:', newStats);
        return newStats;
      });
      
      console.log('✅ [DEBUG] Stats should now show:', officersOnDuty, 'officers');
      
    } catch (error) {
      console.error('❌ [DEBUG] Error loading team data:', error);
      console.error('❌ [DEBUG] Error details:', error.response?.data);
      setUsersByStatus({});
      setStats(prev => ({ ...prev, officers: 0 }));
    } finally {
      setTeamLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (activeTab === 'team') {
      await loadUsersByStatus();
    }
    setRefreshing(false);
  };

  const saveProfile = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      const updates = { 
        username: profileData.username,
        phone: profileData.phone,
        service_number: profileData.service_number,
        rank: profileData.rank,
        department: profileData.department,
        status: userStatus,
        photo: profileData.photo // Include photo in updates!
      };
      
      // Wenn Admin einen anderen Benutzer bearbeitet
      if (editingUser && user?.role === 'admin') {
        const userResponse = await axios.put(`${API_URL}/api/users/${editingUser.id}`, updates, config);
        Alert.alert('✅ Erfolg', `Benutzer ${editingUser.username} wurde erfolgreich aktualisiert!`);
        setEditingUser(null);
        await loadUsersByStatus(); // Team-Liste neu laden
      } else {
        // Normales Profil-Update
        const response = await axios.put(`${API_URL}/api/auth/profile`, updates, config);
        await updateUser(response.data);
        setUserStatus(response.data.status);
        setProfileData({
          username: response.data.username,
          phone: response.data.phone || '',
          service_number: response.data.service_number || '',
          rank: response.data.rank || '',
          department: response.data.department || '',
          photo: response.data.photo || ''
        });
        Alert.alert('✅ Erfolg', 'Profil wurde erfolgreich aktualisiert!');
      }
      
      setShowProfileModal(false);
      
    } catch (error) {
      console.error('❌ Profile update error:', error);
      Alert.alert('❌ Fehler', 'Profil konnte nicht gespeichert werden');
    }
  };

  const deleteUser = async (userId, username) => {
    if (!userId) {
      Alert.alert('❌ Fehler', 'Benutzer-ID ist ungültig');
      return;
    }

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log('🗑️ Lösche Benutzer:', userId, username);
      console.log('🔑 Using token:', token ? 'Yes' : 'No');
      console.log('🌐 API URL:', `${API_URL}/api/users/${userId}`);
      
      const response = await axios.delete(`${API_URL}/api/users/${userId}`, config);
      console.log('✅ Benutzer gelöscht:', response.status);
      
      Alert.alert('✅ Erfolg', `Benutzer ${username} wurde erfolgreich gelöscht!`);
      await loadUsersByStatus(); // Team-Liste neu laden
      
    } catch (error) {
      console.error('❌ User delete error:', error);
      console.error('❌ Error details:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      
      let errorMsg = 'Benutzer konnte nicht gelöscht werden';
      
      if (error.response?.status === 403) {
        errorMsg = 'Keine Berechtigung. Nur Administratoren können Benutzer löschen.';
      } else if (error.response?.status === 404) {
        errorMsg = 'Benutzer nicht gefunden.';
      } else if (error.response?.status === 400) {
        errorMsg = error.response?.data?.detail || 'Fehlerhafte Anfrage.';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      Alert.alert('❌ Löschen fehlgeschlagen', errorMsg);
    }
  };

  // Personen-Datenbank Funktionen
  const loadPersons = async () => {
    setDatabaseLoading(true);
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log('📇 Loading persons database...');
      const response = await axios.get(`${API_URL}/api/persons`, config);
      console.log('✅ Persons loaded:', response.data.length);
      setPersons(response.data);
      
    } catch (error) {
      console.error('❌ Error loading persons:', error);
      setPersons([]);
    } finally {
      setDatabaseLoading(false);
    }
  };

  const loadPersonStats = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      const response = await axios.get(`${API_URL}/api/persons/stats/overview`, config);
      setPersonStats(response.data);
      console.log('✅ Person stats loaded:', response.data);
      
    } catch (error) {
      console.error('❌ Error loading person stats:', error);
      setPersonStats({
        total_persons: 0,
        missing_persons: 0,
        wanted_persons: 0,
        found_persons: 0
      });
    }
  };

  const savePerson = async () => {
    if (!personFormData.first_name || !personFormData.last_name) {
      Alert.alert('⚠️ Fehler', 'Bitte füllen Sie Vor- und Nachname aus');
      return;
    }

    setSavingPerson(true);

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const personData = {
        ...personFormData,
        age: personFormData.age ? parseInt(personFormData.age) : null
      };

      if (editingPerson) {
        // Update existing person
        console.log('📝 Updating person:', editingPerson.id);
        await axios.put(`${API_URL}/api/persons/${editingPerson.id}`, personData, config);
        Alert.alert('✅ Erfolg', 'Person wurde erfolgreich aktualisiert!');
      } else {
        // Create new person
        console.log('📝 Creating new person');
        await axios.post(`${API_URL}/api/persons`, personData, config);
        Alert.alert('✅ Erfolg', 'Person wurde erfolgreich hinzugefügt!');
      }

      setShowPersonModal(false);
      setEditingPerson(null);
      setPersonFormData({
        first_name: '',
        last_name: '',
        address: '',
        age: '',
        birth_date: '',
        status: 'vermisst',
        description: '',
        last_seen_location: '',
        last_seen_date: '',
        contact_info: '',
        case_number: '',
        priority: 'medium',
        photo: ''
      });
      
      // Reload data
      await loadPersons();
      await loadPersonStats();

    } catch (error) {
      console.error('❌ Error saving person:', error);
      Alert.alert('❌ Fehler', 'Person konnte nicht gespeichert werden');
    } finally {
      setSavingPerson(false);
    }
  };

  const deletePerson = async (personId, personName) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log('🗑️ Lösche Person:', personId, personName);
      await axios.delete(`${API_URL}/api/persons/${personId}`, config);
      
      // Web-kompatible Erfolgsmeldung
      window.alert(`✅ Erfolg\n\n${personName} wurde erfolgreich archiviert!`);
      await loadPersons();
      await loadPersonStats();
      
    } catch (error) {
      console.error('❌ Person delete error:', error);
      // Web-kompatible Fehlermeldung
      window.alert(`❌ Fehler\n\nPerson konnte nicht archiviert werden.\nFehler: ${error.message}`);
    }
  };

  const createNewPerson = () => {
    setEditingPerson(null);
    setPersonFormData({
      first_name: '',
      last_name: '',
      address: '',
      age: '',
      birth_date: '',
      status: 'vermisst',
      description: '',
      last_seen_location: '',
      last_seen_date: '',
      contact_info: '',
      case_number: '',
      priority: 'medium',
      photo: ''
    });
    setShowPersonModal(true);
  };

  const editPerson = (person) => {
    setEditingPerson(person);
    setPersonFormData({
      first_name: person.first_name,
      last_name: person.last_name,
      address: person.address || '',
      age: person.age ? person.age.toString() : '',
      birth_date: person.birth_date || '',
      status: person.status || 'vermisst',
      description: person.description || '',
      last_seen_location: person.last_seen_location || '',
      last_seen_date: person.last_seen_date || '',
      contact_info: person.contact_info || '',
      case_number: person.case_number || '',
      priority: person.priority || 'medium',
      photo: person.photo || ''
    });
    setShowPersonModal(true);
  };

  // Vorfälle-Management Funktionen
  const loadAllIncidents = async () => {
    setIncidentsLoading(true);
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log('🚨 Loading all incidents...');
      const response = await axios.get(`${API_URL}/api/incidents`, config);
      console.log('✅ All incidents loaded:', response.data.length);
      setIncidents(response.data);
      
    } catch (error) {
      console.error('❌ Error loading incidents:', error);
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  };

  const deleteIncident = async (incidentId, incidentTitle) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log('🗑️ Lösche Vorfall:', incidentId, incidentTitle);
      await axios.delete(`${API_URL}/api/incidents/${incidentId}`, config);
      
      // Web-kompatible Erfolgsmeldung
      window.alert(`✅ Erfolg\n\nVorfall "${incidentTitle}" wurde erfolgreich gelöscht!`);
      await loadAllIncidents();
      await loadData(); // Home-Statistiken aktualisieren
      
    } catch (error) {
      console.error('❌ Incident delete error:', error);
      window.alert(`❌ Fehler\n\nVorfall konnte nicht gelöscht werden.\nFehler: ${error.message}`);
    }
  };

  const completeIncident = async (incidentId, incidentTitle) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log('✅ Schließe Vorfall ab:', incidentId, incidentTitle);
      await axios.put(`${API_URL}/api/incidents/${incidentId}/complete`, {}, config);
      
      window.alert(`✅ Erfolg\n\nVorfall "${incidentTitle}" wurde abgeschlossen und archiviert!`);
      await loadAllIncidents();
      await loadData();
      
    } catch (error) {
      console.error('❌ Incident complete error:', error);
      window.alert(`❌ Fehler\n\nVorfall konnte nicht abgeschlossen werden.\nFehler: ${error.message}`);
    }
  };

  const assignIncidentToSelf = async (incidentId, incidentTitle) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log('👤 Nehme Vorfall an:', incidentId, incidentTitle);
      
      const updateData = {
        assigned_to: user?.id,
        assigned_to_name: user?.username,
        assigned_at: new Date().toISOString(),
        status: 'in_progress'
      };
      
      await axios.put(`${API_URL}/api/incidents/${incidentId}`, updateData, config);
      
      window.alert(`✅ Erfolg\n\nVorfall "${incidentTitle}" wurde Ihnen zugewiesen und ist nun in Bearbeitung!`);
      
      // Reload data to reflect changes
      await loadAllIncidents();
      await loadData();
      
      // Update the selected incident in the modal
      if (selectedIncident && selectedIncident.id === incidentId) {
        setSelectedIncident(prev => ({
          ...prev,
          assigned_to: user?.id,
          assigned_to_name: user?.username,
          assigned_at: new Date().toISOString(),
          status: 'in_progress'
        }));
      }
      
    } catch (error) {
      console.error('❌ Incident assign error:', error);
      
      let errorMsg = 'Vorfall konnte nicht angenommen werden.';
      if (error.response?.status === 404) {
        errorMsg = 'Vorfall nicht gefunden.';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      window.alert(`❌ Fehler\n\n${errorMsg}`);
    }
  };

  // Update Incident Status Function
  const updateIncidentStatus = async (incidentId, newStatus, incidentTitle) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log(`🔄 Update Incident Status: ${incidentId} -> ${newStatus}`);
      
      const updateData = {
        status: newStatus
      };
      
      console.log('🔄 Sending update data:', updateData);
      
      await axios.put(`${API_URL}/api/incidents/${incidentId}`, updateData, config);
      
      const statusText = {
        'in_progress': 'IN BEARBEITUNG',
        'completed': 'ABGESCHLOSSEN', 
        'open': 'OFFEN'
      }[newStatus] || newStatus.toUpperCase();
      
      window.alert(`✅ Erfolg\n\nVorfall "${incidentTitle}" wurde auf "${statusText}" gesetzt!`);
      
      // Reload incidents
      await loadAllIncidents();
      await loadData();
      
      // Update selected incident if it's currently shown
      if (selectedIncident && selectedIncident.id === incidentId) {
        setSelectedIncident(prev => ({
          ...prev,
          status: newStatus
        }));
      }
      
    } catch (error) {
      console.error('❌ Incident status update error:', error);
      console.error('❌ Response data:', error.response?.data);
      
      let errorMsg = 'Status konnte nicht aktualisiert werden.';
      if (error.response?.status === 422) {
        errorMsg = 'Ungültige Daten. ' + (error.response?.data?.detail || 'Bitte versuchen Sie es erneut.');
      } else if (error.response?.status === 404) {
        errorMsg = 'Vorfall nicht gefunden.';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      window.alert(`❌ Fehler\n\n${errorMsg}`);
    }
  };

  // Image picker functions for incidents
  const pickImageForIncident = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📸 Berechtigung erforderlich', 'Berechtigung für Galerie-Zugriff erforderlich');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setIncidentFormData({
          ...incidentFormData,
          photo: base64Image
        });
        console.log('📸 Incident photo selected');
      }
    } catch (error) {
      console.error('❌ Image picker error:', error);
      Alert.alert('❌ Fehler', 'Fehler beim Auswählen des Bildes');
    }
  };

  const takePhotoForIncident = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📷 Berechtigung erforderlich', 'Berechtigung für Kamera-Zugriff erforderlich');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setIncidentFormData({
          ...incidentFormData,
          photo: base64Image
        });
        console.log('📷 Incident photo taken');
      }
    } catch (error) {
      console.error('❌ Camera error:', error);
      Alert.alert('❌ Fehler', 'Fehler beim Aufnehmen des Fotos');
    }
  };

  // Image picker functions for users (profile photos)
  const pickImageForUser = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📸 Berechtigung erforderlich', 'Berechtigung für Galerie-Zugriff erforderlich');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        return base64Image;
      }
    } catch (error) {
      console.error('❌ Image picker error:', error);
      Alert.alert('❌ Fehler', 'Fehler beim Auswählen des Bildes');
    }
    return null;
  };

  const takePhotoForUser = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📷 Berechtigung erforderlich', 'Berechtigung für Kamera-Zugriff erforderlich');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        return base64Image;
      }
    } catch (error) {
      console.error('❌ Camera error:', error);
      Alert.alert('❌ Fehler', 'Fehler beim Aufnehmen des Fotos');
    }
    return null;
  };

  // Image picker functions for persons
  const pickImageForPerson = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📸 Berechtigung erforderlich', 'Berechtigung für Kamera-Zugriff erforderlich');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setPersonFormData({
          ...personFormData,
          photo: base64Image
        });
        console.log('📸 Person photo selected');
      }
    } catch (error) {
      console.error('❌ Image picker error:', error);
      Alert.alert('❌ Fehler', 'Fehler beim Auswählen des Bildes');
    }
  };

  const takePhotoForPerson = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📷 Berechtigung erforderlich', 'Berechtigung für Kamera-Zugriff erforderlich');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setPersonFormData({
          ...personFormData,
          photo: base64Image
        });
        console.log('📷 Person photo taken');
      }
    } catch (error) {
      console.error('❌ Camera error:', error);
      Alert.alert('❌ Fehler', 'Fehler beim Aufnehmen des Fotos');
    }
  };

  // Admin Settings Functions
  const saveAdminSettings = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log('⚙️ Saving admin settings:', adminSettingsData);
      
      // Filter out empty values
      const updateData = Object.fromEntries(
        Object.entries(adminSettingsData).filter(([key, value]) => value !== '')
      );
      
      const response = await axios.put(`${API_URL}/api/admin/app/config`, updateData, config);
      
      // Update local app config
      setAppConfig(response.data);
      
      // Reset form
      setAdminSettingsData({
        app_name: '',
        app_subtitle: '',
        app_icon: '',
        organization_name: '',
        primary_color: '',
        secondary_color: ''
      });
      
      window.alert('✅ Erfolg\n\nApp-Einstellungen wurden erfolgreich gespeichert!');
      setShowAdminSettingsModal(false);
      
    } catch (error) {
      console.error('❌ Admin settings save error:', error);
      let errorMsg = 'Einstellungen konnten nicht gespeichert werden.';
      if (error.response?.status === 403) {
        errorMsg = 'Keine Berechtigung. Nur Administratoren können App-Einstellungen ändern.';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      }
      window.alert(`❌ Fehler\n\n${errorMsg}`);
    }
  };

  const pickIconForApp = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📸 Berechtigung erforderlich', 'Berechtigung für Galerie-Zugriff erforderlich');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setAdminSettingsData({
          ...adminSettingsData,
          app_icon: base64Image
        });
        console.log('📱 App icon selected');
      }
    } catch (error) {
      console.error('❌ App icon picker error:', error);
      Alert.alert('❌ Fehler', 'Fehler beim Auswählen des App-Icons');
    }
  };

  // Report Status Update Functions - FIXED for 422 error
  const updateReportStatus = async (reportId, newStatus, reportTitle) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log(`📊 Update Report Status: ${reportId} -> ${newStatus}`);
      
      // Get current report data first
      const currentReport = reports.find(r => r.id === reportId) || selectedReport;
      
      // Send complete report data with updated status
      const updateData = {
        title: currentReport?.title || reportTitle,
        content: currentReport?.content || '',
        shift_date: currentReport?.shift_date || new Date().toISOString().split('T')[0],
        status: newStatus
      };
      
      console.log('📊 Sending update data:', updateData);
      
      await axios.put(`${BACKEND_BASE_URL}/api/reports/${reportId}`, updateData, config);
      
      const statusText = {
        'in_progress': 'IN BEARBEITUNG',
        'completed': 'ABGESCHLOSSEN', 
        'archived': 'ARCHIVIERT'
      }[newStatus] || newStatus.toUpperCase();
      
      Alert.alert('✅ Erfolg', `Bericht "${reportTitle}" wurde auf "${statusText}" gesetzt!`);
      
      // Reload reports
      await loadReports();
      
      // Update selected report if it's currently shown
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(prev => ({
          ...prev,
          status: newStatus
        }));
      }
      
    } catch (error) {
      console.error('❌ Report status update error:', error);
      console.error('❌ Response data:', error.response?.data);
      
      let errorMsg = 'Status konnte nicht aktualisiert werden.';
      if (error.response?.status === 422) {
        errorMsg = 'Ungültige Daten. ' + (error.response?.data?.detail || 'Bitte versuchen Sie es erneut.');
      } else if (error.response?.status === 404) {
        errorMsg = 'Bericht nicht gefunden.';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      Alert.alert('❌ Fehler', errorMsg);
    }
  };

  // Person Status Update Function
  const updatePersonStatus = async (personId, newStatus, personName) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      console.log(`👤 Update Person Status: ${personId} -> ${newStatus}`);
      
      // Get current person data first
      const currentPerson = persons.find(p => p.id === personId) || selectedPerson;
      
      // Send complete person data with updated status
      const updateData = {
        first_name: currentPerson?.first_name || '',
        last_name: currentPerson?.last_name || '',
        address: currentPerson?.address || '',
        age: currentPerson?.age || null,
        birth_date: currentPerson?.birth_date || '',
        status: newStatus,
        description: currentPerson?.description || '',
        last_seen_location: currentPerson?.last_seen_location || '',
        last_seen_date: currentPerson?.last_seen_date || '',
        contact_info: currentPerson?.contact_info || '',
        case_number: currentPerson?.case_number || '',
        priority: currentPerson?.priority || 'medium',
        photo: currentPerson?.photo || ''
      };
      
      console.log('👤 Sending update data:', updateData);
      
      await axios.put(`${API_URL}/api/persons/${personId}`, updateData, config);
      
      const statusText = {
        'gefunden': 'GEFUNDEN',
        'erledigt': 'ERLEDIGT', 
        'vermisst': 'VERMISST',
        'gesucht': 'GESUCHT'
      }[newStatus] || newStatus.toUpperCase();
      
      // Close the modal first
      setShowPersonDetailModal(false);
      
      // Show success message
      window.alert(`✅ Erfolg\n\nPerson "${personName}" wurde auf "${statusText}" gesetzt!`);
      
      // Reload persons data
      await loadPersons();
      await loadPersonStats();
      
    } catch (error) {
      console.error('❌ Person status update error:', error);
      console.error('❌ Response data:', error.response?.data);
      
      let errorMsg = 'Status konnte nicht aktualisiert werden.';
      if (error.response?.status === 422) {
        errorMsg = 'Ungültige Daten. ' + (error.response?.data?.detail || 'Bitte versuchen Sie es erneut.');
      } else if (error.response?.status === 404) {
        errorMsg = 'Person nicht gefunden.';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      window.alert(`❌ Fehler\n\n${errorMsg}`);
    }
  };

  const showIncidentOnMap = (incident) => {
    setSelectedIncident(incident);
    setShowIncidentMap(true);
  };

  // Submit Incident Function
  // Submit incident form
  const submitIncidentForm = async () => {
    setSendingMessage(true);
    try {
      await submitIncident();
    } catch (error) {
      console.error('❌ Submit error:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const submitIncident = async () => {
    // Validation
    if (!incidentFormData.title.trim()) {
      window.alert('❌ Fehler\n\nBitte geben Sie einen Vorfall-Titel ein.');
      return;
    }
    
    if (!incidentFormData.description.trim()) {
      window.alert('❌ Fehler\n\nBitte geben Sie eine Beschreibung ein.');
      return;
    }
    
    if (!incidentFormData.location.trim()) {
      window.alert('❌ Fehler\n\nBitte geben Sie einen Standort ein.');
      return;
    }

    setSubmittingIncident(true);
    
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const incidentData = {
        title: incidentFormData.title.trim(),
        description: incidentFormData.description.trim(),
        priority: incidentFormData.priority,
        location: {
          lat: 51.2878,  // Default: Schwelm coordinates
          lng: 7.3372
        },
        address: incidentFormData.location.trim(),
        images: incidentFormData.photo ? [incidentFormData.photo] : []
      };

      console.log('📤 Submitting incident:', incidentData);
      
      const response = await axios.post(`${API_URL}/api/incidents`, incidentData, config);
      
      console.log('✅ Incident submitted successfully:', response.data);
      
      window.alert(`✅ Vorfall gemeldet!\n\n"${incidentFormData.title}" wurde erfolgreich gemeldet.`);
      
      // Reset form
      setIncidentFormData({
        title: '',
        description: '',
        location: '',
        coordinates: null,
        priority: 'medium',
        incident_type: 'general',
        photo: ''
      });
      
      // Refresh incidents list
      loadData();
      
    } catch (error) {
      console.error('❌ Incident submission error:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error data:', error.response?.data);
      
      let errorMessage = 'Unbekannter Fehler';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }
      
      window.alert(`❌ Fehler beim Melden\n\nVorfall konnte nicht gemeldet werden.\nFehler: ${errorMessage}`);
    } finally {
      setSubmittingIncident(false);
    }
  };

  // Private Messaging Functions
  const sendPrivateMessage = async () => {
    if (!privateMessage.trim() || !selectedRecipient) return;

    setSendingPrivateMessage(true);
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const messageData = {
        content: privateMessage,
        recipient_id: selectedRecipient.id,
        channel: "private",
        message_type: "text"
      };

      await axios.post(`${API_URL}/api/messages`, messageData, config);
      
      // Benachrichtigung erstellen
      await createNotification(
        selectedRecipient.id,
        `📩 Private Nachricht von ${user.username}`,
        privateMessage.substring(0, 100) + (privateMessage.length > 100 ? '...' : ''),
        'private_message'
      );

      window.alert(`✅ Nachricht gesendet\n\nNachricht an ${selectedRecipient.username} erfolgreich gesendet!`);
      setPrivateMessage('');
      setShowPrivateMessageModal(false);
      
      // Nachrichten-Übersicht aktualisieren
      await loadRecentMessages();

    } catch (error) {
      console.error('❌ Private message error:', error);
      window.alert(`❌ Fehler\n\nNachricht konnte nicht gesendet werden.`);
    } finally {
      setSendingPrivateMessage(false);
    }
  };

  const openPrivateMessage = (recipient) => {
    setSelectedRecipient(recipient);
    setPrivateMessage('');
    setShowPrivateMessageModal(true);
  };

  // Open all incidents modal function
  const openAllIncidentsModal = () => {
    console.log('🚨 Opening all incidents modal');
    setShowAllIncidentsModal(true);
  };

  // Load recent messages for current user (only recent for overview)
  const loadRecentMessages = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      console.log('💬 Loading recent messages...');
      const response = await axios.get(`${API_URL}/api/messages/private`, config);
      console.log('✅ All messages loaded:', response.data.length);
      
      // Für Übersicht: nur die neueste Nachricht
      const latestMessage = response.data.length > 0 ? [response.data[0]] : [];
      setRecentMessages(latestMessage);
      
      // Alle Nachrichten für das Detail-Modal speichern
      setAllMessages(response.data);
      
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      // Fallback: load all messages if unread_only fails
      try {
        const fallbackResponse = await axios.get(`${API_URL}/api/messages/private`, config);
        // Filter for recent messages (last 24 hours)
        const recent = fallbackResponse.data.filter(msg => {
          const msgDate = new Date(msg.created_at);
          const now = new Date();
          const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          return msgDate > dayAgo;
        });
        const latestMessage = recent.length > 0 ? [recent[0]] : [];
        setRecentMessages(latestMessage);
        setAllMessages(recent);
      } catch (fallbackError) {
        setRecentMessages([]);
        setAllMessages([]);
      }
    }
  };

  // Open all messages modal
  const openAllMessagesModal = () => {
    loadAllMessages(); // Refresh all messages
    setShowAllMessagesModal(true);
  };

  // Load all messages
  const loadAllMessages = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      console.log('💬 Loading all messages...');
      const response = await axios.get(`${API_URL}/api/messages/private`, config);
      console.log('✅ All messages loaded:', response.data.length);
      setAllMessages(response.data);
      
    } catch (error) {
      console.error('❌ Error loading all messages:', error);
      setAllMessages([]);
    }
  };

  // Load chat list (unique conversations - both sent and received)
  const loadChatList = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const response = await axios.get(`${API_URL}/api/messages/private`, config);
      
      // Group messages by conversation partner (both directions)
      const chatsMap = {};
      response.data.forEach(message => {
        let chatPartnerId, chatPartnerName;
        
        // Determine conversation partner
        if (message.sender_id === user.id) {
          // Message sent by current user
          chatPartnerId = message.recipient_id;
          chatPartnerName = message.recipient_name || 'Unbekannt';
        } else {
          // Message received by current user
          chatPartnerId = message.sender_id;
          chatPartnerName = message.sender_name || 'Unbekannt';
        }
        
        if (!chatsMap[chatPartnerId]) {
          chatsMap[chatPartnerId] = {
            id: chatPartnerId,
            name: chatPartnerName,
            lastMessage: message.content,
            lastMessageTime: message.created_at || message.timestamp,
            unreadCount: 0
          };
        }
        
        // Update with most recent message
        if (new Date(message.created_at || message.timestamp) > new Date(chatsMap[chatPartnerId].lastMessageTime)) {
          chatsMap[chatPartnerId].lastMessage = message.content;
          chatsMap[chatPartnerId].lastMessageTime = message.created_at || message.timestamp;
          
          // Show if message was sent by current user
          if (message.sender_id === user.id) {
            chatsMap[chatPartnerId].lastMessage = `Sie: ${message.content}`;
          }
        }
      });

      const chatListArray = Object.values(chatsMap).sort((a, b) => 
        new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      );
      
      setChatList(chatListArray);
      console.log('✅ Chat-Liste aktualisiert:', chatListArray.length, 'Unterhaltungen');
      
    } catch (error) {
      console.error('❌ Error loading chat list:', error);
      setChatList([]);
    }
  };

  // Load messages for specific chat (with real-time updates)
  const loadChatMessages = async (userId) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const response = await axios.get(`${API_URL}/api/messages/private`, config);
      
      console.log('🔍 All private messages:', response.data);
      console.log('🔍 Current user ID:', user.id);
      console.log('🔍 Chat partner ID:', userId);
      
      // Filter messages for this specific conversation (both directions)
      const chatMessages = response.data
        .filter(msg => {
          const isToMe = (msg.sender_id === userId && msg.recipient_id === user.id);
          const isFromMe = (msg.sender_id === user.id && msg.recipient_id === userId);
          const match = isToMe || isFromMe;
          
          console.log('🔍 Message:', msg.content, 'Sender:', msg.sender_id, 'Recipient:', msg.recipient_id, 'IsToMe:', isToMe, 'IsFromMe:', isFromMe, 'Match:', match);
          
          return match;
        })
        .sort((a, b) => new Date(a.created_at || a.timestamp) - new Date(b.created_at || b.timestamp));
      
      console.log('✅ Filtered chat messages:', chatMessages);
      setChatMessages(chatMessages);
      
    } catch (error) {
      console.error('❌ Error loading chat messages:', error);
      setChatMessages([]);
    }
  };

  // Auto-refresh messages every 3 seconds for real-time updates
  useEffect(() => {
    if (selectedChatUser) {
      const interval = setInterval(() => {
        loadChatMessages(selectedChatUser.id);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedChatUser]);

  // Auto-refresh channel messages every 5 seconds
  useEffect(() => {
    if (selectedChannel && selectedChannel !== 'private') {
      const interval = setInterval(() => {
        loadChannelMessages(selectedChannel);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChannel]);

  // Send new message in chat
  const sendChatMessage = async () => {
    if (!newMessage.trim() || !selectedChatUser) return;

    const tempMessage = {
      id: 'temp_' + Date.now(),
      content: newMessage,
      sender_id: user.id,
      sender_name: user.username,
      recipient_id: selectedChatUser.id,
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    // Add message immediately to UI (optimistic update)
    setChatMessages(prev => [...prev, tempMessage]);
    const messageToSend = newMessage;
    setNewMessage('');

    setSendingPrivateMessage(true);
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const messageData = {
        content: messageToSend,
        recipient_id: selectedChatUser.id,
        channel: "private",
        message_type: "text"
      };

      const response = await axios.post(`${API_URL}/api/messages`, messageData, config);
      
      // Replace temp message with real message
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id ? { ...response.data, ...messageData } : msg
        )
      );

      // Create notification
      try {
        await axios.post(`${API_URL}/api/notifications`, {
          recipient_id: selectedChatUser.id,
          title: `📩 Nachricht von ${user.username}`,
          content: messageToSend.substring(0, 100) + (messageToSend.length > 100 ? '...' : ''),
          notification_type: 'private_message'
        }, config);
      } catch (notifError) {
        console.log('⚠️ Notification failed, but message sent');
      }

      // Refresh lists in background
      await loadChatList();
      await loadRecentMessages();
      
      console.log('✅ Nachricht gesendet und Listen aktualisiert');
      
    } catch (error) {
      console.error('❌ Send message error:', error);
      // Remove temp message on error
      setChatMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setNewMessage(messageToSend); // Restore message
      Alert.alert('❌ Fehler', 'Nachricht konnte nicht gesendet werden.');
    } finally {
      setSendingPrivateMessage(false);
    }
  };

  // Send chat reply
  const sendChatReply = async () => {
    if (!chatReply.trim() || !selectedChat) return;

    setSendingPrivateMessage(true);
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const messageData = {
        content: chatReply,
        recipient_id: selectedChat.sender_id,
        channel: "private",
        message_type: "text"
      };

      await axios.post(`${API_URL}/api/messages`, messageData, config);
      
      // Benachrichtigung erstellen
      await createNotification(
        selectedChat.sender_id,
        `📩 Antwort von ${user.username}`,
        chatReply.substring(0, 100) + (chatReply.length > 100 ? '...' : ''),
        'private_message'
      );

      window.alert(`✅ Antwort gesendet\n\nAntwort erfolgreich gesendet!`);
      setChatReply('');
      setShowChatModal(false);
      await loadRecentMessages(); // Reload messages
      
    } catch (error) {
      console.error('❌ Chat reply error:', error);
      window.alert(`❌ Fehler\n\nAntwort konnte nicht gesendet werden.`);
    } finally {
      setSendingPrivateMessage(false);
    }
  };

  // Send message to channel
  const sendChannelMessage = async (channelId) => {
    if (!newMessage.trim()) return;

    const tempMessage = {
      id: 'temp_' + Date.now(),
      content: newMessage,
      sender_id: user.id,
      sender_name: user.username,
      channel: channelId,
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    // Add message immediately to UI (optimistic update)
    setChannelMessages(prev => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), tempMessage]
    }));

    const messageToSend = newMessage;
    setNewMessage('');

    setSendingPrivateMessage(true);
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const messageData = {
        content: messageToSend,
        channel: channelId,
        message_type: "text"
      };

      const response = await axios.post(`${API_URL}/api/messages`, messageData, config);
      
      // Replace temp message with real message
      setChannelMessages(prev => ({
        ...prev,
        [channelId]: prev[channelId].map(msg => 
          msg.id === tempMessage.id ? { ...response.data, ...messageData } : msg
        )
      }));

      console.log('✅ Channel message sent:', channelId);
      
    } catch (error) {
      console.error('❌ Send channel message error:', error);
      // Remove temp message on error
      setChannelMessages(prev => ({
        ...prev,
        [channelId]: prev[channelId].filter(msg => msg.id !== tempMessage.id)
      }));
      setNewMessage(messageToSend); // Restore message
      Alert.alert('❌ Fehler', 'Nachricht konnte nicht gesendet werden.');
    } finally {
      setSendingPrivateMessage(false);
    }
  };

  // Load messages for specific channel
  const loadChannelMessages = async (channelId) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const response = await axios.get(`${API_URL}/api/messages?channel=${channelId}`, config);
      
      setChannelMessages(prev => ({
        ...prev,
        [channelId]: response.data
      }));
      
    } catch (error) {
      console.error('❌ Error loading channel messages:', error);
      setChannelMessages(prev => ({
        ...prev,
        [channelId]: []
      }));
    }
  };

  // Delete chat message
  const deleteChat = async (messageId) => {
    if (!messageId) {
      Alert.alert('❌ Fehler', 'Nachrichten-ID ist ungültig');
      return;
    }

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      console.log('🗑️ Lösche Nachricht:', messageId);
      const response = await axios.delete(`${API_URL}/api/messages/${messageId}`, config);
      console.log('✅ Nachricht gelöscht:', response.status);
      
      Alert.alert('✅ Chat gelöscht', 'Nachricht wurde erfolgreich gelöscht!');
      await loadRecentMessages(); // Reload messages
      await loadAllMessages(); // Reload all messages too
      
    } catch (error) {
      console.error('❌ Delete message error:', error);
      console.error('❌ Error details:', error.response?.data);
      
      const errorMsg = error.response?.data?.detail || 
                      error.response?.data?.message || 
                      'Nachricht konnte nicht gelöscht werden';
      
      Alert.alert('❌ Fehler', errorMsg);
    }
  };

  // Open chat for reply
  const openChatReply = (message) => {
    setSelectedChat(message);
    setChatReply('');
    setShowChatModal(true);
  };

  // Notification Functions
  const createNotification = async (recipientId, title, content, type) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const notificationData = {
        recipient_id: recipientId,
        title: title,
        content: content,
        type: type,
        sender_id: user.id,
        sender_name: user.username
      };

      await axios.post(`${API_URL}/api/notifications`, notificationData, config);
      console.log('🔔 Benachrichtigung erstellt:', title);

    } catch (error) {
      console.error('❌ Notification error:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const response = await axios.get(`${API_URL}/api/notifications`, config);
      setNotifications(response.data);
      
      const unread = response.data.filter(n => !n.is_read).length;
      setUnreadNotifications(unread);

    } catch (error) {
      console.error('❌ Error loading notifications:', error);
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      await axios.put(`${API_URL}/api/notifications/${notificationId}/read`, {}, config);
      await loadNotifications(); // Reload notifications

    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  // Geocode address to coordinates
  const geocodeAddress = async (address) => {
    if (!address || address.trim().length < 3) return null;
    
    try {
      console.log('🗺️ Geocoding Adresse:', address);
      
      // Use OpenStreetMap Nominatim for geocoding (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=de`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const location = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            display_name: data[0].display_name
          };
          console.log('✅ Geocoding erfolgreich:', location);
          return location;
        }
      }
      
      console.log('⚠️ Keine Koordinaten für Adresse gefunden');
      return null;
      
    } catch (error) {
      console.error('❌ Geocoding Fehler:', error);
      return null;
    }
  };

  // Chat Management Functions
  const createPrivateChat = (chatName = 'Neuer Chat') => {
    const newChat = {
      id: Date.now().toString(),
      name: chatName,
      created_at: new Date().toISOString(),
      messages: [],
      unread_count: 0
    };
    
    setPrivateChats(prev => [...prev, newChat]);
    setSelectedChat(newChat);
    return newChat;
  };

  const deletePrivateChat = (chatId) => {
    setPrivateChats(prev => prev.filter(chat => chat.id !== chatId));
    if (selectedChat?.id === chatId) {
      setSelectedChat(null);
    }
    setShowChatOptions(null);
  };

  const updateChatName = (chatId, newName) => {
    setPrivateChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, name: newName.trim() || 'Unbenannter Chat' } : chat
    ));
    setEditingChatName(null);
    setNewChatName('');
  };

  const addMessageToChat = (chatId, message) => {
    setPrivateChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? { 
            ...chat, 
            messages: [...chat.messages, message],
            last_message: message.content,
            last_message_time: message.timestamp
          } 
        : chat
    ));
  };

  // Send Message Function (verbessert für Chat-System)
  const sendMessage = async (type = 'private') => {
    if (!newMessage.trim()) return;

    // Erstelle Chat falls noch nicht vorhanden
    let currentChat = selectedChat;
    if (!currentChat && type === 'private') {
      currentChat = createPrivateChat('Privater Chat');
    }

    try {
      const messageData = {
        content: newMessage.trim(),
        sender: user?.username || 'Unbekannt',
        type: type,
        channel: type === 'private' ? 'private' : 'general',
        timestamp: new Date().toISOString(),
        user_id: user?.id,
        chat_id: currentChat?.id
      };

      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      // Sende an Backend
      const response = await axios.post(`${API_URL}/api/messages`, messageData, config);
      
      // Füge zu lokalem Chat hinzu
      if (currentChat) {
        addMessageToChat(currentChat.id, {
          ...messageData,
          id: response.data.id || Date.now(),
          created_at: new Date().toISOString()
        });
      }
      
      // Reset input
      setNewMessage('');
      
      console.log('✅ Message sent successfully to chat:', currentChat?.name);
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      window.alert(`❌ Nachricht konnte nicht gesendet werden`);
    }
  };

  const openIncidentDetails = (incident) => {
    setSelectedIncident(incident);
    setShowIncidentModal(true);
  };

  const openIncidentMap = (incident) => {
    setSelectedIncident(incident);
    setShowMapModal(true);
  };

  const takeIncident = async () => {
    if (!selectedIncident) return;
    
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      const response = await axios.put(`${API_URL}/api/incidents/${selectedIncident.id}/assign`, {}, config);
      
      const updatedIncident = response.data;
      setSelectedIncident(updatedIncident);
      
      Alert.alert('✅ Erfolg', 'Vorfall wurde Ihnen zugewiesen!');
      await loadData();
    } catch (error) {
      Alert.alert('❌ Fehler', 'Vorfall konnte nicht zugewiesen werden');
    }
  };

  const completeSelectedIncident = async () => {
    if (!selectedIncident) return;
    
    Alert.alert(
      '✅ Vorfall abschließen',
      'Möchten Sie diesen Vorfall als erledigt markieren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Erledigt',
          onPress: async () => {
            try {
              const config = token ? {
                headers: { Authorization: `Bearer ${token}` }
              } : {};
              
              await axios.put(`${API_URL}/api/incidents/${selectedIncident.id}/complete`, {}, config);
              
              Alert.alert('✅ Erfolg', 'Vorfall wurde als erledigt markiert!');
              setShowIncidentModal(false);
              setSelectedIncident(null);
              await loadData();
            } catch (error) {
              Alert.alert('❌ Fehler', 'Vorfall konnte nicht abgeschlossen werden');
            }
          }
        }
      ]
    );
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return colors.textMuted;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Im Dienst': return '#10B981';
      case 'Pause': return '#F59E0B';
      case 'Einsatz': return '#EF4444';
      case 'Streife': return '#8B5CF6';
      case 'Nicht verfügbar': return '#6B7280';
      default: return '#10B981';
    }
  };

  // Get current location for incident reporting using Expo Location - FIXED
  const getCurrentLocation = async () => {
    console.log('📍 GPS Button geklickt - starte Standortermittlung...');
    try {
      console.log('📍 Bitte um Standort-Berechtigung...');
      
      // Request location permission with error handling
      let permissionResult;
      try {
        permissionResult = await Location.requestForegroundPermissionsAsync();
      } catch (permError) {
        console.error('❌ Permission request failed:', permError);
        Alert.alert(
          '📍 GPS-Fehler', 
          'Standort-Berechtigung konnte nicht angefragt werden. Bitte Adresse manuell eingeben.',
          [{ text: 'OK' }]
        );
        return null;
      }

      if (permissionResult.status !== 'granted') {
        console.log('❌ Standort-Berechtigung verweigert');
        Alert.alert(
          '📍 Berechtigung erforderlich', 
          'Bitte erlauben Sie der App den Zugriff auf Ihren Standort, um die GPS-Funktion zu nutzen.',
          [{ text: 'OK' }]
        );
        return null;
      }

      console.log('✅ Standort-Berechtigung erteilt, ermittle Position...');
      
      // Get current position with timeout and error handling
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Changed from High to Balanced
          timeout: 10000, // Reduced timeout to 10 seconds
        });
      } catch (locationError) {
        console.error('❌ Location fetch failed:', locationError);
        Alert.alert(
          '📍 GPS-Fehler', 
          'Standort konnte nicht ermittelt werden. Bitte versuchen Sie es erneut oder geben Sie die Adresse manuell ein.',
          [{ text: 'OK' }]
        );
        return null;
      }

      console.log('✅ Standort erfolgreich ermittelt:', location);
      
      const locationData = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy
      };
      
      // Update location field safely
      try {
        setLocation(`📍 GPS: ${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}`);
        setCurrentLocation(locationData);
        console.log('✅ Location field updated successfully');
      } catch (updateError) {
        console.error('❌ Location update failed:', updateError);
      }
      
      return locationData;
      
    } catch (error) {
      console.error('❌ GPS-Fehler (outer catch):', error);
      
      Alert.alert(
        '📍 GPS-Fehler', 
        'Ein unerwarteter Fehler ist aufgetreten. Bitte Adresse manuell eingeben.',
        [{ text: 'OK' }]
      );
      return null;
    }
  };

  // Use current location for incident form
  const useCurrentLocationForIncident = async () => {
    console.log('📍 GPS-Button wurde geklickt - starte Standortabfrage...');
    
    try {
      const location = await getCurrentLocation();
      if (location) {
        const locationString = `📍 GPS: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
        console.log('✅ Standort erfolgreich gesetzt:', locationString);
        
        setIncidentFormData(prev => ({
          ...prev,
          location: locationString,
          coordinates: location
        }));
        
        Alert.alert(
          '✅ Standort erfasst', 
          `Ihr aktueller Standort wurde erfasst:\n\nLatitude: ${location.lat.toFixed(6)}\nLongitude: ${location.lng.toFixed(6)}\nGenauigkeit: ${location.accuracy ? location.accuracy.toFixed(0) + 'm' : 'Unbekannt'}`
        );
      }
    } catch (error) {
      console.error('❌ Fehler beim Verwenden des Standorts:', error);
      Alert.alert(
        '❌ GPS-Fehler', 
        'Standort konnte nicht erfasst werden. Bitte überprüfen Sie Ihre Browser-Berechtigungen für Standortdienste oder geben Sie die Adresse manuell ein.'
      );
    }
  };

  // Dynamic Styles basierend auf Theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    
    // Modern Header
    homeHeader: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerLeft: {
      flex: 1,
    },
    welcomeText: {
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 4,
    },
    userName: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#FFFFFF',
      marginBottom: 8,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      alignSelf: 'flex-start',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    userRole: {
      fontSize: 14,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    
    // User Selection Styles
    userSelectionContainer: {
      maxHeight: 400,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginTop: 8,
    },
    userSelectionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userSelectionName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    userSelectionDetails: {
      fontSize: 12,
      color: colors.textMuted,
    },
    statusHeaderText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.background,
    },
    recipientHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sosHeaderButton: {
      backgroundColor: '#FF0000',
      flexDirection: 'row',
      paddingHorizontal: 8,
      width: 60,
      height: 36,
      borderRadius: 18,
      gap: 4,
      shadowColor: '#FF0000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
      elevation: 6,
    },
    sosButtonText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: 'bold',
    },
    sosIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    sosModalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FF0000',
      marginBottom: 8,
    },
    sosModalSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    sosWarningBox: {
      backgroundColor: '#FFF3CD',
      borderColor: '#F59E0B',
      borderWidth: 2,
      borderRadius: 12,
      padding: 20,
      marginBottom: 24,
    },
    sosWarningTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#D97706',
      marginBottom: 12,
    },
    sosWarningText: {
      fontSize: 16,
      color: '#92400E',
      lineHeight: 24,
    },
    sosLocationInfo: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sosLocationTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    sosLocationText: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    sosSendButton: {
      backgroundColor: '#DC2626',
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      shadowColor: '#DC2626',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    sosSendButtonText: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 12,
      marginBottom: 8,
    },
    sosSendButtonSubtext: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 14,
      textAlign: 'center',
    },
    teamGroup: {
      marginBottom: 20,
      backgroundColor: colors.card,
      borderRadius: 12,
      overflow: 'hidden',
    },
    teamGroupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.primary,
      gap: 8,
    },
    teamGroupTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    teamMemberCount: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    teamMemberCountText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: 'bold',
    },
    teamMemberCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    memberInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    memberPhotoContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberPhoto: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    memberPhotoPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberDetails: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 2,
    },
    memberRank: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    statusIndicator: {
      alignItems: 'center',
      gap: 4,
    },
    statusText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // Mobile-Responsive Filter Tabs
    filterScrollContainer: {
      marginBottom: 16,
    },
    filterScrollContent: {
      paddingHorizontal: 4,
    },
    mobileFilterTab: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginHorizontal: 4,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      minWidth: 80,
    },
    mobileFilterTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    mobileFilterTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 2,
    },
    mobileFilterTabTextActive: {
      color: '#FFFFFF',
    },
    mobileFilterTabCount: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    mobileFilterTabCountActive: {
      color: '#FFFFFF',
    },

    // Modern Stats
    statsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingTop: 24,
      gap: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderLeftWidth: 4,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    statContent: {
      padding: 16,
    },
    statHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    statIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statTrend: {
      opacity: 0.6,
    },
    statNumber: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
      marginBottom: 4,
    },
    statSubtext: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },

    // Modern Cards
    card: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      marginTop: 24,
      borderRadius: 20,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 12,
      flex: 1,
    },

    // Modern Incident Cards
    incidentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    incidentIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    incidentContent: {
      flex: 1,
    },
    incidentTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    incidentTime: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 4,
    },
    incidentStatus: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    incidentActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    mapButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteButton: {
      backgroundColor: colors.success,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    reportActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    editButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteReportButton: {
      backgroundColor: colors.error,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deletePersonButton: {
      backgroundColor: colors.error,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },

    // Person Card Styles
    personCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginVertical: 6,
      marginHorizontal: 2,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    personInfo: {
      flex: 1,
      marginRight: 12,
    },
    personName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    personDetails: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 2,
    },
    personStatus: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    personCase: {
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    personActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    // Database Statistics Cards  
    dbStatsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
      flexWrap: 'wrap',
    },
    dbStatCard: {
      flex: 1,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 12,
      margin: 4,
      alignItems: 'center',
      borderWidth: 2,
      minWidth: 70,
    },
    dbStatNumber: {
      fontSize: 20,
      fontWeight: '900',
      marginBottom: 4,
    },
    dbStatLabel: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      fontWeight: '600',
    },

    // Category Filter Tabs
    categoryTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    categoryTab: {
      flex: 1,
      minWidth: 70,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryTabText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    categoryTabTextActive: {
      color: '#FFFFFF',
    },

    // Mobile-Responsive Filter Tabs
    filterScrollContainer: {
      marginBottom: 16,
    },
    filterScrollContent: {
      paddingHorizontal: 4,
    },
    mobileFilterTab: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginHorizontal: 4,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      minWidth: 80,
    },
    mobileFilterTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    mobileFilterTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 2,
    },
    mobileFilterTabTextActive: {
      color: '#FFFFFF',
    },
    mobileFilterTabCount: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    mobileFilterTabCountActive: {
      color: '#FFFFFF',
    },

    // Person Modal Picker Styles
    pickerContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    pickerButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    pickerButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pickerButtonText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    pickerButtonTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },

    // Person Detail Modal Styles
    detailCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    detailSectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 8,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
      flexWrap: 'wrap',
    },
    detailLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
      minWidth: 100,
      flex: 1,
    },
    detailValue: {
      fontSize: 14,
      color: colors.text,
      flex: 2,
      textAlign: 'right',
    },
    detailDescription: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      textAlign: 'left',
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      alignSelf: 'flex-end',
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    editHeaderButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    // Incident Detail Styles
    incidentDetailCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginVertical: 8,
      marginHorizontal: 2,
      borderLeftWidth: 6,
      flexDirection: 'column',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    incidentDetailTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    incidentDescription: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
      lineHeight: 20,
    },
    incidentLocation: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 4,
    },
    incidentStatusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      flexWrap: 'wrap',
    },
    incidentStatusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      fontSize: 12,
      fontWeight: '600',
    },
    incidentPriorityBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
    },
    incidentAssignee: {
      fontSize: 12,
      color: colors.success,
      fontWeight: '600',
      marginTop: 4,
    },

    // Incident Action Button Styles
    incidentActions: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
      gap: 8,
    },
    incidentActionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },

    // Search Styles
    searchContainer: {
      marginBottom: 16,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    clearSearchButton: {
      marginLeft: 8,
      padding: 4,
    },

    // Card Header Right
    cardHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    // Status Count Badge
    statusCount: {
      backgroundColor: colors.secondary,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
      minWidth: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusCountText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },

    // Summary Row for Overview Cards
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    summaryItem: {
      alignItems: 'center',
      flex: 1,
    },
    summaryNumber: {
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 2,
    },
    summaryLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '600',
      textAlign: 'center',
    },
    
    // Action Buttons
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.secondary,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      marginTop: 8,
    },
    actionText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      marginLeft: 12,
    },

    // Empty State
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
      paddingHorizontal: 20,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      opacity: 0.8,
    },

    // Tab Bar
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      elevation: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 16,
    },
    tabItemActive: {
      backgroundColor: colors.primary,
    },
    tabLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 4,
    },
    tabLabelActive: {
      color: '#FFFFFF',
    },

    // Screen Headers
    screenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 20,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    screenTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 12,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    addButton: {
      padding: 12,
      backgroundColor: colors.primary,
      borderRadius: 12,
    },

    // Form Styles
    form: {
      flex: 1,
      padding: 20,
    },
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    formInput: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    textArea: {
      height: 120,
      textAlignVertical: 'top',
    },
    // Photo Upload Styles
    photoUploadContainer: {
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    photoUploadButtons: {
      flexDirection: 'row',
      gap: 16,
    },
    photoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      gap: 8,
    },
    photoButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    photoPreview: {
      position: 'relative',
      width: 120,
      height: 120,
      borderRadius: 60,
      overflow: 'hidden',
    },
    photoPreviewImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    photoOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: 15,
      padding: 6,
    },
    photoContainer: {
      alignItems: 'center',
      marginVertical: 8,
    },
    personPhoto: {
      width: 80,
      height: 80,
      borderRadius: 40,
      resizeMode: 'cover',
      borderWidth: 2,
      borderColor: colors.border,
    },
    noPhotoContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noPhotoText: {
      fontSize: 10,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },
    formHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 12,
      fontStyle: 'italic',
    },
    incidentPhotoPreview: {
      width: 200,
      height: 120,
      borderRadius: 8,
      resizeMode: 'cover',
    },
    reportPhoto: {
      width: 150,
      height: 90,
      borderRadius: 8,
      resizeMode: 'cover',
      borderWidth: 1,
      borderColor: colors.border,
    },
    // Team Profile Photo Styles
    officerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    profilePhotoContainer: {
      marginRight: 12,
    },
    profilePhoto: {
      width: 40,
      height: 40,
      borderRadius: 20,
      resizeMode: 'cover',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    profilePhotoPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Theme Toggle Button Style
    themeToggleButton: {
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    // Professional Stats Styles
    statContent: {
      padding: 16,
    },
    statHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    statIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statTrend: {
      opacity: 0.6,
    },
    statSubtext: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    // Profile Photo Preview Style
    profilePhotoPreview: {
      width: 120,
      height: 120,
      borderRadius: 60,
      resizeMode: 'cover',
    },
    // Quick Navigation Links Styles
    quickLinksContainer: {
      gap: 12,
    },
    quickLinkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    quickLinkText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    // Admin Screen Styles
    configItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    configLabel: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
    configValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
      flex: 1,
      textAlign: 'right',
    },
    adminActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      marginTop: 12,
      gap: 8,
    },
    adminActionButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    // Professional Report Card Styles
    professionalCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 16,
      marginVertical: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    professionalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    professionalIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    professionalTitleContainer: {
      flex: 1,
    },
    professionalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    professionalSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
    professionalActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 12,
    },
    professionalActionText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
      textAlign: 'center',
    },
    // Professional Card Styles (similar to Incident form)
    professionalCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 16,
      marginVertical: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    professionalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    professionalIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    professionalTitleContainer: {
      flex: 1,
    },
    professionalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    professionalSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
    professionalActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 12,
    },
    professionalActionText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
      textAlign: 'center',
    },
    // Profile Modal Styles
    profileModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.elevated,
    },
    profileCloseButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    profileHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 16,
    },
    profileIconContainer: {
      marginRight: 12,
    },
    profileTitleContainer: {
      flex: 1,
    },
    profileModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    profileModalSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
    profileSaveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 6,
    },
    profileSaveButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    // Quick Navigation Links Styles
    quickLinksContainer: {
      gap: 12,
    },
    quickLinkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    quickLinkText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    incidentDetailPhoto: {
      width: 200,
      height: 120,
      borderRadius: 8,
      resizeMode: 'cover',
      borderWidth: 1,
      borderColor: colors.border,
    },
    locationInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    locationButton: {
      padding: 14,
      backgroundColor: colors.primary,
      borderRadius: 12,
    },
    priorityButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    priorityButton: {
      flex: 1,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    priorityButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    priorityButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    priorityButtonTextActive: {
      color: '#FFFFFF',
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 16,
      marginTop: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    submitButtonDisabled: {
      backgroundColor: colors.textMuted,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
      marginLeft: 12,
    },
    submitNote: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 16,
      fontStyle: 'italic',
    },

    // Team Styles
    teamList: {
      flex: 1,
      padding: 16,
    },
    statusGroup: {
      marginBottom: 24,
    },
    statusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 18,
      borderRadius: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    statusTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 12,
      flex: 1,
    },
    statusCount: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    statusCountText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    officerCard: {
      backgroundColor: colors.surface,
      padding: 20,
      borderRadius: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    officerInfo: {
      flex: 1,
    },
    officerName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    officerDetails: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    officerBadge: {
      fontSize: 13,
      color: colors.textMuted,
    },

    // Modals
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    modalContent: {
      flex: 1,
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      marginTop: 24,
    },
    statusOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    statusOptionActive: {
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    statusOptionText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginLeft: 12,
      flex: 1,
      fontWeight: '500',
    },
    statusOptionTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },

    // Theme Toggle
    themeToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
    },
    themeToggleText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },

    // Incident Details
    incidentDetailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24,
    },
    incidentDetailTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      marginRight: 16,
    },
    priorityBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    priorityBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    detailSection: {
      marginBottom: 20,
    },
    detailLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    detailText: {
      fontSize: 16,
      color: colors.text,
      lineHeight: 24,
    },
    actionButtons: {
      marginTop: 24,
      gap: 12,
    },
    takeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
    },
    takeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      marginLeft: 8,
    },
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.secondary,
      paddingVertical: 16,
      borderRadius: 12,
    },
    completeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      marginLeft: 8,
    },
    incidentMapButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warning,
      paddingVertical: 16,
      borderRadius: 12,
    },
    incidentMapButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      marginLeft: 8,
    },

    // Report Writing Styles
    reportTextArea: {
      height: 300,
      textAlignVertical: 'top',
      lineHeight: 22,
    },
    reportPreview: {
      marginBottom: 20,
    },
    previewCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    previewMeta: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    previewContent: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginTop: 8,
    },
    saveOptions: {
      flexDirection: 'row',
      gap: 12,
    },
    optionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    optionText: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },

    // RegisterModal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      maxHeight: '90%',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
    },
    formContainer: {
      flex: 1,
      padding: 20,
    },
    errorContainer: {
      backgroundColor: colors.error + '20',
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    registerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    registerButtonDisabled: {
      backgroundColor: colors.textMuted,
    },
    registerButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      marginLeft: 8,
    },

    // Modern Header Styles
    modernHeaderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    
    headerIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    
    headerTextContainer: {
      flex: 1,
    },
    
    modernTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    
    modernSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },

    // Modern Chat Design Styles
    modernChatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },

    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    chatHeaderInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },

    chatHeaderAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },

    chatHeaderName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },

    chatHeaderStatus: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },

    optionsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },

    messagesArea: {
      flex: 1,
      padding: 16,
      backgroundColor: colors.background,
    },

    modernMessageBubble: {
      maxWidth: '80%',
      marginBottom: 12,
      padding: 12,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },

    myMessageBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },

    otherMessageBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },

    modernMessageText: {
      fontSize: 16,
      lineHeight: 20,
      marginBottom: 4,
    },

    myMessageText: {
      color: '#FFFFFF',
    },

    otherMessageText: {
      color: colors.text,
    },

    messageSenderName: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4,
      color: colors.primary,
    },

    modernMessageTime: {
      fontSize: 11,
      opacity: 0.7,
    },

    myMessageTime: {
      color: '#FFFFFF',
      textAlign: 'right',
    },

    otherMessageTime: {
      color: colors.textMuted,
    },

    modernMessageInput: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 16,
      paddingBottom: 32,
    },

    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.background,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },

    textInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      maxHeight: 100,
      minHeight: 40,
      paddingVertical: 8,
      paddingRight: 12,
      lineHeight: 20,
    },

    modernSendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },

    sendButtonActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },

    sendButtonInactive: {
      backgroundColor: colors.textMuted + '30',
    },

    emptyChat: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },

    emptyChatText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 8,
    },

    emptyChatSubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 40,
    },

    chatDropdown: {
      position: 'absolute',
      top: 80,
      right: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
      minWidth: 200,
    },

    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '50',
    },

    dropdownText: {
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
      fontWeight: '500',
    },

    editModal: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
    },

    editModalContent: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      minWidth: 300,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 12,
    },

    editModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },

    editModalInput: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 20,
    },

    editModalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },

    modalButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },

    cancelButton: {
      backgroundColor: colors.textMuted + '20',
      borderWidth: 1,
      borderColor: colors.textMuted + '50',
    },

    saveButton: {
      backgroundColor: colors.primary,
    },

    cancelButtonText: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '600',
    },

    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    fixedChannelsSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },

    privateChatSection: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },

    channelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },

    fixedChannel: {
      backgroundColor: colors.background,
    },

    emergencyChannel: {
      borderColor: '#F44336',
      backgroundColor: '#F44336' + '10',
    },

    channelIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    channelInfo: {
      flex: 1,
    },

    channelName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },

    channelDescription: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },

    channelActions: {
      alignItems: 'center',
    },

    newChatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },

    newChatButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
    },

    chatListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },

    chatAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    chatInfo: {
      flex: 1,
    },

    chatName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },

    chatLastMessage: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 2,
    },

    chatTime: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 4,
    },

    chatActions: {
      alignItems: 'flex-end',
    },

    unreadBadge: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },

    unreadText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '600',
    },

    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },

    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 12,
      marginBottom: 4,
    },

    emptySubtext: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 20,
    },

    chatsList: {
      flex: 1,
    },
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    
    chatHeaderTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },

    chatOptionsModal: {
      position: 'absolute',
      top: 70,
      right: 16,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 1000,
    },

    chatOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: 'transparent',
    },

    chatOptionText: {
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
    },

    editNameModal: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
    },

    editNameTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },

    editNameInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
      minWidth: 250,
      marginBottom: 16,
    },

    editNameButtons: {
      flexDirection: 'row',
      gap: 12,
    },

    editNameButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 6,
      alignItems: 'center',
    },

    newChatButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },

    chatsList: {
      flex: 1,
    },

    chatListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    chatAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    chatInfo: {
      flex: 1,
    },

    chatName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },

    chatLastMessage: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 2,
    },

    chatTime: {
      fontSize: 12,
      color: colors.textMuted,
    },

    chatActions: {
      alignItems: 'center',
    },

    unreadBadge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },

    unreadText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },

    screenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    chatContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    chatHeaderInfo: {
      flex: 1,
    },
    chatHeaderName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    chatHeaderStatus: {
      fontSize: 14,
      color: colors.success,
      marginTop: 2,
    },
    messagesList: {
      flex: 1,
      padding: 16,
    },
    messageContainer: {
      marginVertical: 4,
    },
    myMessage: {
      alignItems: 'flex-end',
    },
    theirMessage: {
      alignItems: 'flex-start',
    },
    messageBubble: {
      maxWidth: '80%',
      padding: 12,
      borderRadius: 16,
    },
    
    myMessageBubble: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    
    theirMessageBubble: {
      backgroundColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: 16,
      lineHeight: 20,
    },
    myMessageText: {
      color: '#FFFFFF',
    },
    theirMessageText: {
      color: colors.text,
    },
    messageTime: {
      fontSize: 12,
      marginTop: 4,
    },
    myMessageTime: {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    theirMessageTime: {
      color: colors.textMuted,
    },
    
    senderName: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 4,
    },
    messageInputContainer: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    messageInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 16,
    },
    
    messageInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginRight: 8,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.textMuted,
    },
    chatListContainer: {
      flex: 1,
      paddingHorizontal: 16,
    },
    chatListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    chatAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    chatInfo: {
      flex: 1,
    },
    chatName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    chatLastMessage: {
      fontSize: 14,
      color: colors.textMuted,
    },
    chatMeta: {
      alignItems: 'flex-end',
    },
    chatTime: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    unreadBadge: {
      backgroundColor: colors.error,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    unreadCount: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },

    // Channel Tabs
    channelTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    
    channelTab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginHorizontal: 4,
      backgroundColor: colors.background,
    },
    
    activeChannelTab: {
      backgroundColor: colors.primary + '20',
    },
    
    channelTabText: {
      fontSize: 14,
      color: colors.textMuted,
      marginLeft: 6,
    },
    
    activeChannelTabText: {
      color: colors.primary,
      fontWeight: '600',
    },

    chatContent: {
      flex: 1,
    },

    channelContainer: {
      flex: 1,
    },

    channelMessages: {
      flex: 1,
      padding: 16,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textMuted,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Missing styles for inline report form
    locationInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    gpsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 4,
    },
    gpsButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    priorityContainer: {
      flexDirection: 'row',
      gap: 8,
    },

    // Map styles for incident details
    mapThumbnail: {
      borderRadius: 12,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    mapPreview: {
      backgroundColor: colors.surface,
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    mapPreviewTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginTop: 12,
      textAlign: 'center',
    },
    mapPreviewAddress: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    mapPreviewCoords: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    mapOpenButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginTop: 16,
      gap: 6,
    },
    mapOpenButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    mapContainer: {
      marginTop: 12,
    },

    // Admin Settings Modal Styles
    adminSettingsContainer: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      width: '95%',
      maxWidth: 600,
      maxHeight: '90%',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 16,
    },
    adminSettingsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.primary + '10',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    adminHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 16,
    },
    adminIconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    adminTitleContainer: {
      flex: 1,
    },
    adminModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    adminModalSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
    adminSaveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    adminSaveButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 6,
    },
    currentConfigContainer: {
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    configText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
      lineHeight: 20,
    },
    iconPreview: {
      width: 80,
      height: 80,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
    },
    iconPreviewImage: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
    },
    photoOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
    },
    iconUploadButton: {
      width: 80,
      height: 80,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconUploadText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
      maxWidth: 70,
    },
  });

  const renderHomeScreen = () => (
    <ScrollView 
      style={dynamicStyles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Modern Header */}
      <View style={dynamicStyles.homeHeader}>
        <View style={dynamicStyles.headerContent}>
          <View style={dynamicStyles.headerLeft}>
            <Text style={dynamicStyles.welcomeText}>{appConfig.app_name}</Text>
            <Text style={dynamicStyles.userName}>{appConfig.app_subtitle}</Text>
            <View style={dynamicStyles.statusBadge}>
              <View style={[dynamicStyles.statusDot, { backgroundColor: getStatusColor(userStatus) }]} />
              <Text style={dynamicStyles.userRole}>
                {user?.role === 'admin' ? 'Administrator' : 'Wächter'} • {userStatus}
              </Text>
            </View>
          </View>
          <View style={dynamicStyles.headerButtons}>
            {/* Theme Toggle Button */}
            <TouchableOpacity 
              style={[dynamicStyles.headerButton, dynamicStyles.themeToggleButton]} 
              onPress={toggleTheme}
              accessible={true}
              accessibilityLabel={isDarkMode ? "Hell-Modus aktivieren" : "Dunkel-Modus aktivieren"}
            >
              <Ionicons 
                name={isDarkMode ? "sunny" : "moon"} 
                size={20} 
                color={colors.accent} 
              />
            </TouchableOpacity>
            
            {/* SOS Button */}
            <TouchableOpacity 
              style={[dynamicStyles.headerButton, dynamicStyles.sosHeaderButton]} 
              onPress={() => setShowSOSModal(true)}
              accessible={true}
              accessibilityLabel="SOS Notruf"
            >
              <Ionicons name="warning" size={20} color="#FFFFFF" />
              <Text style={dynamicStyles.sosButtonText}>SOS</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={dynamicStyles.headerButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={dynamicStyles.headerButton} 
              onPress={() => setShowProfileModal(true)}
              accessible={true}
              accessibilityLabel="Profil bearbeiten"
            >
              <Ionicons name="person-circle" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Professional Stats Dashboard */}
      <View style={dynamicStyles.statsContainer}>
        <TouchableOpacity 
          style={[dynamicStyles.statCard, { borderLeftColor: colors.error }]}
          onPress={openAllIncidentsModal}
          activeOpacity={0.7}
        >
          <View style={dynamicStyles.statContent}>
            <View style={dynamicStyles.statHeader}>
              <View style={[dynamicStyles.statIconContainer, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="alert-circle" size={24} color={colors.error} />
              </View>
              <View style={dynamicStyles.statTrend}>
                <Ionicons name="trending-up" size={16} color={colors.textMuted} />
              </View>
            </View>
            <Text style={dynamicStyles.statNumber}>{recentIncidents.length}</Text>
            <Text style={dynamicStyles.statLabel}>Aktuelle Vorfälle</Text>
            <Text style={dynamicStyles.statSubtext}>+{recentIncidents.filter(i => new Date(i.created_at) > new Date(Date.now() - 24*60*60*1000)).length} heute</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[dynamicStyles.statCard, { borderLeftColor: colors.primary }]}
          onPress={() => setActiveTab('team')}
          activeOpacity={0.7}
        >
          <View style={dynamicStyles.statContent}>
            <View style={dynamicStyles.statHeader}>
              <View style={[dynamicStyles.statIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="people" size={24} color={colors.primary} />
              </View>
              <View style={dynamicStyles.statTrend}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              </View>
            </View>
            <Text style={dynamicStyles.statNumber}>{Object.values(usersByStatus).flat().length}</Text>
            <Text style={dynamicStyles.statLabel}>Team Mitglieder</Text>
            <Text style={dynamicStyles.statSubtext}>{Object.values(usersByStatus).flat().filter(u => u.status === 'Im Dienst').length} im Dienst</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[dynamicStyles.statCard, { borderLeftColor: colors.success }]}
          onPress={() => setActiveTab('berichte')}
          activeOpacity={0.7}
        >
          <View style={dynamicStyles.statContent}>
            <View style={dynamicStyles.statHeader}>
              <View style={[dynamicStyles.statIconContainer, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="document-text" size={24} color={colors.success} />
              </View>
              <View style={dynamicStyles.statTrend}>
                <Ionicons name="time" size={16} color={colors.textMuted} />
              </View>
            </View>
            <Text style={dynamicStyles.statNumber}>{reports.length}</Text>
            <Text style={dynamicStyles.statLabel}>Berichte Heute</Text>
            <Text style={dynamicStyles.statSubtext}>{reports.filter(r => r.status === 'submitted').length} eingereicht</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Admin Quick Actions - NUR FÜR ADMINS */}
      {/* Aktuelle Vorfälle */}
      <View style={dynamicStyles.card}>
        <TouchableOpacity 
          style={dynamicStyles.cardHeader}
          onPress={openAllIncidentsModal}
          activeOpacity={0.7}
        >
          <Ionicons name="time" size={24} color={colors.primary} />
          <Text style={dynamicStyles.cardTitle}>Aktuelle Vorfälle</Text>
          <View style={dynamicStyles.cardHeaderRight}>
            {recentIncidents.length > 0 && (
              <View style={[dynamicStyles.statusCount, { backgroundColor: colors.primary }]}>
                <Text style={dynamicStyles.statusCountText}>{recentIncidents.length}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        
        {recentIncidents.length === 0 ? (
          <View style={dynamicStyles.emptyState}>
            <Ionicons name="shield-checkmark" size={64} color={colors.primary} style={dynamicStyles.emptyIcon} />
            <Text style={dynamicStyles.emptyText}>Keine aktuellen Vorfälle</Text>
            <Text style={dynamicStyles.emptySubtext}>
              Derzeit sind keine Vorfälle gemeldet 🛡️
            </Text>
          </View>
        ) : (
          <>
            <Text style={[dynamicStyles.emptySubtext, { marginBottom: 12, textAlign: 'center' }]}>
              🚨 Neuester Vorfall
            </Text>
            
            {/* Show only the most recent incident */}
            {recentIncidents.slice(0, 1).map((incident, index) => (
              <TouchableOpacity 
                key={incident.id || index} 
                style={[dynamicStyles.incidentCard, 
                  { borderLeftColor: getPriorityColor(incident.priority) }
                ]}
                onPress={() => {
                  console.log('🔍 Incident clicked:', incident);
                  console.log('🔍 Setting selectedIncident and opening 🚨 Vorfall Details modal');
                  setSelectedIncident(incident);
                  setShowIncidentDetailModal(true);
                  console.log('🔍 🚨 Vorfall Details modal should now be visible');
                }}
              >
                <View style={[dynamicStyles.incidentIcon, 
                  { backgroundColor: getPriorityColor(incident.priority) + '20' }
                ]}>
                  <Ionicons name="warning" size={24} color={getPriorityColor(incident.priority)} />
                </View>
                <View style={dynamicStyles.incidentContent}>
                  <Text style={dynamicStyles.incidentTitle}>
                    {incident.title}
                  </Text>
                  <Text style={dynamicStyles.incidentTime}>
                    🕒 {incident.created_at ? 
                      new Date(incident.created_at).toLocaleString('de-DE') : 
                      'Unbekannte Zeit'
                    }
                  </Text>
                  <Text style={[dynamicStyles.incidentTime, { color: colors.textMuted }]}>
                    📍 {incident.address || incident.location || 'Unbekannter Ort'}
                  </Text>
                </View>
                {/* Karten-Button komplett entfernt */}
              </TouchableOpacity>
            ))}

            {recentIncidents.length > 1 && (
              <Text style={[dynamicStyles.emptySubtext, { textAlign: 'center', marginTop: 8 }]}>
                ... und {recentIncidents.length - 1} weitere Vorfall{recentIncidents.length - 1 !== 1 ? 'e' : ''}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Bürgerdatenbank Category */}
      <TouchableOpacity 
        style={dynamicStyles.card}
        onPress={() => setActiveTab('database')}
        activeOpacity={0.8}
      >
        <View style={dynamicStyles.cardHeader}>
          <Ionicons name="people" size={24} color={colors.secondary} />
          <Text style={dynamicStyles.cardTitle}>Bürgerdatenbank</Text>
          <View style={dynamicStyles.cardHeaderRight}>
            <View style={[dynamicStyles.statusBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
              <Text style={[dynamicStyles.statusBadgeText, { color: colors.warning }]}>
                {personStats.missing_persons}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </View>
        
        <View style={dynamicStyles.summaryRow}>
          <View style={dynamicStyles.summaryItem}>
            <Text style={[dynamicStyles.summaryNumber, { color: colors.text }]}>
              {personStats.total_persons}
            </Text>
            <Text style={dynamicStyles.summaryLabel}>Gesamt</Text>
          </View>
          <View style={dynamicStyles.summaryItem}>
            <Text style={[dynamicStyles.summaryNumber, { color: colors.warning }]}>
              {personStats.missing_persons}
            </Text>
            <Text style={dynamicStyles.summaryLabel}>Vermisst</Text>
          </View>
          <View style={dynamicStyles.summaryItem}>
            <Text style={[dynamicStyles.summaryNumber, { color: colors.error }]}>
              {personStats.wanted_persons}
            </Text>
            <Text style={dynamicStyles.summaryLabel}>Gesucht</Text>
          </View>
          <View style={dynamicStyles.summaryItem}>
            <Text style={[dynamicStyles.summaryNumber, { color: colors.success }]}>
              {personStats.found_persons}
            </Text>
            <Text style={dynamicStyles.summaryLabel}>Gefunden</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // Render chat screen function - Back to DiscordMessages with fixed users
  const renderChatScreen = () => {
    return (
      <DiscordMessages 
        user={user || { username: 'Test Beamter', id: 'test-123' }}
        token={token || 'demo-token'}
        selectedChannel="allgemein"
        theme={{ colors, isDarkMode }}
        usersByStatus={usersByStatus}
      />
    );
  };
  const renderIncidentScreen = () => {
    console.log('🔍 Rendering incident screen...');
    console.log('🔍 User:', user);
    console.log('🔍 Incident form data:', incidentFormData);
    
    return (
      <View style={dynamicStyles.content}>
        <View style={dynamicStyles.screenHeader}>
          <Text style={dynamicStyles.screenTitle}>🚨 Vorfall melden</Text>
        </View>

        <ScrollView style={dynamicStyles.form} showsVerticalScrollIndicator={false}>
          {/* Debug Info */}
          <View style={{ padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>
              DEBUG: Incident Screen geladen ✅
            </Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              User: {user?.username || 'Nicht eingeloggt'}
            </Text>
          </View>

          <View style={dynamicStyles.formGroup}>
            <Text style={dynamicStyles.formLabel}>Art des Vorfalls *</Text>
            <TextInput
              style={dynamicStyles.formInput}
              placeholder="z.B. Verkehrsunfall, Diebstahl, Ruhestörung"
              placeholderTextColor={colors.textMuted}
              value={incidentFormData.title}
              onChangeText={(value) => setIncidentFormData(prev => ({ ...prev, title: value }))}
            />
          </View>

          <View style={dynamicStyles.formGroup}>
            <Text style={dynamicStyles.formLabel}>Beschreibung *</Text>
            <TextInput
              style={[dynamicStyles.formInput, dynamicStyles.textArea]}
              placeholder="Detaillierte Beschreibung des Vorfalls"
              placeholderTextColor={colors.textMuted}
              value={incidentFormData.description}
              onChangeText={(value) => setIncidentFormData(prev => ({ ...prev, description: value }))}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={dynamicStyles.formGroup}>
            <Text style={dynamicStyles.formLabel}>📍 Standort</Text>
            <View style={dynamicStyles.locationInput}>
              <TextInput
                style={[dynamicStyles.formInput, { flex: 1 }]}
                placeholder="Koordinaten (automatisch)"
                placeholderTextColor={colors.textMuted}
                value={incidentFormData.location}
                editable={false}
              />
              <TouchableOpacity style={dynamicStyles.locationButton} onPress={useCurrentLocationForIncident}>
                <Ionicons name="location" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={dynamicStyles.formGroup}>
            <Text style={dynamicStyles.formLabel}>🏠 Adresse</Text>
            <TextInput
              style={dynamicStyles.formInput}
              placeholder="Straße, Hausnummer, PLZ Ort"
              placeholderTextColor={colors.textMuted}
              value={incidentFormData.address}
              onChangeText={(value) => setIncidentFormData(prev => ({ ...prev, address: value }))}
            />
          </View>

          <View style={dynamicStyles.formGroup}>
            <Text style={dynamicStyles.formLabel}>⚠️ Priorität</Text>
            <View style={dynamicStyles.priorityButtons}>
              {['low', 'medium', 'high'].map(priority => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    dynamicStyles.priorityButton,
                    incidentFormData.priority === priority && dynamicStyles.priorityButtonActive
                  ]}
                  onPress={() => setIncidentFormData(prev => ({ ...prev, priority }))}
                >
                  <Text style={[
                    dynamicStyles.priorityButtonText,
                    incidentFormData.priority === priority && dynamicStyles.priorityButtonTextActive
                  ]}>
                    {priority === 'low' ? '🟢 Niedrig' : 
                     priority === 'medium' ? '🟡 Mittel' : 
                     '🔴 Hoch'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[dynamicStyles.submitButton, sendingMessage && dynamicStyles.submitButtonDisabled]}
            onPress={() => {
              console.log('🔍 Submit button pressed');
              console.log('🔍 Form data:', incidentFormData);
              submitIncidentForm();
            }}
            disabled={sendingMessage}
          >
            {sendingMessage ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={dynamicStyles.submitButtonText}>Vorfall melden</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={dynamicStyles.submitNote}>
            📡 Der Vorfall wird sofort an alle verfügbaren Beamte übertragen
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  };

  const renderAdminScreen = () => (
    <View style={dynamicStyles.content}>
      {/* Modern Admin Header */}
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.headerLeft}>
          <Text style={dynamicStyles.welcomeText}>⚙️ Admin-Dashboard</Text>
          <Text style={dynamicStyles.usernameText}>System-Verwaltung</Text>
        </View>
      </View>

      <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
        {/* Modern Admin Cards */}
        <View style={dynamicStyles.statsContainer}>
          <TouchableOpacity 
            style={[dynamicStyles.statCard, { borderLeftColor: colors.primary }]}
            onPress={() => setShowAdminSettingsModal(true)}
            activeOpacity={0.7}
          >
            <View style={dynamicStyles.statContent}>
              <View style={dynamicStyles.statHeader}>
                <View style={[dynamicStyles.statIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="settings" size={24} color={colors.primary} />
                </View>
              </View>
              <Text style={dynamicStyles.statNumber}>⚙️</Text>
              <Text style={dynamicStyles.statLabel}>App-Konfiguration</Text>
              <Text style={dynamicStyles.statSubtext}>Name, Icon, Branding</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[dynamicStyles.statCard, { borderLeftColor: colors.success }]}
            onPress={() => setShowAddUserModal(true)}
            activeOpacity={0.7}
          >
            <View style={dynamicStyles.statContent}>
              <View style={dynamicStyles.statHeader}>
                <View style={[dynamicStyles.statIconContainer, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="person-add" size={24} color={colors.success} />
                </View>
              </View>
              <Text style={dynamicStyles.statNumber}>👤</Text>
              <Text style={dynamicStyles.statLabel}>Benutzer hinzufügen</Text>
              <Text style={dynamicStyles.statSubtext}>Neue Team-Mitglieder</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Admin Actions */}
        <View style={dynamicStyles.card}>
          <Text style={dynamicStyles.cardTitle}>🛠️ Admin-Aktionen</Text>
          
          <TouchableOpacity 
            style={[dynamicStyles.adminActionButton, { backgroundColor: colors.success }]}
            onPress={() => setShowAddUserModal(true)}
          >
            <Ionicons name="person-add" size={20} color="#FFFFFF" />
            <Text style={dynamicStyles.adminActionButtonText}>Benutzer hinzufügen</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[dynamicStyles.adminActionButton, { backgroundColor: colors.warning }]}
            onPress={() => {
              Alert.alert(
                '🔄 System-Neustart',
                'System neu starten? Dies kann einige Sekunden dauern.',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Neustart', onPress: () => window.location.reload() }
                ]
              );
            }}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={dynamicStyles.adminActionButtonText}>System neu starten</Text>
          </TouchableOpacity>
        </View>

        {/* System Information */}
        <View style={dynamicStyles.card}>
          <Text style={dynamicStyles.cardTitle}>ℹ️ System-Information</Text>
          <View style={dynamicStyles.configItem}>
            <Text style={dynamicStyles.configLabel}>Aktueller Benutzer:</Text>
            <Text style={dynamicStyles.configValue}>{user?.username} ({user?.role})</Text>
          </View>
          <View style={dynamicStyles.configItem}>
            <Text style={dynamicStyles.configLabel}>Version:</Text>
            <Text style={dynamicStyles.configValue}>v1.0.0</Text>
          </View>
          <View style={dynamicStyles.configItem}>
            <Text style={dynamicStyles.configLabel}>Backend:</Text>
            <Text style={dynamicStyles.configValue}>Online ✅</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );

  const renderMyTeamScreen = () => {
    const myTeamMembers = Object.values(usersByStatus).flat().filter(member => 
      member.team === user?.team
    );

    return (
      <View style={dynamicStyles.content}>
        <View style={dynamicStyles.screenHeader}>
          <Text style={dynamicStyles.screenTitle}>👥 {user?.team}</Text>
          <Text style={dynamicStyles.screenSubtitle}>{myTeamMembers.length} Mitglieder</Text>
        </View>

        <ScrollView style={dynamicStyles.teamList}>
          {myTeamMembers.map((member) => (
            <View key={member.id} style={dynamicStyles.teamMemberCard}>
              <View style={dynamicStyles.memberInfo}>
                <View style={dynamicStyles.memberPhotoContainer}>
                  {member.photo ? (
                    <Image source={{ uri: member.photo }} style={dynamicStyles.memberPhoto} />
                  ) : (
                    <View style={dynamicStyles.memberPhotoPlaceholder}>
                      <Ionicons name="person" size={20} color={colors.textMuted} />
                    </View>
                  )}
                </View>
                
                <View style={dynamicStyles.memberDetails}>
                  <Text style={dynamicStyles.memberName}>{member.username}</Text>
                  <Text style={dynamicStyles.memberRank}>
                    🎖️ {member.rank || 'Beamter'} • 🆔 {member.service_number || 'N/A'}
                  </Text>
                </View>
                
                <View style={dynamicStyles.statusIndicator}>
                  <View style={[
                    dynamicStyles.statusDot, 
                    { backgroundColor: getStatusColor(member.status || 'Im Dienst') }
                  ]} />
                  <Text style={dynamicStyles.statusText}>
                    {member.status || 'Im Dienst'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTeamScreen = () => (
    <View style={dynamicStyles.content}>
      <View style={dynamicStyles.screenHeader}>
        <Text style={dynamicStyles.screenTitle}>👥 Team Übersicht</Text>
        <View style={dynamicStyles.headerActions}>
          {user?.role === 'admin' && (
            <TouchableOpacity 
              style={dynamicStyles.addButton}
              onPress={() => setShowAddUserModal(true)}
            >
              <Ionicons name="person-add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => loadUsersByStatus()}>
            <Ionicons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={dynamicStyles.teamList}
        refreshControl={<RefreshControl refreshing={teamLoading} onRefresh={() => loadUsersByStatus()} />}
        showsVerticalScrollIndicator={false}
      >
        {Object.entries(usersByStatus).map(([status, users]) => (
          <View key={status} style={dynamicStyles.statusGroup}>
            <View style={dynamicStyles.statusHeader}>
              <View style={[dynamicStyles.statusDot, { backgroundColor: getStatusColor(status) }]} />
              <Text style={dynamicStyles.statusTitle}>{status}</Text>
              <View style={dynamicStyles.statusCount}>
                <Text style={dynamicStyles.statusCountText}>{users.length}</Text>
              </View>
            </View>
            
            {users.map((officer) => (
              <TouchableOpacity 
                key={officer.id} 
                style={dynamicStyles.officerCard}
                onPress={() => {
                  // Zeige Benutzerinfo bei Klick
                  Alert.alert(
                    '👤 ' + officer.username,
                    `Abteilung: ${officer.department || 'Allgemein'}\nRang: ${officer.rank || 'Beamter'}\nStatus: ${officer.status || 'Im Dienst'}\nDienstnummer: ${officer.service_number || 'N/A'}`,
                    [{ text: 'OK' }]
                  );
                }}
                disabled={!user}
              >
                <View style={dynamicStyles.officerInfo}>
                  <View style={dynamicStyles.officerHeader}>
                    {/* Profile Photo */}
                    <View style={dynamicStyles.profilePhotoContainer}>
                      {officer.photo ? (
                        <Image 
                          source={{ uri: officer.photo }} 
                          style={dynamicStyles.profilePhoto}
                          onError={(e) => console.log('❌ Image load error:', e.nativeEvent.error)}
                        />
                      ) : (
                        <View style={dynamicStyles.profilePhotoPlaceholder}>
                          <Ionicons name="person" size={20} color={colors.textMuted} />
                        </View>
                      )}
                    </View>
                    <Text style={dynamicStyles.officerName}>{officer.username}</Text>
                  </View>
                  <Text style={dynamicStyles.officerDetails}>
                    🏢 {officer.department || 'Allgemein'} • 🎖️ {officer.rank || 'Beamter'}
                  </Text>
                  <Text style={dynamicStyles.officerBadge}>
                    🆔 Dienstnummer: {officer.service_number || 'N/A'}
                  </Text>
                  {officer.is_online && (
                    <Text style={[dynamicStyles.officerBadge, { color: colors.success }]}>
                      🟢 {officer.online_status}
                    </Text>
                  )}
                </View>

                {/* Action Buttons für alle Benutzer */}
                <View style={dynamicStyles.reportActions}>
                  {/* Private Nachricht Button - KOMPLETT ENTFERNT */}

                  {/* Edit Button - für ALLE sichtbar, aber nur Admins können verwenden */}
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.editButton, 
                      { opacity: user?.role === 'admin' ? 1 : 0.5 }
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (user?.role !== 'admin') {
                        Alert.alert('🔒 Keine Berechtigung', 'Nur Administratoren können Benutzer bearbeiten.');
                        return;
                      }
                      setProfileData({
                        username: officer.username,
                        phone: officer.phone || '',
                        service_number: officer.service_number || '',
                        rank: officer.rank || '',
                        department: officer.department || ''
                      });
                      setUserStatus(officer.status || 'Im Dienst');
                      setEditingUser(officer);
                      setShowProfileModal(true);
                    }}
                  >
                    <Ionicons name="create" size={16} color="#FFFFFF" />
                  </TouchableOpacity>

                  {/* Delete Button - für ALLE sichtbar, aber nur Admins können verwenden */}
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.editButton, 
                      { 
                        backgroundColor: colors.error,
                        opacity: user?.role === 'admin' ? 1 : 0.5 
                      }
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      console.log('🔍 Current user role:', user?.role);
                      if (user?.role !== 'admin' && user?.role !== 'ADMIN') {
                        Alert.alert('🔒 Keine Berechtigung', `Nur Administratoren können Benutzer löschen. Ihre Rolle: ${user?.role}`);
                        return;
                      }
                      Alert.alert(
                        '🗑️ Benutzer löschen',
                        `Möchten Sie ${officer.username} wirklich löschen?`,
                        [
                          { text: 'Abbrechen', style: 'cancel' },
                          { 
                            text: 'Löschen', 
                            style: 'destructive',
                            onPress: () => {
                              console.log('🗑️ Delete button pressed for officer:', officer);
                              const userId = officer.id || officer._id || officer.user_id;
                              console.log('🔍 Found user ID:', userId);
                              if (!userId) {
                                console.error('❌ No valid user ID found in officer object:', Object.keys(officer));
                                Alert.alert('❌ Fehler', 'Benutzer-ID nicht gefunden. Verfügbare Felder: ' + Object.keys(officer).join(', '));
                                return;
                              }
                              deleteUser(userId, officer.username);
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        
        {Object.keys(usersByStatus).length === 0 && !teamLoading && (
          <View style={dynamicStyles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.textMuted} style={dynamicStyles.emptyIcon} />
            <Text style={dynamicStyles.emptyText}>Keine Teammitglieder gefunden</Text>
            <Text style={dynamicStyles.emptySubtext}>Team wird geladen oder Server nicht erreichbar</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );

  const renderBerichteScreen = () => (
    <View style={dynamicStyles.content}>
      <View style={dynamicStyles.screenHeader}>
        <Text style={dynamicStyles.screenTitle}>📊 Berichte & Archiv</Text>
        <View style={dynamicStyles.headerActions}>
          <TouchableOpacity 
            style={dynamicStyles.addButton}
            onPress={createNewReport}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => loadReports()}>
            <Ionicons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={dynamicStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadReports()} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Professional Quick Action Card */}
        <View style={[dynamicStyles.card, dynamicStyles.professionalCard]}>
          <View style={dynamicStyles.professionalHeader}>
            <View style={dynamicStyles.professionalIconContainer}>
              <Ionicons name="document" size={32} color={colors.primary} />
            </View>
            <View style={dynamicStyles.professionalTitleContainer}>
              <Text style={dynamicStyles.professionalTitle}>📝 Neuen Bericht erstellen</Text>
              <Text style={dynamicStyles.professionalSubtitle}>Tagesberichte und Schichtprotokoll</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[dynamicStyles.professionalActionButton, { backgroundColor: colors.primary }]}
            onPress={createNewReport}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={24} color="#FFFFFF" />
            <Text style={dynamicStyles.professionalActionText}>Bericht schreiben</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Berichte Statistiken */}
        <View style={dynamicStyles.card}>
          <View style={dynamicStyles.cardHeader}>
            <Ionicons name="bar-chart" size={24} color={colors.primary} />
            <Text style={dynamicStyles.cardTitle}>Übersicht</Text>
          </View>
          
          <View style={dynamicStyles.statsContainer}>
            <View style={dynamicStyles.statCard}>
              <View style={[dynamicStyles.statIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="document-text" size={20} color="#2563EB" />
              </View>
              <Text style={dynamicStyles.statNumber}>{reports.length}</Text>
              <Text style={dynamicStyles.statLabel}>Gesamt{'\n'}Berichte</Text>
            </View>
            
            <View style={dynamicStyles.statCard}>
              <View style={[dynamicStyles.statIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="create" size={20} color="#D97706" />
              </View>
              <Text style={dynamicStyles.statNumber}>
                {reports.filter(r => r.status === 'draft').length}
              </Text>
              <Text style={dynamicStyles.statLabel}>Entwürfe</Text>
            </View>
            
            <View style={dynamicStyles.statCard}>
              <View style={[dynamicStyles.statIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="checkmark-done" size={20} color="#059669" />
              </View>
              <Text style={dynamicStyles.statNumber}>
                {reports.filter(r => r.status === 'submitted').length}
              </Text>
              <Text style={dynamicStyles.statLabel}>Fertig</Text>
            </View>
          </View>
        </View>

        {/* Alle Berichte */}
        <View style={dynamicStyles.card}>
          <View style={dynamicStyles.cardHeader}>
            <Ionicons name="folder-open" size={24} color={colors.primary} />
            <Text style={dynamicStyles.cardTitle}>Alle Berichte</Text>
            <TouchableOpacity onPress={createNewReport}>
              <Ionicons name="add-circle" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={dynamicStyles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={dynamicStyles.emptyText}>Lade Berichte...</Text>
            </View>
          ) : reports.length === 0 ? (
            <View style={dynamicStyles.emptyState}>
              <Ionicons name="document-outline" size={64} color={colors.textMuted} style={dynamicStyles.emptyIcon} />
              <Text style={dynamicStyles.emptyText}>Noch keine Berichte vorhanden</Text>
              <Text style={dynamicStyles.emptySubtext}>
                Schreiben Sie Ihren ersten Bericht
              </Text>
              <TouchableOpacity 
                style={dynamicStyles.actionButton}
                onPress={createNewReport}
              >
                <Ionicons name="create" size={20} color="#FFFFFF" />
                <Text style={dynamicStyles.actionText}>Ersten Bericht schreiben</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[dynamicStyles.emptySubtext, { marginBottom: 12, textAlign: 'center' }]}>
                📋 {reports.length} Bericht{reports.length !== 1 ? 'e' : ''} gefunden
              </Text>
              
              {reports.map((report, index) => (
                <TouchableOpacity 
                  key={report.id || index} 
                  style={[dynamicStyles.incidentCard, 
                    { 
                      borderLeftColor: report.status === 'draft' ? colors.warning : 
                                      report.status === 'submitted' ? colors.success : colors.primary,
                      backgroundColor: report.status === 'draft' ? colors.warning + '10' : colors.surface
                    }
                  ]}
                  onPress={() => editReport(report)}
                >
                  <View style={[dynamicStyles.incidentIcon, 
                    { backgroundColor: (report.status === 'draft' ? colors.warning : colors.primary) + '20' }
                  ]}>
                    <Ionicons 
                      name={report.status === 'draft' ? 'create' : 'document-text'} 
                      size={24} 
                      color={report.status === 'draft' ? colors.warning : colors.primary} 
                    />
                  </View>
                  <View style={dynamicStyles.incidentContent}>
                    <Text style={dynamicStyles.incidentTitle}>
                      📄 {report.title || 'Unbenannter Bericht'}
                    </Text>
                    <Text style={dynamicStyles.incidentTime}>
                      👤 Von: {report.author_name || 'Unbekannt'}
                    </Text>
                    <Text style={dynamicStyles.incidentTime}>
                      📅 Schichtdatum: {report.shift_date ? 
                        new Date(report.shift_date).toLocaleDateString('de-DE') : 
                        'Nicht angegeben'
                      }
                    </Text>
                    <Text style={dynamicStyles.incidentTime}>
                      🕒 Erstellt: {report.created_at ? 
                        new Date(report.created_at).toLocaleString('de-DE') : 
                        'Unbekannt'
                      }
                    </Text>
                    <Text style={[
                      dynamicStyles.incidentStatus,
                      { 
                        color: report.status === 'draft' ? colors.warning : 
                               report.status === 'submitted' ? colors.success : colors.primary 
                      }
                    ]}>
                      📊 Status: {report.status === 'draft' ? '📝 Entwurf' : 
                                  report.status === 'submitted' ? '✅ Abgegeben' : 
                                  report.status === 'reviewed' ? '👁️ Geprüft' :
                                  '❓ ' + (report.status || 'Unbekannt')}
                    </Text>
                    {report.last_edited_by_name && (
                      <Text style={[dynamicStyles.incidentTime, { color: colors.textMuted, fontSize: 12 }]}>
                        ✏️ Zuletzt bearbeitet von: {report.last_edited_by_name}
                      </Text>
                    )}
                  </View>
                  <View style={dynamicStyles.reportActions}>
                    <TouchableOpacity 
                      style={[dynamicStyles.editButton, { backgroundColor: colors.primary, marginRight: 4 }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        viewReportDetails(report);
                      }}
                    >
                      <Ionicons name="eye" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[dynamicStyles.editButton, { marginRight: 4 }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        editReport(report);
                      }}
                    >
                      <Ionicons name="create" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={dynamicStyles.deleteReportButton}
                      onPress={async (e) => {
                        e.stopPropagation();
                        try {
                          const config = token ? {
                            headers: { Authorization: `Bearer ${token}` }
                          } : {};
                          
                          await axios.delete(`${API_URL}/api/reports/${report.id}`, config);
                          await loadReports(); // Liste neu laden
                          
                        } catch (error) {
                          console.error('Fehler beim Löschen des Berichts:', error);
                        }
                      }}
                    >
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );

  const renderDatabaseScreen = () => (
    <View style={dynamicStyles.content}>
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.modernHeaderContainer}>
          <View style={dynamicStyles.headerIconContainer}>
            <Ionicons name="people-circle" size={32} color={colors.primary} />
          </View>
          <View style={dynamicStyles.headerTextContainer}>
            <Text style={dynamicStyles.modernTitle}>Personendatenbank</Text>
            <Text style={dynamicStyles.modernSubtitle}>
              🔍 Gesuchte • ⚠️ Vermisste • ✅ Gefundene Personen
            </Text>
          </View>
        </View>
      </View>

      {/* Statistiken */}
      <View style={dynamicStyles.dbStatsContainer}>
        <View style={[dynamicStyles.dbStatCard, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
          <Text style={[dynamicStyles.dbStatNumber, { color: colors.warning }]}>{personStats.missing_persons}</Text>
          <Text style={dynamicStyles.dbStatLabel}>Vermisst</Text>
        </View>
        <View style={[dynamicStyles.dbStatCard, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
          <Text style={[dynamicStyles.dbStatNumber, { color: colors.error }]}>{personStats.wanted_persons}</Text>
          <Text style={dynamicStyles.dbStatLabel}>Gesucht</Text>
        </View>
        <View style={[dynamicStyles.dbStatCard, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
          <Text style={[dynamicStyles.dbStatNumber, { color: colors.success }]}>{personStats.found_persons}</Text>
          <Text style={dynamicStyles.dbStatLabel}>Gefunden</Text>
        </View>
        <View style={[dynamicStyles.dbStatCard, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
          <Text style={[dynamicStyles.dbStatNumber, { color: colors.primary }]}>{personStats.total_persons}</Text>
          <Text style={dynamicStyles.dbStatLabel}>Gesamt</Text>
        </View>
      </View>

      {/* Category Tabs */}
      <View style={dynamicStyles.categoryTabs}>
        <TouchableOpacity 
          style={[
            dynamicStyles.categoryTab,
            personFilter === 'all' && dynamicStyles.categoryTabActive
          ]}
          onPress={() => setPersonFilter('all')}
        >
          <Text style={[
            dynamicStyles.categoryTabText,
            personFilter === 'all' && dynamicStyles.categoryTabTextActive
          ]}>
            🌟 Alle ({personStats.total_persons})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            dynamicStyles.categoryTab,
            personFilter === 'vermisst' && dynamicStyles.categoryTabActive
          ]}
          onPress={() => setPersonFilter('vermisst')}
        >
          <Text style={[
            dynamicStyles.categoryTabText,
            personFilter === 'vermisst' && dynamicStyles.categoryTabTextActive
          ]}>
            ⚠️ Vermisste ({personStats.missing_persons})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            dynamicStyles.categoryTab,
            personFilter === 'gesucht' && dynamicStyles.categoryTabActive
          ]}
          onPress={() => setPersonFilter('gesucht')}
        >
          <Text style={[
            dynamicStyles.categoryTabText,
            personFilter === 'gesucht' && dynamicStyles.categoryTabTextActive
          ]}>
            🔍 Gesuchte ({personStats.wanted_persons})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            dynamicStyles.categoryTab,
            personFilter === 'gefunden' && dynamicStyles.categoryTabActive
          ]}
          onPress={() => setPersonFilter('gefunden')}
        >
          <Text style={[
            dynamicStyles.categoryTabText,
            personFilter === 'gefunden' && dynamicStyles.categoryTabTextActive
          ]}>
            ✅ Gefundene ({personStats.found_persons})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            dynamicStyles.categoryTab,
            personFilter === 'erledigt' && dynamicStyles.categoryTabActive
          ]}
          onPress={() => setPersonFilter('erledigt')}
        >
          <Text style={[
            dynamicStyles.categoryTabText,
            personFilter === 'erledigt' && dynamicStyles.categoryTabTextActive
          ]}>
            ✔️ Erledigt ({personStats.completed_persons || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Field */}
      <View style={dynamicStyles.searchContainer}>
        <View style={dynamicStyles.searchInputContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} style={dynamicStyles.searchIcon} />
          <TextInput
            style={dynamicStyles.searchInput}
            placeholder="Person suchen..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={dynamicStyles.clearSearchButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Add Person Button */}
      <TouchableOpacity
        style={[dynamicStyles.actionButton, { backgroundColor: colors.primary }]}
        onPress={createNewPerson}
      >
        <Ionicons name="person-add" size={20} color="#FFFFFF" />
        <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
          Person hinzufügen
        </Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {databaseLoading ? (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={dynamicStyles.loadingText}>Lade Personen...</Text>
          </View>
        ) : (
          <>
            {(() => {
              // Filter persons based on category and search query
              let filteredPersons = persons;
              
              // First filter by category
              if (personFilter !== 'all') {
                filteredPersons = filteredPersons.filter(person => {
                  switch (personFilter) {
                    case 'vermisst':
                      return person.status === 'vermisst';
                    case 'gesucht':
                      return person.status === 'gesucht';
                    case 'gefunden':
                      return person.status === 'gefunden';
                    case 'erledigt':
                      return person.status === 'erledigt';
                    default:
                      return true;
                  }
                });
              }
              
              // Then filter by search query
              if (searchQuery.trim()) {
                filteredPersons = filteredPersons.filter(person => {
                  const fullName = `${person.first_name} ${person.last_name}`.toLowerCase();
                  const query = searchQuery.toLowerCase().trim();
                  return fullName.includes(query) || 
                         person.first_name.toLowerCase().includes(query) ||
                         person.last_name.toLowerCase().includes(query) ||
                         (person.case_number && person.case_number.toLowerCase().includes(query));
                });
              }

              return filteredPersons.length === 0 ? (
                <View style={dynamicStyles.emptyState}>
                  <Ionicons name={searchQuery ? "search-outline" : "people-outline"} size={64} color={colors.textMuted} />
                  <Text style={dynamicStyles.emptyStateText}>
                    {searchQuery 
                      ? `Keine Personen gefunden für "${searchQuery}"` 
                      : personFilter !== 'all'
                        ? `Keine ${personFilter === 'vermisst' ? 'vermissten' : personFilter === 'gesucht' ? 'gesuchten' : 'gefundenen'} Personen`
                        : "Keine Personen in der Datenbank"
                    }
                  </Text>
                  <Text style={dynamicStyles.emptyStateSubtext}>
                    {searchQuery 
                      ? "Versuchen Sie eine andere Suchanfrage"
                      : personFilter !== 'all'
                        ? "Wählen Sie eine andere Kategorie oder fügen Sie neue Personen hinzu"
                        : "Fügen Sie neue Personen hinzu, um sie zu verwalten"
                    }
                  </Text>
                </View>
              ) : (
                filteredPersons.map((person) => (
                <TouchableOpacity
                  key={person.id}
                  style={[
                    dynamicStyles.personCard,
                    {
                      borderLeftColor: person.status === 'vermisst' ? colors.warning :
                                     person.status === 'gesucht' ? colors.error :
                                     person.status === 'gefunden' ? colors.success : colors.primary
                    }
                  ]}
                  onPress={() => {
                    setSelectedPerson(person);
                    setShowPersonDetailModal(true);
                  }}
                >
                  <View style={dynamicStyles.personInfo}>
                    <Text style={dynamicStyles.personName}>
                      👤 {person.first_name} {person.last_name}
                    </Text>
                    <Text style={dynamicStyles.personDetails}>
                      🏠 {person.address || 'Keine Adresse'}
                      {person.age && ` • 🎂 ${person.age} Jahre`}
                    </Text>
                    <Text style={[
                      dynamicStyles.personStatus,
                      {
                        color: person.status === 'vermisst' ? colors.warning :
                               person.status === 'gesucht' ? colors.error :
                               person.status === 'gefunden' ? colors.success : colors.primary
                      }
                    ]}>
                      📊 Status: {person.status === 'vermisst' ? '⚠️ Vermisst' :
                                  person.status === 'gesucht' ? '🚨 Gesucht' :
                                  person.status === 'gefunden' ? '✅ Gefunden' :
                                  '📋 ' + (person.status || 'Unbekannt')}
                    </Text>
                    {person.case_number && (
                      <Text style={dynamicStyles.personCase}>
                        🆔 Fall: #{person.case_number}
                      </Text>
                    )}
                  </View>
                  {user?.role === 'admin' && (
                    <View style={dynamicStyles.personActions}>
                      <TouchableOpacity
                        style={dynamicStyles.editButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          editPerson(person);
                        }}
                      >
                        <Ionicons name="create" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={dynamicStyles.deletePersonButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          // Web-kompatible Bestätigung
                          if (window.confirm(`🗑️ Person archivieren\n\n${person.first_name} ${person.last_name} wirklich archivieren?`)) {
                            deletePerson(person.id, `${person.first_name} ${person.last_name}`);
                          }
                        }}
                      >
                        <Ionicons name="archive" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
                ))
              );
            })()}
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );

  const renderIncidentsDetailScreen = () => (
    <View style={dynamicStyles.content}>
      <View style={dynamicStyles.modalHeader}>
        <TouchableOpacity onPress={() => setShowIncidentsScreen(false)}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={dynamicStyles.modalTitle}>🚨 Vorfälle-Verwaltung</Text>
        <TouchableOpacity onPress={() => {
          loadAllIncidents();
        }}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {incidentsLoading ? (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={dynamicStyles.loadingText}>Lade alle Vorfälle...</Text>
          </View>
        ) : (
          <>
            {incidents.length === 0 ? (
              <View style={dynamicStyles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
                <Text style={dynamicStyles.emptyStateText}>Keine aktuellen Vorfälle</Text>
                <Text style={dynamicStyles.emptyStateSubtext}>
                  Alle Vorfälle sind bearbeitet oder es gibt keine neuen Meldungen
                </Text>
              </View>
            ) : (
              incidents.map((incident) => (
                <TouchableOpacity 
                  key={incident.id}
                  style={[
                    dynamicStyles.incidentDetailCard,
                    {
                      borderLeftColor: incident.priority === 'high' ? colors.error :
                                     incident.priority === 'medium' ? colors.warning :
                                     colors.success
                    }
                  ]}
                  onPress={() => {
                    setSelectedIncident(incident);
                    setShowIncidentDetailModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    dynamicStyles.incidentIcon, 
                    { backgroundColor: (incident.priority === 'high' ? colors.error :
                                      incident.priority === 'medium' ? colors.warning :
                                      colors.success) + '20' }
                  ]}>
                    <Ionicons 
                      name={incident.priority === 'high' ? "alert-circle" : 
                            incident.priority === 'medium' ? "warning" : "information-circle"} 
                      size={28} 
                      color={incident.priority === 'high' ? colors.error :
                             incident.priority === 'medium' ? colors.warning :
                             colors.success} 
                    />
                  </View>
                  
                  <View style={dynamicStyles.incidentContent}>
                    <Text style={dynamicStyles.incidentDetailTitle}>{incident.title}</Text>
                    <Text style={dynamicStyles.incidentDescription} numberOfLines={2}>
                      {incident.description}
                    </Text>
                    <Text style={dynamicStyles.incidentTime}>
                      🕒 {new Date(incident.created_at).toLocaleString('de-DE')}
                    </Text>
                    <Text style={dynamicStyles.incidentLocation}>
                      📍 {incident.address}
                    </Text>
                    <View style={dynamicStyles.incidentStatusRow}>
                      <Text style={[
                        dynamicStyles.incidentStatusBadge,
                        { 
                          backgroundColor: incident.status === 'open' ? colors.error + '20' : 
                                         incident.status === 'in_progress' ? colors.warning + '20' : 
                                         colors.success + '20',
                          color: incident.status === 'open' ? colors.error : 
                                incident.status === 'in_progress' ? colors.warning : 
                                colors.success,
                          borderColor: incident.status === 'open' ? colors.error : 
                                      incident.status === 'in_progress' ? colors.warning : 
                                      colors.success
                        }
                      ]}>
                        {incident.status === 'open' ? '🔴 Offen' : 
                         incident.status === 'in_progress' ? '🟡 In Bearbeitung' : 
                         '🟢 Abgeschlossen'}
                      </Text>
                      <Text style={[
                        dynamicStyles.incidentPriorityBadge,
                        {
                          backgroundColor: incident.priority === 'high' ? colors.error + '15' :
                                         incident.priority === 'medium' ? colors.warning + '15' :
                                         colors.success + '15',
                          color: incident.priority === 'high' ? colors.error :
                                incident.priority === 'medium' ? colors.warning :
                                colors.success
                        }
                      ]}>
                        {incident.priority === 'high' ? '🔴 HOCH' : 
                         incident.priority === 'medium' ? '🟡 MITTEL' : 
                         '🟢 NIEDRIG'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Incident Action Buttons */}
                  <View style={dynamicStyles.incidentActions}>
                    {/* Karten/Auge-Button komplett entfernt */}
                    <TouchableOpacity
                      style={[dynamicStyles.incidentActionBtn, { backgroundColor: colors.success }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`✅ Vorfall abschließen\n\n"${incident.title}" abschließen?`)) {
                          completeIncident(incident.id, incident.title);
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                    {user?.role === 'admin' && (
                      <TouchableOpacity
                        style={[dynamicStyles.incidentActionBtn, { backgroundColor: colors.error }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`🗑️ Vorfall löschen\n\n"${incident.title}" wirklich löschen?`)) {
                            deleteIncident(incident.id, incident.title);
                          }
                        }}
                      >
                        <Ionicons name="trash" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );

  const renderContent = () => {
    // Show incidents detail screen if requested
    if (showIncidentsScreen) {
      return renderIncidentsDetailScreen();
    }

    switch (activeTab) {
      case 'home': return renderHomeScreen();
      case 'messages': return renderChatScreen();
      case 'report': return (
        <View style={dynamicStyles.content}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>📝 Vorfall melden</Text>
            <Text style={dynamicStyles.subtitle}>Neuen Sicherheitsvorfall erfassen</Text>
          </View>

          <ScrollView 
            style={dynamicStyles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={dynamicStyles.formContainer}>
              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>
                  🚨 Vorfall-Titel *
                </Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={incidentFormData.title}
                  onChangeText={(text) => setIncidentFormData(prev => ({ ...prev, title: text }))}
                  placeholder="Kurze Beschreibung des Vorfalls"
                  placeholderTextColor={colors.textMuted}
                  maxLength={100}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>
                  📝 Beschreibung *
                </Text>
                <TextInput
                  style={[dynamicStyles.formInput, dynamicStyles.textArea]}
                  value={incidentFormData.description}
                  onChangeText={(text) => setIncidentFormData(prev => ({ ...prev, description: text }))}
                  placeholder="Detaillierte Beschreibung des Vorfalls"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>
                  📍 Standort *
                </Text>
                <View style={dynamicStyles.locationInputContainer}>
                  <TextInput
                    style={[dynamicStyles.formInput, { flex: 1, marginRight: 8 }]}
                    value={incidentFormData.location}
                    onChangeText={(text) => setIncidentFormData(prev => ({ ...prev, location: text }))}
                    placeholder="Adresse oder Ort des Vorfalls"
                    placeholderTextColor={colors.textMuted}
                    maxLength={200}
                  />
                  <TouchableOpacity 
                    style={dynamicStyles.gpsButton}
                    onPress={useCurrentLocationForIncident}
                  >
                    <Ionicons name="location" size={20} color="#FFFFFF" />
                    <Text style={dynamicStyles.gpsButtonText}>GPS</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>
                  ⚠️ Priorität
                </Text>
                <View style={dynamicStyles.priorityContainer}>
                  {[
                    { value: 'low', label: '🟢 Niedrig', color: colors.success },
                    { value: 'medium', label: '🟡 Mittel', color: colors.warning },
                    { value: 'high', label: '🔴 Hoch', color: colors.error }
                  ].map(priority => (
                    <TouchableOpacity 
                      key={priority.value}
                      style={[
                        dynamicStyles.priorityButton,
                        incidentFormData.priority === priority.value && { 
                          backgroundColor: priority.color + '20',
                          borderColor: priority.color 
                        }
                      ]}
                      onPress={() => setIncidentFormData(prev => ({ ...prev, priority: priority.value }))}
                    >
                      <Text style={[
                        dynamicStyles.priorityButtonText,
                        incidentFormData.priority === priority.value && { color: priority.color }
                      ]}>
                        {priority.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Optional Photo Upload Section */}
              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📸 Foto (optional)</Text>
                <Text style={dynamicStyles.formHint}>Fügen Sie ein Bild hinzu, um den Vorfall zu dokumentieren</Text>
                <View style={dynamicStyles.photoUploadContainer}>
                  {incidentFormData.photo ? (
                    <TouchableOpacity 
                      style={dynamicStyles.photoPreview}
                      onPress={() => {
                        Alert.alert(
                          '📸 Foto ändern',
                          'Möchten Sie das Foto ändern oder entfernen?',
                          [
                            { text: 'Abbrechen', style: 'cancel' },
                            { 
                              text: 'Entfernen', 
                              style: 'destructive',
                              onPress: () => setIncidentFormData(prev => ({ ...prev, photo: '' }))
                            },
                            { text: 'Neues Foto', onPress: pickImageForIncident }
                          ]
                        );
                      }}
                    >
                      <Image 
                        source={{ uri: incidentFormData.photo }} 
                        style={dynamicStyles.incidentPhotoPreview}
                      />
                      <View style={dynamicStyles.photoOverlay}>
                        <Ionicons name="camera" size={20} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={dynamicStyles.photoUploadButtons}>
                      <TouchableOpacity 
                        style={[dynamicStyles.photoButton, { backgroundColor: colors.primary }]}
                        onPress={pickImageForIncident}
                      >
                        <Ionicons name="images" size={20} color="#FFFFFF" />
                        <Text style={dynamicStyles.photoButtonText}>Galerie</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[dynamicStyles.photoButton, { backgroundColor: colors.secondary }]}
                        onPress={takePhotoForIncident}
                      >
                        <Ionicons name="camera" size={20} color="#FFFFFF" />
                        <Text style={dynamicStyles.photoButtonText}>Kamera</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity 
                style={[dynamicStyles.submitButton, submittingIncident && dynamicStyles.submitButtonDisabled]}
                onPress={submitIncident}
                disabled={submittingIncident}
              >
                {submittingIncident ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                    <Text style={dynamicStyles.submitButtonText}>Vorfall melden</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={dynamicStyles.submitNote}>
                💡 Alle mit * markierten Felder sind Pflichtfelder.
              </Text>
            </View>
          </ScrollView>
        </View>
      );
      case 'berichte': return renderBerichteScreen();
      case 'team': return renderTeamScreen();
      case 'myteam': return renderMyTeamScreen();
      case 'database': return renderDatabaseScreen();
      case 'admin': return renderAdminScreen();
      default: return renderHomeScreen();
    }
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={colors.background} 
      />
      
      {renderContent()}

      {/* Modern Tab Navigation */}
      <View style={dynamicStyles.tabBar}>
        <TouchableOpacity 
          style={[dynamicStyles.tabItem, activeTab === 'home' && dynamicStyles.tabItemActive]}
          onPress={() => setActiveTab('home')}
        >
          <Ionicons 
            name={activeTab === 'home' ? 'home' : 'home-outline'} 
            size={24} 
            color={activeTab === 'home' ? '#FFFFFF' : colors.textMuted} 
          />
          <Text style={[dynamicStyles.tabLabel, activeTab === 'home' && dynamicStyles.tabLabelActive]}>
            Übersicht
          </Text>
        </TouchableOpacity>
        
        {/* Nachrichten Tab komplett entfernt */}
        
        <TouchableOpacity 
          style={[dynamicStyles.tabItem, activeTab === 'report' && dynamicStyles.tabItemActive]}
          onPress={() => setActiveTab('report')}
        >
          <Ionicons 
            name={activeTab === 'report' ? 'alert-circle' : 'alert-circle-outline'} 
            size={24} 
            color={activeTab === 'report' ? '#FFFFFF' : colors.textMuted} 
          />
          <Text style={[dynamicStyles.tabLabel, activeTab === 'report' && dynamicStyles.tabLabelActive]}>
            Melden
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[dynamicStyles.tabItem, activeTab === 'berichte' && dynamicStyles.tabItemActive]}
          onPress={() => setActiveTab('berichte')}
        >
          <Ionicons 
            name={activeTab === 'berichte' ? 'document-text' : 'document-text-outline'} 
            size={24} 
            color={activeTab === 'berichte' ? '#FFFFFF' : colors.textMuted} 
          />
          <Text style={[dynamicStyles.tabLabel, activeTab === 'berichte' && dynamicStyles.tabLabelActive]}>
            Berichte
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[dynamicStyles.tabItem, activeTab === 'database' && dynamicStyles.tabItemActive]}
          onPress={() => setActiveTab('database')}
        >
          <Ionicons 
            name={activeTab === 'database' ? 'library' : 'library-outline'} 
            size={24} 
            color={activeTab === 'database' ? '#FFFFFF' : colors.textMuted} 
          />
          <Text style={[dynamicStyles.tabLabel, activeTab === 'database' && dynamicStyles.tabLabelActive]}>
            Datenbank
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[dynamicStyles.tabItem, activeTab === 'team' && dynamicStyles.tabItemActive]}
          onPress={() => setActiveTab('team')}
        >
          <Ionicons 
            name={activeTab === 'team' ? 'people' : 'people-outline'} 
            size={24} 
            color={activeTab === 'team' ? '#FFFFFF' : colors.textMuted} 
          />
          <Text style={[dynamicStyles.tabLabel, activeTab === 'team' && dynamicStyles.tabLabelActive]}>
            Team
          </Text>
        </TouchableOpacity>

        {/* Admin Tab - Only visible for admins */}
        {user?.role === 'admin' && (
          <TouchableOpacity 
            style={[dynamicStyles.tabItem, activeTab === 'admin' && dynamicStyles.tabItemActive]}
            onPress={() => setActiveTab('admin')}
          >
            <Ionicons 
              name={activeTab === 'admin' ? 'settings' : 'settings-outline'} 
              size={24} 
              color={activeTab === 'admin' ? '#FFFFFF' : colors.textMuted} 
            />
            <Text style={[dynamicStyles.tabLabel, activeTab === 'admin' && dynamicStyles.tabLabelActive]}>
              Admin
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Profile Modal mit Dark/Light Mode */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.profileModalHeader}>
            <TouchableOpacity 
              style={dynamicStyles.profileCloseButton}
              onPress={() => setShowProfileModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
            
            <View style={dynamicStyles.profileHeaderContent}>
              <View style={dynamicStyles.profileIconContainer}>
                <Ionicons name="person-circle" size={48} color={colors.primary} />
              </View>
              <View style={dynamicStyles.profileTitleContainer}>
                <Text style={dynamicStyles.profileModalTitle}>Profil bearbeiten</Text>
                <Text style={dynamicStyles.profileModalSubtitle}>{user?.username} • {user?.role}</Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={dynamicStyles.profileSaveButton}
              onPress={saveProfile}
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={dynamicStyles.profileSaveButtonText}>Speichern</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={dynamicStyles.modalContent} showsVerticalScrollIndicator={false}>
            
            {/* Profile Photo Upload */}
            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>📸 Profilbild</Text>
              <View style={dynamicStyles.photoUploadContainer}>
                {profileData.photo ? (
                  <TouchableOpacity 
                    style={dynamicStyles.photoPreview}
                    onPress={() => {
                      Alert.alert(
                        '📸 Profilbild ändern',
                        'Möchten Sie das Profilbild ändern oder entfernen?',
                        [
                          { text: 'Abbrechen', style: 'cancel' },
                          { 
                            text: 'Entfernen', 
                            style: 'destructive',
                            onPress: () => setProfileData({...profileData, photo: ''})
                          },
                          { text: 'Neues Foto', onPress: async () => {
                            const photo = await pickImageForUser();
                            if (photo) setProfileData({...profileData, photo});
                          }}
                        ]
                      );
                    }}
                  >
                    <Image 
                      source={{ uri: profileData.photo }} 
                      style={dynamicStyles.profilePhotoPreview}
                    />
                    <View style={dynamicStyles.photoOverlay}>
                      <Ionicons name="camera" size={20} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={dynamicStyles.photoUploadButtons}>
                    <TouchableOpacity 
                      style={[dynamicStyles.photoButton, { backgroundColor: colors.primary }]}
                      onPress={async () => {
                        const photo = await pickImageForUser();
                        if (photo) setProfileData({...profileData, photo});
                      }}
                    >
                      <Ionicons name="images" size={20} color="#FFFFFF" />
                      <Text style={dynamicStyles.photoButtonText}>Galerie</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[dynamicStyles.photoButton, { backgroundColor: colors.secondary }]}
                      onPress={async () => {
                        const photo = await takePhotoForUser();
                        if (photo) setProfileData({...profileData, photo});
                      }}
                    >
                      <Ionicons name="camera" size={20} color="#FFFFFF" />
                      <Text style={dynamicStyles.photoButtonText}>Kamera</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>👤 Name</Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={profileData.username}
                onChangeText={(text) => setProfileData({...profileData, username: text})}
                placeholder="Vollständiger Name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>📞 Telefon</Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={profileData.phone}
                onChangeText={(text) => setProfileData({...profileData, phone: text})}
                placeholder="Telefonnummer"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>🆔 Dienstnummer</Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={profileData.service_number}
                onChangeText={(text) => setProfileData({...profileData, service_number: text})}
                placeholder="Dienstnummer"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>🎖️ Rang</Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={profileData.rank}
                onChangeText={(text) => setProfileData({...profileData, rank: text})}
                placeholder="Dienstgrad"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>🏢 Abteilung</Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={profileData.department}
                onChangeText={(text) => setProfileData({...profileData, department: text})}
                placeholder="Abteilung/Revier"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <Text style={dynamicStyles.sectionTitle}>🔄 Dienststatus</Text>
            {['Im Dienst', 'Pause', 'Einsatz', 'Streife', 'Nicht verfügbar'].map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  dynamicStyles.statusOption,
                  userStatus === status && dynamicStyles.statusOptionActive
                ]}
                onPress={() => setUserStatus(status)}
              >
                <View style={[dynamicStyles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                <Text style={[
                  dynamicStyles.statusOptionText,
                  userStatus === status && dynamicStyles.statusOptionTextActive
                ]}>
                  {status}
                </Text>
                {userStatus === status && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}

            {/* Quick Navigation Links */}
            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>🚀 Schnellzugriff</Text>
              <View style={dynamicStyles.quickLinksContainer}>
                <TouchableOpacity 
                  style={dynamicStyles.quickLinkButton}
                  onPress={() => {
                    setShowProfileModal(false);
                    setActiveTab('team');
                  }}
                >
                  <Ionicons name="people" size={20} color={colors.primary} />
                  <Text style={dynamicStyles.quickLinkText}>👥 Team Übersicht</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={dynamicStyles.quickLinkButton}
                  onPress={() => {
                    setShowProfileModal(false);
                    setActiveTab('database');
                  }}
                >
                  <Ionicons name="folder" size={20} color={colors.primary} />
                  <Text style={dynamicStyles.quickLinkText}>📂 Personendatenbank</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={dynamicStyles.quickLinkButton}
                  onPress={() => {
                    setShowProfileModal(false);
                    setActiveTab('berichte');
                  }}
                >
                  <Ionicons name="document-text" size={20} color={colors.primary} />
                  <Text style={dynamicStyles.quickLinkText}>📊 Berichte & Archiv</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={dynamicStyles.quickLinkButton}
                  onPress={() => {
                    setShowProfileModal(false);
                    setActiveTab('report');
                  }}
                >
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                  <Text style={dynamicStyles.quickLinkText}>📝 Vorfall melden</Text>
                </TouchableOpacity>

              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Incident Details Modal mit Karte */}
      <Modal
        visible={showIncidentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowIncidentModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowIncidentModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>Vorfall Details</Text>
            <TouchableOpacity onPress={() => openIncidentMap(selectedIncident)}>
              <Ionicons name="map" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {selectedIncident && (
            <ScrollView style={dynamicStyles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={dynamicStyles.incidentDetailHeader}>
                <Text style={dynamicStyles.incidentDetailTitle}>{selectedIncident.title}</Text>
                <View style={[
                  dynamicStyles.priorityBadge, 
                  { backgroundColor: getPriorityColor(selectedIncident.priority) }
                ]}>
                  <Text style={dynamicStyles.priorityBadgeText}>
                    {selectedIncident.priority === 'high' ? '🚨 HOCH' : 
                     selectedIncident.priority === 'medium' ? '⚠️ MITTEL' : 
                     '✅ NIEDRIG'}
                  </Text>
                </View>
              </View>

              <View style={dynamicStyles.detailSection}>
                <Text style={dynamicStyles.detailLabel}>📝 Beschreibung:</Text>
                <Text style={dynamicStyles.detailText}>{selectedIncident.description}</Text>
              </View>

              <View style={dynamicStyles.detailSection}>
                <Text style={dynamicStyles.detailLabel}>📍 Ort:</Text>
                <Text style={dynamicStyles.detailText}>{selectedIncident.address}</Text>
              </View>

              <View style={dynamicStyles.detailSection}>
                <Text style={dynamicStyles.detailLabel}>🕒 Gemeldet:</Text>
                <Text style={dynamicStyles.detailText}>
                  {new Date(selectedIncident.created_at).toLocaleString('de-DE')}
                </Text>
              </View>

              <View style={dynamicStyles.actionButtons}>
                {/* Karten-Button komplett entfernt */}

                {(!selectedIncident.assigned_to || selectedIncident.assigned_to === user?.id) && (
                  <TouchableOpacity style={dynamicStyles.takeButton} onPress={takeIncident}>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={dynamicStyles.takeButtonText}>✋ Vorfall übernehmen</Text>
                  </TouchableOpacity>
                )}
                
                {selectedIncident.assigned_to === user?.id && (
                  <TouchableOpacity style={dynamicStyles.completeButton} onPress={completeSelectedIncident}>
                    <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                    <Text style={dynamicStyles.completeButtonText}>✅ Erledigt</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Map Modal */}
      <IncidentMapModal
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        incident={selectedIncident}
      />

      {/* Professional Report Writing/Editing Modal - Same Style as Incident */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReportModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.profileModalHeader}>
            <TouchableOpacity 
              style={dynamicStyles.profileCloseButton}
              onPress={() => setShowReportModal(false)}
            >
              <Ionicons name="arrow-back" size={24} color={colors.textMuted} />
            </TouchableOpacity>
            
            <View style={dynamicStyles.profileHeaderContent}>
              <View style={dynamicStyles.profileIconContainer}>
                <Ionicons name="document-text" size={32} color={colors.primary} />
              </View>
              <Text style={dynamicStyles.profileTitle}>📝 Bericht erstellen</Text>
              <Text style={dynamicStyles.profileSubtitle}>
                {editingReport ? 'Bericht bearbeiten und aktualisieren' : 'Neuen Tagesbericht erfassen'}
              </Text>
            </View>
          </View>

          <ScrollView 
            style={dynamicStyles.profileContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={dynamicStyles.formContainer}>

          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
              {/* Report Title - Same as Incident */}
              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>
                  📋 Bericht-Titel *
                </Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={reportFormData.title}
                  onChangeText={(text) => setReportFormData({...reportFormData, title: text})}
                  placeholder="z.B. Schichtbericht 13.09.2024"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Report Content - Same styling as Incident description */}
              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>
                  📝 Bericht-Inhalt *
                </Text>
                <TextInput
                  style={[dynamicStyles.formInput, dynamicStyles.textArea]}
                  value={reportFormData.content}
                  onChangeText={(text) => setReportFormData({...reportFormData, content: text})}
                  placeholder={`Schreiben Sie hier Ihren detaillierten Bericht...

Beispielinhalt:
• Schichtzeit von - bis
• Besondere Vorkommnisse
• Durchgeführte Patrouillen
• Wichtige Beobachtungen
• Sicherheitsrelevante Ereignisse`}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={15}
                  textAlignVertical="top"
                />
              </View>

              {/* Optional Photo Upload Section - Same as Incident */}
              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📸 Foto (optional)</Text>
                <Text style={dynamicStyles.formHint}>Fügen Sie Bilder zur Dokumentation hinzu</Text>
                <View style={dynamicStyles.photoUploadContainer}>
                  {reportFormData.images && reportFormData.images.length > 0 ? (
                    <TouchableOpacity 
                      style={dynamicStyles.photoPreview}
                      onPress={() => {
                        Alert.alert(
                          '📸 Foto ändern',
                          'Möchten Sie das Foto ändern oder entfernen?',
                          [
                            { text: 'Abbrechen', style: 'cancel' },
                            { 
                              text: 'Entfernen', 
                              style: 'destructive',
                              onPress: () => setReportFormData(prev => ({ ...prev, images: [] }))
                            },
                            { text: 'Neues Foto', onPress: async () => {
                              const photo = await pickImageForIncident();
                              if (photo) setReportFormData(prev => ({ ...prev, images: [photo] }));
                            }}
                          ]
                        );
                      }}
                    >
                      <Image 
                        source={{ uri: reportFormData.images[0] }} 
                        style={dynamicStyles.incidentPhotoPreview}
                      />
                      <View style={dynamicStyles.photoOverlay}>
                        <Ionicons name="camera" size={20} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={dynamicStyles.photoUploadButtons}>
                      <TouchableOpacity 
                        style={[dynamicStyles.photoButton, { backgroundColor: colors.primary }]}
                        onPress={async () => {
                          const photo = await pickImageForIncident();
                          if (photo) setReportFormData(prev => ({ ...prev, images: [photo] }));
                        }}
                      >
                        <Ionicons name="images" size={20} color="#FFFFFF" />
                        <Text style={dynamicStyles.photoButtonText}>Galerie</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[dynamicStyles.photoButton, { backgroundColor: colors.secondary }]}
                        onPress={async () => {
                          const photo = await takePhotoForIncident();
                          if (photo) setReportFormData(prev => ({ ...prev, images: [photo] }));
                        }}
                      >
                        <Ionicons name="camera" size={20} color="#FFFFFF" />
                        <Text style={dynamicStyles.photoButtonText}>Kamera</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* Submit Button - Same as Incident */}
              <TouchableOpacity 
                style={[dynamicStyles.submitButton, (savingReport || !reportFormData.title.trim() || !reportFormData.content.trim()) && dynamicStyles.submitButtonDisabled]}
                onPress={saveReport}
                disabled={savingReport || !reportFormData.title.trim() || !reportFormData.content.trim()}
              >
                {savingReport ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                )}
                <Text style={dynamicStyles.submitButtonText}>
                  {savingReport ? 'Speichert...' : (editingReport ? 'Bericht aktualisieren' : 'Bericht erstellen')}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </KeyboardAvoidingView>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add User Modal */}
      <AddUserModal
        visible={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onUserAdded={() => {
          setShowAddUserModal(false);
          loadData();
          if (activeTab === 'team') {
            loadUsersByStatus();
          }
        }}
        token={token}
        theme={{ colors, isDarkMode }}
      />

      {/* Admin Settings Modal */}
      <Modal
        visible={showAdminSettingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAdminSettingsModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={dynamicStyles.modalOverlay}>
            <View style={[dynamicStyles.modalContainer, dynamicStyles.adminSettingsContainer]}>
              <View style={dynamicStyles.adminSettingsHeader}>
                <TouchableOpacity 
                  style={dynamicStyles.profileCloseButton}
                  onPress={() => setShowAdminSettingsModal(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
                
                <View style={dynamicStyles.adminHeaderContent}>
                  <View style={dynamicStyles.adminIconContainer}>
                    <Ionicons name="settings" size={48} color={colors.primary} />
                  </View>
                  <View style={dynamicStyles.adminTitleContainer}>
                    <Text style={dynamicStyles.adminModalTitle}>Admin Einstellungen</Text>
                    <Text style={dynamicStyles.adminModalSubtitle}>App-Konfiguration verwalten</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={dynamicStyles.adminSaveButton}
                  onPress={saveAdminSettings}
                >
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={dynamicStyles.adminSaveButtonText}>Speichern</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={dynamicStyles.modalContent} showsVerticalScrollIndicator={false}>
                
                {/* Current Configuration Display */}
                <View style={dynamicStyles.formGroup}>
                  <Text style={dynamicStyles.formLabel}>📱 Aktuelle Konfiguration</Text>
                  <View style={dynamicStyles.currentConfigContainer}>
                    <Text style={dynamicStyles.configText}>📛 {appConfig.app_name}</Text>
                    <Text style={dynamicStyles.configText}>📝 {appConfig.app_subtitle}</Text>
                    <Text style={dynamicStyles.configText}>🏢 {appConfig.organization_name}</Text>
                  </View>
                </View>

                {/* App Icon Upload */}
                <View style={dynamicStyles.formGroup}>
                  <Text style={dynamicStyles.formLabel}>🎨 App-Icon</Text>
                  <View style={dynamicStyles.photoUploadContainer}>
                    {adminSettingsData.app_icon ? (
                      <TouchableOpacity 
                        style={dynamicStyles.iconPreview}
                        onPress={() => {
                          Alert.alert(
                            '🎨 App-Icon ändern',
                            'Möchten Sie das App-Icon ändern oder entfernen?',
                            [
                              { text: 'Abbrechen', style: 'cancel' },
                              { 
                                text: 'Entfernen', 
                                style: 'destructive',
                                onPress: () => setAdminSettingsData(prev => ({...prev, app_icon: ''}))
                              },
                              { text: 'Neues Icon', onPress: pickIconForApp }
                            ]
                          );
                        }}
                      >
                        <Image 
                          source={{ uri: adminSettingsData.app_icon }} 
                          style={dynamicStyles.iconPreviewImage}
                        />
                        <View style={dynamicStyles.photoOverlay}>
                          <Ionicons name="camera" size={20} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={dynamicStyles.iconUploadButton}
                        onPress={pickIconForApp}
                      >
                        <Ionicons name="image" size={32} color={colors.primary} />
                        <Text style={dynamicStyles.iconUploadText}>App-Icon auswählen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* App Name */}
                <View style={dynamicStyles.formGroup}>
                  <Text style={dynamicStyles.formLabel}>📛 App-Name</Text>
                  <TextInput
                    style={dynamicStyles.formInput}
                    value={adminSettingsData.app_name}
                    onChangeText={(text) => setAdminSettingsData(prev => ({...prev, app_name: text}))}
                    placeholder={appConfig.app_name}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* App Subtitle */}
                <View style={dynamicStyles.formGroup}>
                  <Text style={dynamicStyles.formLabel}>📝 App-Untertitel</Text>
                  <TextInput
                    style={dynamicStyles.formInput}
                    value={adminSettingsData.app_subtitle}
                    onChangeText={(text) => setAdminSettingsData(prev => ({...prev, app_subtitle: text}))}
                    placeholder={appConfig.app_subtitle}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Organization Name */}
                <View style={dynamicStyles.formGroup}>
                  <Text style={dynamicStyles.formLabel}>🏢 Organisation</Text>
                  <TextInput
                    style={dynamicStyles.formInput}
                    value={adminSettingsData.organization_name}
                    onChangeText={(text) => setAdminSettingsData(prev => ({...prev, organization_name: text}))}
                    placeholder={appConfig.organization_name}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Person Modal - Personendatenbank */}
      <Modal
        visible={showPersonModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPersonModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPersonModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>
              {editingPerson ? '✏️ Person bearbeiten' : '👤 Person hinzufügen'}
            </Text>
            <TouchableOpacity 
              onPress={savePerson}
              disabled={savingPerson}
            >
              {savingPerson ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={dynamicStyles.saveButtonText}>Speichern</Text>
              )}
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView style={dynamicStyles.modalContent} showsVerticalScrollIndicator={false}>
              
              {/* Photo Upload Section */}
              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📸 Foto der Person</Text>
                <View style={dynamicStyles.photoUploadContainer}>
                  {personFormData.photo ? (
                    <TouchableOpacity 
                      style={dynamicStyles.photoPreview}
                      onPress={() => {
                        Alert.alert(
                          '📸 Foto ändern',
                          'Möchten Sie das Foto ändern oder entfernen?',
                          [
                            { text: 'Abbrechen', style: 'cancel' },
                            { 
                              text: 'Entfernen', 
                              style: 'destructive',
                              onPress: () => setPersonFormData({...personFormData, photo: ''})
                            },
                            { text: 'Neues Foto', onPress: pickImageForPerson }
                          ]
                        );
                      }}
                    >
                      <Image 
                        source={{ uri: personFormData.photo }} 
                        style={dynamicStyles.photoPreviewImage}
                      />
                      <View style={dynamicStyles.photoOverlay}>
                        <Ionicons name="camera" size={20} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={dynamicStyles.photoUploadButtons}>
                      <TouchableOpacity 
                        style={[dynamicStyles.photoButton, { backgroundColor: colors.primary }]}
                        onPress={pickImageForPerson}
                      >
                        <Ionicons name="images" size={20} color="#FFFFFF" />
                        <Text style={dynamicStyles.photoButtonText}>Galerie</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[dynamicStyles.photoButton, { backgroundColor: colors.secondary }]}
                        onPress={takePhotoForPerson}
                      >
                        <Ionicons name="camera" size={20} color="#FFFFFF" />
                        <Text style={dynamicStyles.photoButtonText}>Kamera</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>👤 Vorname *</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={personFormData.first_name}
                  onChangeText={(text) => setPersonFormData({...personFormData, first_name: text})}
                  placeholder="Vorname"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>👤 Nachname *</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={personFormData.last_name}
                  onChangeText={(text) => setPersonFormData({...personFormData, last_name: text})}
                  placeholder="Nachname"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>🏠 Adresse</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={personFormData.address}
                  onChangeText={(text) => setPersonFormData({...personFormData, address: text})}
                  placeholder="Straße, PLZ Ort"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>🎂 Alter</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={personFormData.age}
                  onChangeText={(text) => setPersonFormData({...personFormData, age: text})}
                  placeholder="Alter in Jahren"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📅 Geburtsdatum</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={personFormData.birth_date}
                  onChangeText={(text) => setPersonFormData({...personFormData, birth_date: text})}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📊 Status</Text>
                <View style={dynamicStyles.pickerContainer}>
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.pickerButton, 
                      personFormData.status === 'vermisst' && dynamicStyles.pickerButtonActive
                    ]}
                    onPress={() => setPersonFormData({...personFormData, status: 'vermisst'})}
                  >
                    <Text style={[
                      dynamicStyles.pickerButtonText,
                      personFormData.status === 'vermisst' && dynamicStyles.pickerButtonTextActive
                    ]}>⚠️ Vermisst</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.pickerButton, 
                      personFormData.status === 'gesucht' && dynamicStyles.pickerButtonActive
                    ]}
                    onPress={() => setPersonFormData({...personFormData, status: 'gesucht'})}
                  >
                    <Text style={[
                      dynamicStyles.pickerButtonText,
                      personFormData.status === 'gesucht' && dynamicStyles.pickerButtonTextActive
                    ]}>🚨 Gesucht</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.pickerButton, 
                      personFormData.status === 'gefunden' && dynamicStyles.pickerButtonActive
                    ]}
                    onPress={() => setPersonFormData({...personFormData, status: 'gefunden'})}
                  >
                    <Text style={[
                      dynamicStyles.pickerButtonText,
                      personFormData.status === 'gefunden' && dynamicStyles.pickerButtonTextActive
                    ]}>✅ Gefunden</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📝 Beschreibung</Text>
                <TextInput
                  style={[dynamicStyles.formInput, dynamicStyles.reportTextArea]}
                  value={personFormData.description}
                  onChangeText={(text) => setPersonFormData({...personFormData, description: text})}
                  placeholder="Aussehen, Besonderheiten, weitere Details..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📍 Zuletzt gesehen</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={personFormData.last_seen_location}
                  onChangeText={(text) => setPersonFormData({...personFormData, last_seen_location: text})}
                  placeholder="Ort wo Person zuletzt gesehen wurde"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📅 Datum zuletzt gesehen</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={personFormData.last_seen_date}
                  onChangeText={(text) => setPersonFormData({...personFormData, last_seen_date: text})}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📞 Kontaktinformationen</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={personFormData.contact_info}
                  onChangeText={(text) => setPersonFormData({...personFormData, contact_info: text})}
                  placeholder="Angehörige, Notfallkontakt, etc."
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>🆔 Fallnummer</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={personFormData.case_number}
                  onChangeText={(text) => setPersonFormData({...personFormData, case_number: text})}
                  placeholder="z.B. VM-2024-001"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>⚡ Priorität</Text>
                <View style={dynamicStyles.pickerContainer}>
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.pickerButton, 
                      personFormData.priority === 'low' && dynamicStyles.pickerButtonActive
                    ]}
                    onPress={() => setPersonFormData({...personFormData, priority: 'low'})}
                  >
                    <Text style={[
                      dynamicStyles.pickerButtonText,
                      personFormData.priority === 'low' && dynamicStyles.pickerButtonTextActive
                    ]}>🟢 Niedrig</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.pickerButton, 
                      personFormData.priority === 'medium' && dynamicStyles.pickerButtonActive
                    ]}
                    onPress={() => setPersonFormData({...personFormData, priority: 'medium'})}
                  >
                    <Text style={[
                      dynamicStyles.pickerButtonText,
                      personFormData.priority === 'medium' && dynamicStyles.pickerButtonTextActive
                    ]}>🟡 Mittel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.pickerButton, 
                      personFormData.priority === 'high' && dynamicStyles.pickerButtonActive
                    ]}
                    onPress={() => setPersonFormData({...personFormData, priority: 'high'})}
                  >
                    <Text style={[
                      dynamicStyles.pickerButtonText,
                      personFormData.priority === 'high' && dynamicStyles.pickerButtonTextActive
                    ]}>🔴 Hoch</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Person Detail Modal - Nur lesen */}
      <Modal
        visible={showPersonDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPersonDetailModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPersonDetailModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>
              👤 Person Details
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setShowPersonDetailModal(false);
                editPerson(selectedPerson);
              }}
              style={dynamicStyles.editHeaderButton}
            >
              <Ionicons name="create" size={20} color={colors.primary} />
              <Text style={[dynamicStyles.saveButtonText, { color: colors.primary }]}>Bearbeiten</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={dynamicStyles.modalContent} showsVerticalScrollIndicator={false}>
            {selectedPerson && (
              <>
                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>📋 Grunddaten</Text>
                  
                  {/* Person Photo */}
                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📸 Foto:</Text>
                    <View style={dynamicStyles.photoContainer}>
                      {selectedPerson.photo ? (
                        <TouchableOpacity onPress={() => {
                          // Vollbild anzeigen 
                          Alert.alert('📸 Foto', 'Foto in voller Größe anzeigen', [
                            { text: 'OK' }
                          ]);
                        }}>
                          <Image 
                            source={{ uri: selectedPerson.photo }} 
                            style={dynamicStyles.personPhoto}
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={dynamicStyles.noPhotoContainer}>
                          <Ionicons name="person" size={40} color={colors.textMuted} />
                          <Text style={dynamicStyles.noPhotoText}>Kein Foto</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>👤 Name:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedPerson.first_name} {selectedPerson.last_name}
                    </Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>🏠 Adresse:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedPerson.address || 'Nicht angegeben'}
                    </Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>🎂 Alter:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedPerson.age ? `${selectedPerson.age} Jahre` : 'Nicht angegeben'}
                    </Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📅 Geburtsdatum:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedPerson.birth_date || 'Nicht angegeben'}
                    </Text>
                  </View>
                </View>

                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>📊 Status</Text>
                  
                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>Status:</Text>
                    <View style={[
                      dynamicStyles.statusBadge,
                      {
                        backgroundColor: selectedPerson.status === 'vermisst' ? colors.warning + '20' :
                                       selectedPerson.status === 'gesucht' ? colors.error + '20' :
                                       selectedPerson.status === 'gefunden' ? colors.success + '20' : colors.primary + '20',
                        borderColor: selectedPerson.status === 'vermisst' ? colors.warning :
                                   selectedPerson.status === 'gesucht' ? colors.error :
                                   selectedPerson.status === 'gefunden' ? colors.success : colors.primary
                      }
                    ]}>
                      <Text style={[
                        dynamicStyles.statusBadgeText,
                        {
                          color: selectedPerson.status === 'vermisst' ? colors.warning :
                                 selectedPerson.status === 'gesucht' ? colors.error :
                                 selectedPerson.status === 'gefunden' ? colors.success : colors.primary
                        }
                      ]}>
                        {selectedPerson.status === 'vermisst' ? '⚠️ Vermisst' :
                         selectedPerson.status === 'gesucht' ? '🚨 Gesucht' :
                         selectedPerson.status === 'gefunden' ? '✅ Gefunden' :
                         '📋 ' + (selectedPerson.status || 'Unbekannt')}
                      </Text>
                    </View>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>⚡ Priorität:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedPerson.priority === 'low' ? '🟢 Niedrig' :
                       selectedPerson.priority === 'medium' ? '🟡 Mittel' :
                       selectedPerson.priority === 'high' ? '🔴 Hoch' : 'Mittel'}
                    </Text>
                  </View>

                  {selectedPerson.case_number && (
                    <View style={dynamicStyles.detailRow}>
                      <Text style={dynamicStyles.detailLabel}>🆔 Fallnummer:</Text>
                      <Text style={dynamicStyles.detailValue}>#{selectedPerson.case_number}</Text>
                    </View>
                  )}
                </View>

                {(selectedPerson.last_seen_location || selectedPerson.last_seen_date) && (
                  <View style={dynamicStyles.detailCard}>
                    <Text style={dynamicStyles.detailSectionTitle}>📍 Zuletzt gesehen</Text>
                    
                    {selectedPerson.last_seen_location && (
                      <View style={dynamicStyles.detailRow}>
                        <Text style={dynamicStyles.detailLabel}>📍 Ort:</Text>
                        <Text style={dynamicStyles.detailValue}>{selectedPerson.last_seen_location}</Text>
                      </View>
                    )}

                    {selectedPerson.last_seen_date && (
                      <View style={dynamicStyles.detailRow}>
                        <Text style={dynamicStyles.detailLabel}>📅 Datum:</Text>
                        <Text style={dynamicStyles.detailValue}>{selectedPerson.last_seen_date}</Text>
                      </View>
                    )}
                  </View>
                )}

                {selectedPerson.description && (
                  <View style={dynamicStyles.detailCard}>
                    <Text style={dynamicStyles.detailSectionTitle}>📝 Beschreibung</Text>
                    <Text style={dynamicStyles.detailDescription}>{selectedPerson.description}</Text>
                  </View>
                )}

                {selectedPerson.contact_info && (
                  <View style={dynamicStyles.detailCard}>
                    <Text style={dynamicStyles.detailSectionTitle}>📞 Kontaktinformationen</Text>
                    <Text style={dynamicStyles.detailDescription}>{selectedPerson.contact_info}</Text>
                  </View>
                )}

                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>ℹ️ Fallverwaltung</Text>
                  
                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>👮 Erstellt von:</Text>
                    <Text style={dynamicStyles.detailValue}>{selectedPerson.created_by_name}</Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📅 Erstellt am:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {new Date(selectedPerson.created_at).toLocaleDateString('de-DE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📝 Letzte Änderung:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {new Date(selectedPerson.updated_at).toLocaleDateString('de-DE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>

                {/* Person Actions */}
                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>🎯 Person-Aktionen</Text>
                  
                  {/* Erledigt Button - nur anzeigen wenn nicht bereits erledigt */}
                  {selectedPerson.status !== 'erledigt' && (
                    <TouchableOpacity
                      style={[dynamicStyles.actionButton, { backgroundColor: colors.success, marginBottom: 12 }]}
                      onPress={() => {
                        if (window.confirm(`✅ Person erledigt\n\n"${selectedPerson.first_name} ${selectedPerson.last_name}" als erledigt markieren?`)) {
                          updatePersonStatus(selectedPerson.id, 'erledigt', `${selectedPerson.first_name} ${selectedPerson.last_name}`);
                        }
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
                        ✅ Als erledigt markieren
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Status Ändern Buttons */}
                  {selectedPerson.status !== 'gefunden' && (
                    <TouchableOpacity
                      style={[dynamicStyles.actionButton, { backgroundColor: colors.primary, marginBottom: 12 }]}
                      onPress={() => {
                        if (window.confirm(`✅ Person gefunden\n\n"${selectedPerson.first_name} ${selectedPerson.last_name}" als gefunden markieren?`)) {
                          updatePersonStatus(selectedPerson.id, 'gefunden', `${selectedPerson.first_name} ${selectedPerson.last_name}`);
                        }
                      }}
                    >
                      <Ionicons name="location" size={20} color="#FFFFFF" />
                      <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
                        ✅ Als gefunden markieren
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ height: 40 }} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Incident Map Modal */}
      <IncidentMapModal 
        visible={showIncidentMap}
        incident={selectedIncident}
        onClose={() => setShowIncidentMap(false)}
      />

      {/* Incident Detail Modal */}
      <Modal
        visible={showIncidentDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowIncidentDetailModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowIncidentDetailModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>🚨 Vorfall Details</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={dynamicStyles.modalContent}>
            {selectedIncident && (
              <>
                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>📋 Vorfall-Information</Text>
                  
                  {/* Incident Photo */}
                  {selectedIncident.images && selectedIncident.images.length > 0 && (
                    <View style={dynamicStyles.detailRow}>
                      <Text style={dynamicStyles.detailLabel}>📸 Foto:</Text>
                      <View style={dynamicStyles.photoContainer}>
                        <TouchableOpacity onPress={() => {
                          Alert.alert('📸 Vorfall-Foto', 'Foto des Vorfalls in voller Größe', [
                            { text: 'OK' }
                          ]);
                        }}>
                          <Image 
                            source={{ uri: selectedIncident.images[0] }} 
                            style={dynamicStyles.incidentDetailPhoto}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>🚨 Titel:</Text>
                    <Text style={dynamicStyles.detailValue}>{selectedIncident.title}</Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📝 Beschreibung:</Text>
                    <Text style={dynamicStyles.detailDescription}>{selectedIncident.description}</Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📍 Adresse:</Text>
                    <Text style={dynamicStyles.detailValue}>{selectedIncident.address}</Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>🕒 Gemeldet:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedIncident.created_at ? new Date(selectedIncident.created_at).toLocaleString('de-DE') : 'Unbekannt'}
                    </Text>
                  </View>
                </View>

                {/* Standort-Karte */}
                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>🗺️ Standort-Karte</Text>
                  <GoogleMapsView incident={selectedIncident} />
                </View>

                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>📊 Status & Priorität</Text>
                  
                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>Status:</Text>
                    <View style={[
                      dynamicStyles.statusBadge,
                      {
                        backgroundColor: selectedIncident.status === 'open' ? colors.error + '20' :
                                       selectedIncident.status === 'in_progress' ? colors.warning + '20' :
                                       colors.success + '20',
                        borderColor: selectedIncident.status === 'open' ? colors.error :
                                   selectedIncident.status === 'in_progress' ? colors.warning :
                                   colors.success
                      }
                    ]}>
                      <Text style={[
                        dynamicStyles.statusBadgeText,
                        {
                          color: selectedIncident.status === 'open' ? colors.error :
                                 selectedIncident.status === 'in_progress' ? colors.warning :
                                 colors.success
                        }
                      ]}>
                        {selectedIncident.status === 'open' ? '🔴 Offen' :
                         selectedIncident.status === 'in_progress' ? '🟡 In Bearbeitung' :
                         '🟢 Abgeschlossen'}
                      </Text>
                    </View>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>⚡ Priorität:</Text>
                    <Text style={[
                      dynamicStyles.detailValue,
                      {
                        color: selectedIncident.priority === 'high' ? colors.error :
                               selectedIncident.priority === 'medium' ? colors.warning :
                               colors.success
                      }
                    ]}>
                      {selectedIncident.priority === 'high' ? '🔴 HOCH' :
                       selectedIncident.priority === 'medium' ? '🟡 MITTEL' :
                       '🟢 NIEDRIG'}
                    </Text>
                  </View>

                  {selectedIncident.assigned_to_name && (
                    <View style={dynamicStyles.detailRow}>
                      <Text style={dynamicStyles.detailLabel}>👤 Angenommen von:</Text>
                      <Text style={dynamicStyles.detailValue}>{selectedIncident.assigned_to_name}</Text>
                    </View>
                  )}

                  {selectedIncident.assigned_at && (
                    <View style={dynamicStyles.detailRow}>
                      <Text style={dynamicStyles.detailLabel}>🕒 Angenommen am:</Text>
                      <Text style={dynamicStyles.detailValue}>
                        {new Date(selectedIncident.assigned_at).toLocaleDateString('de-DE')} um {new Date(selectedIncident.assigned_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  )}

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📅 Erstellt am:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {new Date(selectedIncident.created_at).toLocaleDateString('de-DE')} um {new Date(selectedIncident.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>

                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>🎯 Aktionen</Text>
                  
                {/* Auf Karte zeigen Button entfernt */}

                  {/* Annehmen Button - falls Vorfall noch nicht zugewiesen ist */}
                  {!selectedIncident.assigned_to && (
                    <TouchableOpacity
                      style={[dynamicStyles.actionButton, { backgroundColor: colors.primary, marginBottom: 12 }]}
                      onPress={() => {
                        if (window.confirm(`👤 Vorfall annehmen\n\n"${selectedIncident.title}" annehmen und selbst bearbeiten?`)) {
                          assignIncidentToSelf(selectedIncident.id, selectedIncident.title);
                        }
                      }}
                    >
                      <Ionicons name="person-add" size={20} color="#FFFFFF" />
                      <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
                        👤 Vorfall annehmen
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* In Bearbeitung Button - Incident auf in_progress setzen */}
                  {selectedIncident.status !== 'in_progress' && (
                    <TouchableOpacity
                      style={[dynamicStyles.actionButton, { backgroundColor: colors.warning, marginBottom: 12 }]}
                      onPress={() => {
                        if (window.confirm(`⚙️ Status ändern\n\n"${selectedIncident.title}" auf "IN BEARBEITUNG" setzen?`)) {
                          updateIncidentStatus(selectedIncident.id, 'in_progress', selectedIncident.title);
                        }
                      }}
                    >
                      <Ionicons name="cog" size={20} color="#FFFFFF" />
                      <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
                        ⚙️ IN BEARBEITUNG
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Abschließen Button */}
                  <TouchableOpacity
                    style={[dynamicStyles.actionButton, { backgroundColor: colors.success, marginBottom: 12 }]}
                    onPress={() => {
                      if (window.confirm(`✅ Vorfall abschließen\n\n"${selectedIncident.title}" abschließen?`)) {
                        completeIncident(selectedIncident.id, selectedIncident.title);
                        setShowIncidentDetailModal(false);
                      }
                    }}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
                      ✅ ABGESCHLOSSEN
                    </Text>
                  </TouchableOpacity>

                  {user?.role === 'admin' && (
                    <TouchableOpacity
                      style={[dynamicStyles.actionButton, { backgroundColor: colors.error }]}
                      onPress={() => {
                        if (window.confirm(`🗑️ Vorfall löschen\n\n"${selectedIncident.title}" wirklich löschen?`)) {
                          deleteIncident(selectedIncident.id, selectedIncident.title);
                          setShowIncidentDetailModal(false);
                        }
                      }}
                    >
                      <Ionicons name="trash" size={20} color="#FFFFFF" />
                      <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
                        🗑️ Vorfall löschen
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ height: 40 }} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Incident Map Modal - SIMPLE VERSION */}
      <Modal
        visible={showIncidentMap}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowIncidentMap(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowIncidentMap(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>
              🗺️ {selectedIncident?.title || 'Vorfall auf Karte'}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16, color: colors.text }}>
              📋 Vorfall-Details
            </Text>
            
            {selectedIncident && (
              <View>
                <Text style={{ fontSize: 16, marginBottom: 8, color: colors.text }}>
                  <Text style={{ fontWeight: '600' }}>Titel:</Text> {selectedIncident.title}
                </Text>
                <Text style={{ fontSize: 16, marginBottom: 8, color: colors.text }}>
                  <Text style={{ fontWeight: '600' }}>Beschreibung:</Text> {selectedIncident.description || 'Keine Beschreibung'}
                </Text>
                <Text style={{ fontSize: 16, marginBottom: 8, color: colors.text }}>
                  <Text style={{ fontWeight: '600' }}>Standort:</Text> {selectedIncident.address || selectedIncident.location || 'Unbekannt'}
                </Text>
                <Text style={{ fontSize: 16, marginBottom: 8, color: colors.text }}>
                  <Text style={{ fontWeight: '600' }}>Priorität:</Text> {selectedIncident.priority || 'Nicht gesetzt'}
                </Text>
                <Text style={{ fontSize: 16, marginBottom: 8, color: colors.text }}>
                  <Text style={{ fontWeight: '600' }}>Status:</Text> {selectedIncident.status || 'Offen'}
                </Text>
                <Text style={{ fontSize: 16, marginBottom: 16, color: colors.text }}>
                  <Text style={{ fontWeight: '600' }}>Gemeldet am:</Text> {selectedIncident.created_at ? 
                    new Date(selectedIncident.created_at).toLocaleString('de-DE') : 
                    'Unbekannt'
                  }
                </Text>
              </View>
            )}
            
            
            <TouchableOpacity 
              style={{
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
                marginTop: 20
              }}
              onPress={() => setShowIncidentMap(false)}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                ✅ Schließen
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Private Message Modal */}
      <Modal
        visible={showPrivateMessageModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrivateMessageModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPrivateMessageModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>
              💬 Private Nachricht an {selectedRecipient?.username}
            </Text>
            <TouchableOpacity 
              onPress={sendPrivateMessage}
              disabled={!privateMessage.trim() || sendingPrivateMessage}
            >
              {sendingPrivateMessage ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[
                  dynamicStyles.saveButtonText,
                  { opacity: privateMessage.trim() ? 1 : 0.5 }
                ]}>Senden</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.modalContent}>
            {/* Benutzerauswahl wenn kein Empfänger gewählt */}
            {!selectedRecipient && (
              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>
                  👥 Empfänger auswählen
                </Text>
                <ScrollView style={dynamicStyles.userSelectionContainer}>
                  {Object.entries(usersByStatus).map(([status, users]) => (
                    <View key={status}>
                      <Text style={dynamicStyles.statusHeaderText}>
                        {status} ({users.length})
                      </Text>
                      {users.map((user) => (
                        <TouchableOpacity
                          key={user.id}
                          style={dynamicStyles.userSelectionItem}
                          onPress={() => setSelectedRecipient(user)}
                        >
                          <Ionicons name="person-circle" size={40} color={colors.primary} />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={dynamicStyles.userSelectionName}>
                              {user.username}
                            </Text>
                            <Text style={dynamicStyles.userSelectionDetails}>
                              {user.rank} • {user.department} • {user.service_number}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Nachrichtenformular wenn Empfänger gewählt */}
            {selectedRecipient && (
              <View style={dynamicStyles.formGroup}>
                <TouchableOpacity 
                  style={dynamicStyles.recipientHeader}
                  onPress={() => setSelectedRecipient(null)}
                >
                  <Ionicons name="arrow-back" size={20} color={colors.primary} />
                  <Text style={dynamicStyles.formLabel}>
                    📩 Nachricht an {selectedRecipient?.username}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[dynamicStyles.formInput, dynamicStyles.textArea]}
                  value={privateMessage}
                  onChangeText={setPrivateMessage}
                  placeholder="Schreiben Sie Ihre private Nachricht hier..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
                <Text style={dynamicStyles.submitNote}>
                  {privateMessage.length}/500 Zeichen
                </Text>
              </View>
            )}

            {/* Submit Button nur anzeigen wenn Empfänger gewählt */}
            {selectedRecipient && (
              <TouchableOpacity
                style={[
                  dynamicStyles.submitButton,
                  (!privateMessage.trim() || sendingPrivateMessage) && dynamicStyles.submitButtonDisabled
                ]}
                onPress={sendPrivateMessage}
                disabled={!privateMessage.trim() || sendingPrivateMessage}
              >
                {sendingPrivateMessage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                    <Text style={dynamicStyles.submitButtonText}>
                      📤 Nachricht senden
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <Text style={dynamicStyles.submitNote}>
              💡 Der Empfänger erhält eine Benachrichtigung über Ihre Nachricht.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Chat Reply Modal */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChatModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowChatModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>
              💬 Antwort an {selectedChat?.sender_name}
            </Text>
            <TouchableOpacity 
              onPress={sendChatReply}
              disabled={!chatReply.trim() || sendingPrivateMessage}
            >
              {sendingPrivateMessage ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[
                  dynamicStyles.saveButtonText,
                  { opacity: chatReply.trim() ? 1 : 0.5 }
                ]}>Senden</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.modalContent}>
            {/* Original Message */}
            <View style={dynamicStyles.detailCard}>
              <Text style={dynamicStyles.detailSectionTitle}>
                💬 Ursprüngliche Nachricht
              </Text>
              <Text style={dynamicStyles.detailDescription}>
                "{selectedChat?.content}"
              </Text>
              <Text style={[dynamicStyles.detailValue, { textAlign: 'left', marginTop: 8 }]}>
                🕒 {selectedChat?.created_at ? 
                  new Date(selectedChat.created_at).toLocaleString('de-DE') : 
                  'Unbekannte Zeit'
                }
              </Text>
            </View>

            {/* Reply Form */}
            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>
                📤 Ihre Antwort
              </Text>
              <TextInput
                style={[dynamicStyles.formInput, dynamicStyles.textArea]}
                value={chatReply}
                onChangeText={setChatReply}
                placeholder="Antworten Sie hier auf die Nachricht..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text style={dynamicStyles.submitNote}>
                {chatReply.length}/500 Zeichen
              </Text>
            </View>

            <TouchableOpacity
              style={[
                dynamicStyles.submitButton,
                (!chatReply.trim() || sendingPrivateMessage) && dynamicStyles.submitButtonDisabled
              ]}
              onPress={sendChatReply}
              disabled={!chatReply.trim() || sendingPrivateMessage}
            >
              {sendingPrivateMessage ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                  <Text style={dynamicStyles.submitButtonText}>
                    📤 Antwort senden
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={dynamicStyles.submitNote}>
              💡 {selectedChat?.sender_name} erhält eine Benachrichtigung über Ihre Antwort.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* All Messages Modal */}
      <Modal
        visible={showAllMessagesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAllMessagesModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAllMessagesModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>
              💬 Alle Nachrichten ({allMessages.length})
            </Text>
            <TouchableOpacity onPress={() => loadAllMessages()}>
              <Ionicons name="refresh" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={dynamicStyles.modalContent}>
            {allMessages.length === 0 ? (
              <View style={dynamicStyles.emptyState}>
                <Ionicons name="mail-open" size={64} color={colors.secondary} style={dynamicStyles.emptyIcon} />
                <Text style={dynamicStyles.emptyText}>Keine Nachrichten</Text>
                <Text style={dynamicStyles.emptySubtext}>
                  Sie haben noch keine privaten Nachrichten erhalten 📬
                </Text>
              </View>
            ) : (
              allMessages.map((message, index) => (
                <TouchableOpacity 
                  key={message.id || index} 
                  style={[dynamicStyles.incidentCard, 
                    { borderLeftColor: colors.secondary }
                  ]}
                  onPress={() => {
                    setSelectedChat(message);
                    setShowAllMessagesModal(false);
                    setShowChatModal(true);
                  }}
                >
                  <View style={[dynamicStyles.incidentIcon, 
                    { backgroundColor: colors.secondary + '20' }
                  ]}>
                    <Ionicons name="person" size={24} color={colors.secondary} />
                  </View>
                  <View style={dynamicStyles.incidentContent}>
                    <Text style={dynamicStyles.incidentTitle}>
                      💬 Von: {message.sender_name || 'Unbekannt'}
                    </Text>
                    <Text style={dynamicStyles.incidentTime}>
                      🕒 {message.created_at ? 
                        new Date(message.created_at).toLocaleString('de-DE') : 
                        'Unbekannte Zeit'
                      }
                    </Text>
                    <Text style={[dynamicStyles.incidentTime, { color: colors.text }]} numberOfLines={3}>
                      "{message.content || 'Keine Nachricht'}"
                    </Text>
                  </View>
                  <View style={dynamicStyles.incidentActions}>
                    <TouchableOpacity 
                      style={[dynamicStyles.mapButton, { backgroundColor: colors.secondary }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedChat(message);
                        setShowAllMessagesModal(false);
                        setShowChatModal(true);
                      }}
                    >
                      <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[dynamicStyles.deleteButton, { backgroundColor: colors.error }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        Alert.alert(
                          '🗑️ Chat löschen',
                          'Möchten Sie diese Nachricht wirklich löschen?',
                          [
                            { text: 'Abbrechen', style: 'cancel' },
                            { 
                              text: 'Löschen', 
                              style: 'destructive',
                              onPress: () => {
                                deleteChat(message.id);
                                setShowAllMessagesModal(false);
                              }
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* All Incidents Modal */}
      <Modal
        visible={showAllIncidentsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAllIncidentsModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAllIncidentsModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>
              🚨 Alle Vorfälle ({recentIncidents.length})
            </Text>
            <TouchableOpacity onPress={() => loadData()}>
              <Ionicons name="refresh" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={dynamicStyles.modalContent}>
            {recentIncidents.length === 0 ? (
              <View style={dynamicStyles.emptyState}>
                <Ionicons name="shield-checkmark" size={64} color={colors.primary} style={dynamicStyles.emptyIcon} />
                <Text style={dynamicStyles.emptyText}>Keine aktuellen Vorfälle</Text>
                <Text style={dynamicStyles.emptySubtext}>
                  Derzeit sind keine Vorfälle gemeldet 🛡️
                </Text>
              </View>
            ) : (
              recentIncidents.map((incident, index) => (
                <TouchableOpacity 
                  key={incident.id || index} 
                  style={[dynamicStyles.incidentCard, 
                    { borderLeftColor: getPriorityColor(incident.priority) }
                  ]}
                  onPress={() => {
                    // Bleibe in der Übersicht, zeige nur erweiterte Info
                    setSelectedIncident(incident);
                  }}
                >
                  <View style={[dynamicStyles.incidentIcon, 
                    { backgroundColor: getPriorityColor(incident.priority) + '20' }
                  ]}>
                    <Ionicons name="warning" size={24} color={getPriorityColor(incident.priority)} />
                  </View>
                  <View style={dynamicStyles.incidentContent}>
                    <Text style={dynamicStyles.incidentTitle}>
                      {incident.title}
                    </Text>
                    <Text style={dynamicStyles.incidentTime}>
                      🕒 {incident.created_at ? 
                        new Date(incident.created_at).toLocaleString('de-DE') : 
                        'Unbekannte Zeit'
                      }
                    </Text>
                    <Text style={[dynamicStyles.incidentTime, { color: colors.textMuted }]}>
                      📍 {incident.address || incident.location || 'Unbekannter Ort'}
                    </Text>
                    <Text style={[dynamicStyles.incidentTime, { color: colors.text }]} numberOfLines={2}>
                      📝 {incident.description}
                    </Text>
                  </View>
                  <View style={dynamicStyles.incidentActions}>
                    <TouchableOpacity 
                      style={[dynamicStyles.mapButton, { backgroundColor: colors.secondary }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedIncident(incident);
                        // Schließe Übersicht und öffne Vorfall-Details
                        setShowAllIncidentsModal(false);
                        setTimeout(() => {
                          setShowIncidentDetailModal(true);
                        }, 100);
                      }}
                    >
                      <Ionicons name="eye" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Report Details Modal with Status Actions */}
      <Modal
        visible={showReportDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReportDetailModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReportDetailModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>📊 Bericht Details</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={dynamicStyles.modalContent} showsVerticalScrollIndicator={false}>
            {selectedReport && (
              <>
                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>📋 Bericht-Information</Text>
                  
                  {/* Report Photo - from images array */}
                  {selectedReport.images && selectedReport.images.length > 0 && (
                    <View style={dynamicStyles.detailRow}>
                      <Text style={dynamicStyles.detailLabel}>📸 Foto:</Text>
                      <View style={dynamicStyles.photoContainer}>
                        <TouchableOpacity onPress={() => {
                          Alert.alert('📸 Foto', 'Foto des Berichts', [
                            { text: 'OK' }
                          ]);
                        }}>
                          <Image 
                            source={{ uri: selectedReport.images[0] }} 
                            style={dynamicStyles.reportPhoto}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>🚨 Titel:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedReport.title || 'Unbenannter Bericht'}
                    </Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>👤 Autor:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedReport.author_name || 'Unbekannt'}
                    </Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📅 Schichtdatum:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedReport.shift_date ? new Date(selectedReport.shift_date).toLocaleDateString('de-DE') : 'Nicht angegeben'}
                    </Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>🕒 Erstellt:</Text>
                    <Text style={dynamicStyles.detailValue}>
                      {selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString('de-DE') : 'Unbekannt'}
                    </Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📊 Status:</Text>
                    <Text style={[
                      dynamicStyles.detailValue,
                      {
                        color: selectedReport.status === 'draft' ? colors.warning :
                               selectedReport.status === 'in_progress' ? colors.primary :
                               selectedReport.status === 'completed' ? colors.success :
                               selectedReport.status === 'archived' ? colors.textMuted : 
                               colors.text
                      }
                    ]}>
                      {selectedReport.status === 'draft' ? '📝 Entwurf' :
                       selectedReport.status === 'in_progress' ? '⚙️ In Bearbeitung' :
                       selectedReport.status === 'completed' ? '✅ Abgeschlossen' :
                       selectedReport.status === 'archived' ? '📦 Archiviert' :
                       selectedReport.status === 'submitted' ? '📤 Eingereicht' : 
                       selectedReport.status || 'Unbekannt'}
                    </Text>
                  </View>

                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>📝 Inhalt:</Text>
                    <Text style={[dynamicStyles.detailValue, { marginTop: 8 }]}>
                      {selectedReport.content || 'Kein Inhalt verfügbar'}
                    </Text>
                  </View>
                </View>

                <View style={dynamicStyles.detailCard}>
                  <Text style={dynamicStyles.detailSectionTitle}>🎯 Status-Aktionen</Text>
                  
                  {selectedReport.status !== 'in_progress' && (
                    <TouchableOpacity
                      style={[dynamicStyles.actionButton, { backgroundColor: colors.primary, marginBottom: 12 }]}
                      onPress={() => {
                        Alert.alert(
                          '⚙️ Status ändern',
                          `"${selectedReport.title}" auf "IN BEARBEITUNG" setzen?`,
                          [
                            { text: 'Abbrechen', style: 'cancel' },
                            { 
                              text: 'Ändern', 
                              onPress: () => updateReportStatus(selectedReport.id, 'in_progress', selectedReport.title)
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="cog" size={20} color="#FFFFFF" />
                      <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
                        ⚙️ IN BEARBEITUNG
                      </Text>
                    </TouchableOpacity>
                  )}

                  {selectedReport.status !== 'completed' && (
                    <TouchableOpacity
                      style={[dynamicStyles.actionButton, { backgroundColor: colors.success, marginBottom: 12 }]}
                      onPress={() => {
                        Alert.alert(
                          '✅ Status ändern',
                          `"${selectedReport.title}" auf "ABGESCHLOSSEN" setzen?`,
                          [
                            { text: 'Abbrechen', style: 'cancel' },
                            { 
                              text: 'Ändern', 
                              onPress: () => updateReportStatus(selectedReport.id, 'completed', selectedReport.title)
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                      <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
                        ✅ ABGESCHLOSSEN
                      </Text>
                    </TouchableOpacity>
                  )}

                  {selectedReport.status !== 'archived' && (
                    <TouchableOpacity
                      style={[dynamicStyles.actionButton, { backgroundColor: colors.textMuted, marginBottom: 12 }]}
                      onPress={() => {
                        Alert.alert(
                          '📦 Status ändern',
                          `"${selectedReport.title}" auf "ARCHIVIERT" setzen?`,
                          [
                            { text: 'Abbrechen', style: 'cancel' },
                            { 
                              text: 'Ändern', 
                              onPress: () => updateReportStatus(selectedReport.id, 'archived', selectedReport.title)
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="archive" size={20} color="#FFFFFF" />
                      <Text style={[dynamicStyles.actionButtonText, { color: '#FFFFFF' }]}>
                        📦 ARCHIVIERT
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ height: 40 }} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* SOS Modal */}
      <Modal
        visible={showSOSModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSOSModal(false)}
      >
        <SafeAreaView style={dynamicStyles.container}>
          <View style={dynamicStyles.profileModalHeader}>
            <TouchableOpacity 
              style={dynamicStyles.profileCloseButton}
              onPress={() => setShowSOSModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
            
            <View style={dynamicStyles.profileHeaderContent}>
              <View style={dynamicStyles.sosIconContainer}>
                <Ionicons name="warning" size={48} color="#FF0000" />
              </View>
              <Text style={dynamicStyles.sosModalTitle}>🚨 NOTFALL-ALARM</Text>
              <Text style={dynamicStyles.sosModalSubtitle}>Alle Team-Mitglieder alarmieren</Text>
            </View>
          </View>

          <ScrollView style={dynamicStyles.profileContent}>
            <View style={dynamicStyles.sosWarningBox}>
              <Text style={dynamicStyles.sosWarningTitle}>⚠️ WICHTIGER HINWEIS</Text>
              <Text style={dynamicStyles.sosWarningText}>
                • Nur bei echten Notfällen verwenden!{'\n'}
                • Ihr GPS-Standort wird automatisch übertragen{'\n'}
                • Alle Team-Mitglieder erhalten sofort eine Alarm-Nachricht{'\n'}
                • Missbrauch kann disziplinäre Maßnahmen zur Folge haben
              </Text>
            </View>

            <View style={dynamicStyles.sosLocationInfo}>
              <Text style={dynamicStyles.sosLocationTitle}>📍 Ihr Standort</Text>
              <Text style={dynamicStyles.sosLocationText}>
                Wird automatisch ermittelt und an alle Team-Mitglieder gesendet
              </Text>
            </View>

            <TouchableOpacity 
              style={dynamicStyles.sosSendButton}
              onPress={sendSOSAlarm}
            >
              <Ionicons name="alert-circle" size={32} color="#FFFFFF" />
              <Text style={dynamicStyles.sosSendButtonText}>🚨 NOTFALL-ALARM SENDEN</Text>
              <Text style={dynamicStyles.sosSendButtonSubtext}>Alle Team-Mitglieder werden sofort alarmiert</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
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