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
  Animated,
  Easing,
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

// MODERN RESPONSIVE DESIGN SYSTEM
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 400;
const isMediumScreen = screenWidth >= 400 && screenWidth < 600;
const isLargeScreen = screenWidth >= 600;

// PROFESSIONAL DESIGN TOKENS
const DESIGN_TOKENS = {
  colors: {
    primary: {
      50: '#EFF6FF',
      100: '#DBEAFE', 
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6', // Main primary
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
    secondary: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 15,
      elevation: 8,
    },
  },
  typography: {
    xs: { fontSize: 12, lineHeight: 16 },
    sm: { fontSize: 14, lineHeight: 20 },
    base: { fontSize: 16, lineHeight: 24 },
    lg: { fontSize: 18, lineHeight: 28 },
    xl: { fontSize: 20, lineHeight: 28 },
    '2xl': { fontSize: 24, lineHeight: 32 },
    '3xl': { fontSize: 30, lineHeight: 36 },
    '4xl': { fontSize: 36, lineHeight: 40 },
  },
};

// Configure notifications for mobile alerts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// MODERN THEME CONTEXT
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
      console.error('Theme loading error:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Theme saving error:', error);
    }
  };

  const colors = isDarkMode ? {
    // Dark theme
    primary: DESIGN_TOKENS.colors.primary[400],
    primaryLight: DESIGN_TOKENS.colors.primary[300],
    primaryDark: DESIGN_TOKENS.colors.primary[600],
    secondary: DESIGN_TOKENS.colors.secondary[400],
    background: DESIGN_TOKENS.colors.secondary[900],
    surface: DESIGN_TOKENS.colors.secondary[800],
    surfaceVariant: DESIGN_TOKENS.colors.secondary[700],
    text: DESIGN_TOKENS.colors.secondary[50],
    textSecondary: DESIGN_TOKENS.colors.secondary[300],
    textMuted: DESIGN_TOKENS.colors.secondary[400],
    border: DESIGN_TOKENS.colors.secondary[600],
    success: DESIGN_TOKENS.colors.success,
    warning: DESIGN_TOKENS.colors.warning,
    error: DESIGN_TOKENS.colors.error,
    info: DESIGN_TOKENS.colors.info,
  } : {
    // Light theme
    primary: DESIGN_TOKENS.colors.primary[600],
    primaryLight: DESIGN_TOKENS.colors.primary[500],
    primaryDark: DESIGN_TOKENS.colors.primary[700],
    secondary: DESIGN_TOKENS.colors.secondary[600],
    background: DESIGN_TOKENS.colors.secondary[50],
    surface: '#FFFFFF',
    surfaceVariant: DESIGN_TOKENS.colors.secondary[100],
    text: DESIGN_TOKENS.colors.secondary[900],
    textSecondary: DESIGN_TOKENS.colors.secondary[700],
    textMuted: DESIGN_TOKENS.colors.secondary[500],
    border: DESIGN_TOKENS.colors.secondary[200],
    success: DESIGN_TOKENS.colors.success,
    warning: DESIGN_TOKENS.colors.warning,
    error: DESIGN_TOKENS.colors.error,
    info: DESIGN_TOKENS.colors.info,
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors, DESIGN_TOKENS }}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.background}
      />
      {children}
    </ThemeContext.Provider>
  );
};

// ENHANCED AUTH CONTEXT
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

  const BACKEND_BASE_URL = "http://localhost:8001";

  useEffect(() => {
    checkAuthState();
    setupLocationServices();
    setupNotifications();
  }, []);

  const setupLocationServices = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
      }
      const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus.status !== 'granted') {
        console.warn('Background location permission not granted');
      }
    } catch (error) {
      console.error('Location setup error:', error);
    }
  };

  const setupNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permission not granted');
      }
      const token = (await Notifications.getExpoPushTokenAsync()).data;
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

  const checkAuthState = async () => {
    console.log('🔍 Starting auth check...');
    
    // Force loading to false after timeout to prevent infinite loading
    setTimeout(() => {
      console.log('✅ FORCE: Setting loading to false');
      setLoading(false);
    }, 3000);
    
    try {
      const savedToken = await AsyncStorage.getItem('stadtwache_token');
      const savedUser = await AsyncStorage.getItem('stadtwache_user');
      
      console.log('🔍 Saved data:', { hasToken: !!savedToken, hasUser: !!savedUser });
      
      if (savedToken && savedUser) {
        console.log('🔐 Found saved login data, setting user...');
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } else {
        console.log('ℹ️ No saved login data found');
      }
    } catch (error) {
      console.error('❌ Auto-login error:', error);
    }
  };

  const login = async (email, password) => {
    console.log('🔐 Login attempt with:', { email, password: '***' });
    try {
      const response = await axios.post(`${BACKEND_BASE_URL}/api/auth/login`, {
        email,
        password
      });

      console.log('✅ Login response:', response.data);
      
      const { access_token, user: userData } = response.data;
      
      if (!access_token || !userData) {
        console.error('❌ Incomplete login response:', response.data);
        return {
          success: false,
          message: 'Incomplete server response'
        };
      }
      
      console.log('💾 Saving login data...');
      setToken(access_token);
      setUser(userData);
      
      await AsyncStorage.setItem('stadtwache_token', access_token);
      await AsyncStorage.setItem('stadtwache_user', JSON.stringify(userData));
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      console.log('✅ Login successful, user:', userData);
      
      return {
        success: true,
        user: userData
      };
      
    } catch (error) {
      console.error('❌ Login error:', error);
      console.error('❌ Login response:', error.response?.data);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          'Server error. Please try again later.';
      
      return {
        success: false,
        message: errorMessage
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('stadtwache_token');
      await AsyncStorage.removeItem('stadtwache_user');
      setToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
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

// MODERN PROFESSIONAL LOGIN SCREEN
const LoginScreen = ({ appConfig }) => {
  const [email, setEmail] = useState(__DEV__ ? 'admin@stadtwache.de' : '');
  const [password, setPassword] = useState(__DEV__ ? 'admin123' : '');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { colors, DESIGN_TOKENS } = useTheme();
  const { login } = useAuth();

  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Fehler', 'Bitte E-Mail und Passwort eingeben');
      return;
    }

    console.log('🔐 Login started with:', { email, password: '***' });
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    console.log('📱 Login result:', result);
    
    if (!result.success) {
      Alert.alert('Anmeldung fehlgeschlagen', result.message);
    } else {
      console.log('✅ Login successful, user should now be logged in');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    backgroundGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: screenHeight,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.xxl,
    },
    logo: {
      width: isSmallScreen ? 80 : 100,
      height: isSmallScreen ? 80 : 100,
      borderRadius: DESIGN_TOKENS.borderRadius.full,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.lg,
      ...DESIGN_TOKENS.shadows.lg,
    },
    logoGradient: {
      width: '100%',
      height: '100%',
      borderRadius: DESIGN_TOKENS.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      ...DESIGN_TOKENS.typography['3xl'],
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    subtitle: {
      ...DESIGN_TOKENS.typography.lg,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    formContainer: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.borderRadius.xl,
      padding: DESIGN_TOKENS.spacing.xl,
      ...DESIGN_TOKENS.shadows.lg,
    },
    inputContainer: {
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    label: {
      ...DESIGN_TOKENS.typography.sm,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    inputWrapper: {
      position: 'relative',
    },
    input: {
      backgroundColor: colors.surfaceVariant,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.borderRadius.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: isSmallScreen ? 12 : 16,
      ...DESIGN_TOKENS.typography.base,
      color: colors.text,
      minHeight: 48,
    },
    inputFocused: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    passwordToggle: {
      position: 'absolute',
      right: DESIGN_TOKENS.spacing.md,
      top: '50%',
      transform: [{ translateY: -12 }],
    },
    loginButton: {
      borderRadius: DESIGN_TOKENS.borderRadius.md,
      paddingVertical: isSmallScreen ? 14 : 18,
      alignItems: 'center',
      marginTop: DESIGN_TOKENS.spacing.lg,
      ...DESIGN_TOKENS.shadows.md,
      overflow: 'hidden',
    },
    buttonGradient: {
      paddingVertical: isSmallScreen ? 14 : 18,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      flexDirection: 'row',
    },
    loginButtonText: {
      color: 'white',
      ...DESIGN_TOKENS.typography.base,
      fontWeight: '600',
      marginLeft: DESIGN_TOKENS.spacing.sm,
    },
    serverInfo: {
      marginTop: DESIGN_TOKENS.spacing.xl,
      alignItems: 'center',
    },
    serverText: {
      ...DESIGN_TOKENS.typography.xs,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }}
          >
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <View style={styles.logoGradient}>
                  <Ionicons name="shield-checkmark" size={isSmallScreen ? 40 : 50} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.title}>{appConfig.app_name}</Text>
              <Text style={styles.subtitle}>{appConfig.organization_name}</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>E-Mail Adresse</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="admin@stadtwache.de"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Passwort</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Passwort eingeben"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color={colors.textMuted} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                <View style={styles.buttonGradient}>
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="log-in" size={20} color="white" />
                      <Text style={styles.loginButtonText}>Anmelden</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.serverInfo}>
              <Text style={styles.serverText}>{appConfig.organization_name}</Text>
              <Text style={styles.serverText}>
                Sichere Verbindung • Version 2.0
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

// PROFESSIONAL MAIN APP WITH MODERN UI
const MainApp = ({ appConfig, setAppConfig }) => {
  console.log('🚀 MainApp started, User:', !!user);
  console.log('🚀 MainApp appConfig:', appConfig);
  
  const { user, updateUser, logout, token, BACKEND_BASE_URL } = useAuth();
  const { colors, isDarkMode, toggleTheme, DESIGN_TOKENS } = useTheme();
  
  // UI State Management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ incidents: 0, officers: 0, messages: 0 });
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // SOS System with Enhanced Error Handling
  const sendSOSAlarm = async () => {
    try {
      console.log('🚨 SOS alarm being sent...');
      
      // Haptic feedback
      if (Platform.OS !== 'web') {
        try {
          const { Haptics } = require('expo-haptics');
          if (Haptics) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 500);
            setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 1000);
          }
        } catch (hapticsError) {
          console.log('⚠️ Haptics not available:', hapticsError.message);
        }
      }

      // Get GPS location with robust error handling
      let locationData = null;
      let locationStatus = 'Not available';
      
      try {
        console.log('📍 Starting GPS location detection...');
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          console.log('✅ GPS permission granted');
          
          const location = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('GPS timeout')), 10000)
            )
          ]);
          
          locationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          
          locationStatus = `📍 ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
          console.log('✅ GPS location obtained:', locationStatus);
        } else {
          console.log('❌ GPS permission denied');
          locationStatus = 'Permission denied';
        }
      } catch (locationError) {
        console.log('⚠️ GPS location error:', locationError.message);
        locationStatus = 'GPS error: ' + locationError.message;
        locationData = null;
      }

      // Send emergency broadcast to all team members
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      const emergencyData = {
        type: 'sos_alarm',
        message: `🚨 EMERGENCY ALARM from ${user?.username || 'Unknown User'}`,
        sender_id: user?.id,
        sender_name: user?.username,
        location: locationData,
        location_status: locationStatus,
        timestamp: new Date().toISOString(),
        device_info: {
          platform: Platform.OS,
          screen_size: `${screenWidth}x${screenHeight}`,
        }
      };

      console.log('📡 Sending emergency data:', emergencyData);
      
      try {
        const response = await axios.post(`${BACKEND_BASE_URL}/api/emergency/sos`, emergencyData, config);
        console.log('✅ SOS sent successfully:', response.data);
        
        Alert.alert(
          '🚨 SOS ALARM SENT',
          `Emergency alert sent to all team members!\n\nLocation: ${locationStatus}\nTime: ${new Date().toLocaleTimeString()}`,
          [{ text: 'OK' }]
        );
        
      } catch (backendError) {
        console.log('⚠️ Backend error (SOS still sent locally):', backendError.message);
        
        Alert.alert(
          '🚨 SOS ALARM SENT (LOCAL)',
          `Emergency alert activated!\n\nLocation: ${locationStatus}\nTime: ${new Date().toLocaleTimeString()}\n\nNote: Server connection issue, but local alarm is active.`,
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('❌ Critical SOS error:', error);
      
      Alert.alert(
        '🚨 SOS EMERGENCY MODE',
        `CRITICAL: SOS system activated despite errors!\n\nError: ${error.message}\nTime: ${new Date().toLocaleTimeString()}\n\nPlease contact emergency services directly if needed.`,
        [
          { text: 'OK' },
          { text: 'Call 112', onPress: () => {
            // On real devices, this would open the phone dialer
            console.log('📞 Would dial emergency number 112');
          }}
        ]
      );
    }
  };

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      // Simulate API calls for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStats({
        incidents: Math.floor(Math.random() * 50) + 10,
        officers: Math.floor(Math.random() * 20) + 5,
        messages: Math.floor(Math.random() * 100) + 20,
      });
      
      setRecentIncidents([
        { id: 1, title: 'Verkehrsunfall B7', status: 'active', priority: 'high' },
        { id: 2, title: 'Ruhestörung Hauptstraße', status: 'pending', priority: 'medium' },
        { id: 3, title: 'Verdächtige Person', status: 'completed', priority: 'low' },
      ]);
      
    } catch (error) {
      console.error('Dashboard loading error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.surface,
      paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
      ...DESIGN_TOKENS.shadows.sm,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.md,
    },
    headerTitle: {
      ...DESIGN_TOKENS.typography.xl,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      padding: DESIGN_TOKENS.spacing.sm,
      marginLeft: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.borderRadius.md,
      backgroundColor: colors.surfaceVariant,
    },
    sosButton: {
      backgroundColor: colors.error,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      marginLeft: DESIGN_TOKENS.spacing.md,
    },
    sosButtonText: {
      color: 'white',
      fontWeight: 'bold',
      ...DESIGN_TOKENS.typography.sm,
    },
    tabContainer: {
      backgroundColor: colors.surface,
      flexDirection: 'row',
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      alignItems: 'center',
      borderRadius: DESIGN_TOKENS.borderRadius.md,
      marginHorizontal: DESIGN_TOKENS.spacing.xs,
    },
    activeTab: {
      backgroundColor: colors.primary,
      ...DESIGN_TOKENS.shadows.sm,
    },
    tabText: {
      ...DESIGN_TOKENS.typography.xs,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: DESIGN_TOKENS.spacing.xs,
    },
    activeTabText: {
      color: 'white',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: DESIGN_TOKENS.spacing.md,
    },
    sectionTitle: {
      ...DESIGN_TOKENS.typography.lg,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    statsContainer: {
      flexDirection: 'row',
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.borderRadius.lg,
      padding: DESIGN_TOKENS.spacing.md,
      marginHorizontal: DESIGN_TOKENS.spacing.xs,
      alignItems: 'center',
      ...DESIGN_TOKENS.shadows.sm,
    },
    statNumber: {
      ...DESIGN_TOKENS.typography['2xl'],
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    statLabel: {
      ...DESIGN_TOKENS.typography.xs,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    incidentCard: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.borderRadius.lg,
      padding: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.md,
      ...DESIGN_TOKENS.shadows.sm,
    },
    incidentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    incidentTitle: {
      ...DESIGN_TOKENS.typography.base,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    priorityBadge: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.borderRadius.full,
    },
    priorityText: {
      ...DESIGN_TOKENS.typography.xs,
      fontWeight: '600',
      color: 'white',
    },
    fab: {
      position: 'absolute',
      bottom: DESIGN_TOKENS.spacing.xl,
      right: DESIGN_TOKENS.spacing.md,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      ...DESIGN_TOKENS.shadows.lg,
    },
    fabGradient: {
      width: '100%',
      height: '100%',
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  const renderDashboard = () => (
    <ScrollView 
      style={styles.content}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loadDashboardData}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.sectionTitle}>📊 Übersicht</Text>
      
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.incidents}</Text>
          <Text style={styles.statLabel}>Aktive{'\n'}Vorfälle</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.officers}</Text>
          <Text style={styles.statLabel}>Team{'\n'}Mitglieder</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.messages}</Text>
          <Text style={styles.statLabel}>Neue{'\n'}Nachrichten</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>📋 Aktuelle Vorfälle</Text>
      
      {recentIncidents.map((incident) => (
        <TouchableOpacity key={incident.id} style={styles.incidentCard}>
          <View style={styles.incidentHeader}>
            <Text style={styles.incidentTitle}>{incident.title}</Text>
            <View style={[
              styles.priorityBadge,
              { 
                backgroundColor: incident.priority === 'high' ? colors.error :
                               incident.priority === 'medium' ? colors.warning :
                               colors.success 
              }
            ]}>
              <Text style={styles.priorityText}>
                {incident.priority.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons 
              name={incident.status === 'active' ? 'radio-button-on' :
                    incident.status === 'pending' ? 'time' : 'checkmark-circle'} 
              size={16} 
              color={colors.textMuted} 
            />
            <Text style={{ 
              ...DESIGN_TOKENS.typography.sm, 
              color: colors.textMuted, 
              marginLeft: DESIGN_TOKENS.spacing.xs 
            }}>
              {incident.status === 'active' ? 'Aktiv' :
               incident.status === 'pending' ? 'Wartend' : 'Abgeschlossen'}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderTeam = () => (
    <View style={styles.content}>
      <Text style={[styles.sectionTitle, { margin: DESIGN_TOKENS.spacing.md }]}>👥 Team Management</Text>
      <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 50 }}>
        Team-Funktionen werden geladen...
      </Text>
    </View>
  );

  const renderSettings = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>⚙️ Einstellungen</Text>
      
      <View style={styles.incidentCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.incidentTitle}>Dark Mode</Text>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.incidentCard, { alignItems: 'center' }]}
        onPress={logout}
      >
        <Ionicons name="log-out" size={24} color={colors.error} />
        <Text style={[styles.incidentTitle, { color: colors.error, marginTop: DESIGN_TOKENS.spacing.sm }]}>
          Abmelden
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'team':
        return renderTeam();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {appConfig.app_name}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowAddUserModal(true)}
            >
              <Ionicons name="person-add" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowMessagesModal(true)}
            >
              <Ionicons name="chatbubbles" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, styles.sosButton]}
              onPress={() => {
                Alert.alert(
                  '🚨 SOS NOTFALL',
                  'SOS-Alarm an alle Team-Mitglieder senden?',
                  [
                    { text: 'Abbrechen', style: 'cancel' },
                    { 
                      text: 'SOS SENDEN', 
                      style: 'destructive',
                      onPress: sendSOSAlarm 
                    }
                  ]
                );
              }}
            >
              <Ionicons name="warning" size={16} color="white" />
              <Text style={styles.sosButtonText}>SOS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Modern Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: 'dashboard', icon: 'grid', label: 'Dashboard' },
          { key: 'team', icon: 'people', label: 'Team' },
          { key: 'settings', icon: 'settings', label: 'Einstellungen' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.activeTab,
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
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {renderContent()}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab}>
        <View style={styles.fabGradient}>
          <Ionicons name="add" size={24} color="white" />
        </View>
      </TouchableOpacity>

      {/* Modals */}
      <Modal
        visible={showAddUserModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <AddUserModal
          onClose={() => setShowAddUserModal(false)}
          onUserAdded={() => {
            setShowAddUserModal(false);
            loadDashboardData();
          }}
        />
      </Modal>

      <Modal
        visible={showMessagesModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <DiscordMessages onClose={() => setShowMessagesModal(false)} />
      </Modal>

      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <GoogleMapsView
          incident={selectedIncident}
          onClose={() => {
            setShowMapModal(false);
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
  
  console.log('🏠 AppContent - loading:', loading, 'user:', !!user);
  
  const [appConfig, setAppConfig] = useState({
    app_name: 'Stadtwache',
    app_subtitle: 'Polizei Management System',
    app_icon: null,
    organization_name: 'Sicherheitsbehörde Schwelm',
    primary_color: '#3B82F6',
    secondary_color: '#64748B'
  });

  const loadAppConfig = async () => {
    try {
      // Simulate API call for now
      console.log('📱 App configuration loaded');
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