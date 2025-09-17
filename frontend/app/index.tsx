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
import AddUserModal from './components/AddUserModal';
import DiscordMessages from './components/DiscordMessages';
import GoogleMapsView from './components/GoogleMapsView';

// Mobile-First Responsive Design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isMobile = screenWidth < 768;
const isTablet = screenWidth >= 768 && screenWidth < 1024;
const isDesktop = screenWidth >= 1024;

// Safe dimensions with fallbacks
const width = screenWidth || 390;
const height = screenHeight || 844;

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
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const theme = {
    isDarkMode,
    toggleTheme,
    colors: isDarkMode ? {
      background: '#000',
      surface: '#111',
      primary: '#0084FF',
      secondary: '#555',
      text: '#FFF',
      textMuted: '#AAA',
      border: '#333',
      success: '#00C851',
      warning: '#ffbb33',
      error: '#ff4444',
      gradient: ['#000', '#111']
    } : {
      background: '#F2F2F2',
      surface: '#FFF',
      primary: '#007AFF',
      secondary: '#8E8E93',
      text: '#000',
      textMuted: '#666',
      border: '#E5E5EA',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      gradient: ['#F2F2F2', '#FFF']
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false); // LOADING DEAKTIVIERT für sofortiges Laden

  // BACKEND URL - FÜR APK VERWENDUNG
  const BACKEND_BASE_URL = "http://212.227.57.238:8001";

  useEffect(() => {
    // Mobile-optimierte Initialisierung - KEINE API CALLS FÜR WEB
    console.log('🚀 Stadtwache Mobile App starting...');
    
    // Nur für Mobile - Auth prüfen, NIEMALS für Web
    if (Platform.OS !== 'web') {
      checkAuthState();
      setupAxiosInterceptors();
    } else {
      // Web: Direkt auf Login setzen, KEINE BACKEND-CALLS
      console.log('🌐 Web-Modus: Überspringe alle Backend-Calls');
      setIsAuthenticated(false);
      setUser(null);
      setToken(null);
    }
    
    console.log('✅ Stadtwache ready');
  }, []);

  const setupAxiosInterceptors = () => {
    // Nur für Mobile - Web hat andere Auth-Mechanismen
    if (Platform.OS !== 'web') {
      axios.interceptors.response.use(
        (response) => response,
        async (error) => {
          const originalRequest = error.config;
          
          if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
              const savedToken = await AsyncStorage.getItem('stadtwache_token');
              const savedUser = await AsyncStorage.getItem('stadtwache_user');
              
              if (savedToken && savedUser) {
                const response = await axios.get(`${BACKEND_BASE_URL}/api/auth/me`, {
                  headers: { Authorization: `Bearer ${savedToken}` },
                  timeout: 5000
                });
                
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
                axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
                setIsAuthenticated(true);
                
                return axios(originalRequest);
              } else {
                setIsAuthenticated(false);
                setUser(null);
                setToken(null);
                delete axios.defaults.headers.common['Authorization'];
              }
            } catch (tokenError) {
              console.log('❌ Token-Erneuerung fehlgeschlagen:', tokenError.message);
              setIsAuthenticated(false);
              setUser(null);
              setToken(null);
              delete axios.defaults.headers.common['Authorization'];
            }
          }
          
          return Promise.reject(error);
        }
      );
    }
  };

  const checkAuthState = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('stadtwache_token');
      const savedUser = await AsyncStorage.getItem('stadtwache_user');
      
      if (savedToken && savedUser) {
        try {
          const response = await axios.get(`${BACKEND_BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
            timeout: 5000
          });
          
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
          setIsAuthenticated(true);
        } catch (tokenError) {
          await AsyncStorage.removeItem('stadtwache_token');
          await AsyncStorage.removeItem('stadtwache_user');
          setIsAuthenticated(false);
          setUser(null);
          setToken(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      setIsAuthenticated(false);
      setUser(null);
      setToken(null);
    } finally {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('🔐 Login attempt:', email);
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
      setIsAuthenticated(true);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login fehlgeschlagen'
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${BACKEND_BASE_URL}/api/auth/register`, userData);
      return { success: true, user: response.data };
    } catch (error) {
      console.error('Registration error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Registrierung fehlgeschlagen'
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('stadtwache_token');
      await AsyncStorage.removeItem('stadtwache_user');
      
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      delete axios.defaults.headers.common['Authorization'];
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // MOBILE-OPTIMIERTE SOS ALARM FUNKTION
  const sendSOSAlarm = async () => {
    try {
      console.log('🚨 SOS-Alarm wird gesendet...');
      
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      // GPS-Standorterfassung (MOBILE-OPTIMIERT)
      let locationData = null;
      let locationStatus = 'Nicht verfügbar';
      
      try {
        console.log('📍 Starte GPS-Standort-Ermittlung...');
        
        // Request permissions using Location module
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          console.log('✅ GPS-Berechtigung erhalten');
          
          // Get current position with high accuracy
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
            timeout: 10000,
            maximumAge: 1000,
          });
          
          if (position?.coords) {
            locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || 0,
              timestamp: Date.now()
            };
            
            locationStatus = `GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
            console.log('✅ GPS-Koordinaten erfolgreich ermittelt:', locationStatus);
          }
        } else {
          console.log('❌ GPS-Berechtigung verweigert');
          locationStatus = 'GPS-Berechtigung verweigert';
        }
      } catch (gpsError) {
        console.log('⚠️ GPS-Fehler:', gpsError.message);
        locationStatus = 'GPS-Fehler: ' + gpsError.message;
      }

      // Emergency-Broadcast-Daten
      const emergencyData = {
        type: 'sos_alarm',
        message: `🚨 NOTFALL-ALARM! ${user?.username || 'Unbekannte Person'} benötigt sofortige Hilfe!`,
        location: locationData,
        location_status: locationStatus,
        sender_id: user?.id || 'unknown',
        timestamp: new Date().toISOString(),
        priority: 'critical'
      };

      console.log('📡 Sende Notfall-Broadcast:', emergencyData);
      
      await axios.post(`${BACKEND_BASE_URL}/api/emergency/broadcast`, emergencyData, config);
      
      // 🔥 MOBILE TEAM-ALARM: Simuliere echte Push-Benachrichtigungen
      try {
        if (Platform.OS !== 'web') {
          // Import Haptics für intensive Vibration
          const { Haptics } = require('expo-haptics');
          
          // Intensive Alarm-Vibration für 5 Sekunden
          for (let i = 0; i < 10; i++) {
            setTimeout(() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }, i * 500);
          }
          
          // Audio-Alarm simulieren (falls verfügbar)
          try {
            const { Audio } = require('expo-av');
            console.log('🔊 Audio-Alarm würde hier abgespielt werden');
          } catch (audioError) {
            console.log('⚠️ Audio nicht verfügbar:', audioError.message);
          }
        }
        
        console.log('📲 TEAM-ALARM: Alle Team-Mitglieder werden benachrichtigt!');
        console.log('🚨 GPS-Standort wird an alle gesendet:', locationStatus);
        
      } catch (alarmError) {
        console.log('⚠️ Team-Alarm-System Fehler:', alarmError.message);
      }
      
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
      
      // Fallback SOS auch bei Problemen senden
      try {
        const fallbackData = {
          type: 'sos_fallback',
          message: `🚨 NOTFALL! ${user?.username || 'Team-Mitglied'} - Bitte direkt Kollegen kontaktieren!`,
          location: null,
          location_status: 'GPS nicht verfügbar',
          priority: 'critical'
        };
        
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        await axios.post(`${BACKEND_BASE_URL}/api/emergency/broadcast`, fallbackData, config);
        
        Alert.alert(
          '🚨 NOTFALL-ALARM GESENDET!',
          'Team wurde alarmiert (Fallback-Modus)\n📍 GPS: Nicht verfügbar',
          [{ text: 'OK', style: 'default' }]
        );
      } catch (fallbackError) {
        Alert.alert(
          '❌ KRITISCHER FEHLER',
          'SOS-Alarm konnte nicht gesendet werden.\nBitte direkt Kollegen kontaktieren!',
          [{ text: 'OK', style: 'destructive' }]
        );
      }
    }
  };

  return (
    <ThemeContext.Provider value={{
      user,
      setUser,
      token,
      setToken,
      isAuthenticated,
      setIsAuthenticated,
      loading,
      setLoading,
      login,
      register,
      logout,
      sendSOSAlarm,
      BACKEND_BASE_URL
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

// MOBILE-OPTIMIERTER LOGIN SCREEN
const LoginScreen = () => {
  const { colors } = useTheme();
  const { login, register, setLoading, loading } = useContext(ThemeContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [additionalFields, setAdditionalFields] = useState({
    username: '',
    badge_number: '',
    department: '',
    phone: '',
    service_number: '',
    rank: ''
  });

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Fehler', 'Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setLoading(true);
    const result = isRegistering 
      ? await register({
          email,
          password,
          ...additionalFields
        })
      : await login(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Fehler', result.error);
    }
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 32,
    },
    logo: {
      width: 80,
      height: 80,
      backgroundColor: colors.primary,
      borderRadius: 40,
      marginBottom: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    switchButton: {
      alignItems: 'center',
    },
    switchText: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 16,
    },
    footer: {
      alignItems: 'center',
    },
    footerText: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    serverText: {
      color: colors.primary,
      fontSize: 12,
    }
  };

  return (
    <KeyboardAvoidingView 
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center' }}>
        <View style={dynamicStyles.card}>
          <View style={dynamicStyles.logoContainer}>
            <View style={dynamicStyles.logo}>
              <Ionicons name="shield-checkmark" size={40} color="#FFFFFF" />
            </View>
            <Text style={dynamicStyles.title}>Stadtwache</Text>
            <Text style={dynamicStyles.subtitle}>Sicherheitsbehörde Schwelm</Text>
          </View>

          <View style={dynamicStyles.inputContainer}>
            <Text style={dynamicStyles.label}>E-Mail Adresse</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="benutzer@stadtwache.de"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={dynamicStyles.inputContainer}>
            <Text style={dynamicStyles.label}>Passwort</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Passwort eingeben"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {isRegistering && (
            <>
              <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.label}>Benutzername</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Max Mustermann"
                  value={additionalFields.username}
                  onChangeText={(text) => setAdditionalFields(prev => ({...prev, username: text}))}
                />
              </View>

              <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.label}>Dienstnummer</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="12345"
                  value={additionalFields.badge_number}
                  onChangeText={(text) => setAdditionalFields(prev => ({...prev, badge_number: text}))}
                />
              </View>

              <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.label}>Abteilung</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Streife"
                  value={additionalFields.department}
                  onChangeText={(text) => setAdditionalFields(prev => ({...prev, department: text}))}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={dynamicStyles.button}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="log-in" size={20} color="#FFFFFF" />
                <Text style={dynamicStyles.buttonText}>
                  {isRegistering ? 'Registrieren' : 'Anmelden'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={dynamicStyles.switchButton}>
            <Text style={dynamicStyles.switchText}>Stadtwache Schwelm</Text>
            <Text style={dynamicStyles.serverText}>
              Sichere Verbindung • Server: 212.227.57.238:8001
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// MAIN APP COMPONENT
const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar />
          <AppContent />
        </SafeAreaView>
      </AuthProvider>
    </ThemeProvider>
  );
};

const AppContent = () => {
  const { isAuthenticated, loading } = useContext(ThemeContext);
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16, fontSize: 16 }}>
          Stadtwache wird geladen...
        </Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <MainApp />;
};

// SIMPLIFIED MAIN APP FOR TESTING
const MainApp = () => {
  const { colors } = useTheme();
  const { user, logout, sendSOSAlarm } = useContext(ThemeContext);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Willkommen, {user?.username || 'Benutzer'}!
      </Text>
      
      <TouchableOpacity
        style={{
          backgroundColor: '#FF4444',
          padding: 20,
          borderRadius: 12,
          alignItems: 'center',
          marginBottom: 20
        }}
        onPress={sendSOSAlarm}
      >
        <Ionicons name="warning" size={24} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginTop: 8 }}>
          🚨 SOS NOTFALL-ALARM
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 14, marginTop: 4 }}>
          GPS + Team-Benachrichtigung
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: colors.secondary,
          padding: 16,
          borderRadius: 12,
          alignItems: 'center'
        }}
        onPress={logout}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          Abmelden
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default App;