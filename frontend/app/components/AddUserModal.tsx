import React, { useState, useContext, createContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// Mobile-First Responsive Design
const { width: screenWidth } = Dimensions.get('window');
const isMobile = screenWidth < 768;
const isSmallScreen = screenWidth < 400;

// Create a default theme context for fallback
const ThemeContext = createContext(null);

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback theme if context is not available
    return {
      colors: {
        primary: '#1E3A8A',
        background: '#F3F4F6',
        surface: '#FFFFFF',
        card: '#FFFFFF',
        text: '#111827',
        textSecondary: '#374151',
        textMuted: '#6B7280',
        border: '#E5E7EB',
        error: '#EF4444',
        success: '#10B981',
        shadow: 'rgba(0, 0, 0, 0.1)',
      },
      isDarkMode: false,
    };
  }
  return context;
};

interface AddUserModalProps {
  visible: boolean;
  onClose: () => void;
  onUserAdded: () => void;
  token: string;
  theme: any; // Theme object passed from parent
}

const AddUserModal: React.FC<AddUserModalProps> = ({ visible, onClose, onUserAdded, token, theme }) => {
  console.log('🔍 [DEBUG] AddUserModal rendered with visible:', visible);
  console.log('🔍 [DEBUG] AddUserModal props:', { visible, token: !!token, theme: !!theme });
  const colors = theme?.colors || {
    primary: '#1E3A8A',
    background: '#F3F4F6',
    surface: '#FFFFFF',
    text: '#111827',
    textSecondary: '#374151',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    error: '#EF4444',
    success: '#10B981',
  };
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'officer',
    department: '',
    badge_number: '',
    rank: '', // Dienstgrad als Texteingabe
    phone: '',
    photo: '' // base64 encoded profile photo
  });
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  
  const passwordStrength = getPasswordStrength(formData.password);

  const BACKEND_URL = "http://212.227.57.238:8001/api";

  // Image picker functions for user profile photos
  const pickImageForUser = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📸 Berechtigung erforderlich', 'Berechtigung für Galerie-Zugriff erforderlich');
        return null;
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
        return null;
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

  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      role: 'officer',
      department: '',
      badge_number: '',
      rank: '',
      phone: '',
      photo: ''
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateForm = () => {
    console.log('🔍 [DEBUG] Validation started');
    console.log('🔍 [DEBUG] FormData für Validation:', formData);
    
    if (!formData.email || !formData.username || !formData.password) {
      console.log('❌ [DEBUG] Pflichtfelder fehlen');
      Alert.alert('⚠️ Fehler', 'Bitte füllen Sie alle Pflichtfelder aus');
      return false;
    }

    if (formData.password.length < 6) {
      console.log('❌ [DEBUG] Passwort zu kurz');
      Alert.alert('⚠️ Fehler', 'Passwort muss mindestens 6 Zeichen lang sein');
      return false;
    }

    // TEMPORÄR DEAKTIVIERT für Debug
    // if (formData.password !== formData.confirmPassword) {
    //   console.log('❌ [DEBUG] Passwörter stimmen nicht überein');
    //   Alert.alert('⚠️ Fehler', 'Passwörter stimmen nicht überein');
    //   return false;
    // }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      console.log('❌ [DEBUG] Email ungültig');
      Alert.alert('⚠️ Fehler', 'Bitte geben Sie eine gültige E-Mail-Adresse ein');
      return false;
    }

    console.log('✅ [DEBUG] Validation erfolgreich');
    return true;
  };

  const handleSubmit = async () => {
    console.log('🆕 [DEBUG] handleSubmit gestartet');
    console.log('🆕 [DEBUG] FormData:', formData);
    
    if (!validateForm()) {
      console.log('❌ [DEBUG] Validation fehlgeschlagen');
      return;
    }
    
    console.log('✅ [DEBUG] Validation erfolgreich');
    setLoading(true);

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const userData = {
        email: formData.email,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        department: formData.department || null,
        team: formData.team || null,
        badge_number: formData.badge_number || null,
        rank: formData.rank || null,
        phone: formData.phone || null
      };

      console.log('👤 Creating user:', userData);

      const response = await axios.post(`${BACKEND_URL}/auth/register`, userData, config);
      
      console.log('✅ User created successfully:', response.data);

      Alert.alert(
        '✅ Erfolg!',
        `Benutzer "${formData.username}" wurde erfolgreich erstellt!`,
        [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              onUserAdded();
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error creating user:', error);
      
      let errorMessage = 'Benutzer konnte nicht erstellt werden';
      
      if (error.response?.data?.detail) {
        if (error.response.data.detail.includes('email')) {
          errorMessage = 'E-Mail-Adresse wird bereits verwendet';
        } else if (error.response.data.detail.includes('badge_number')) {
          errorMessage = 'Dienstnummer wird bereits verwendet';
        } else {
          errorMessage = error.response.data.detail;
        }
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.';
      }

      Alert.alert('❌ Fehler', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
    },
    saveButton: {
      backgroundColor: colors.secondary, // System-Farbe statt primary
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      marginTop: 8,
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
    required: {
      color: colors.error,
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
    formInputFocused: {
      borderColor: colors.primary,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    passwordInput: {
      flex: 1,
    },
    passwordToggle: {
      position: 'absolute',
      right: 16,
      padding: 4,
    },
    roleSelector: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    roleOption: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    roleOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
    },
    roleOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    roleOptionTextActive: {
      color: colors.primary,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.secondary, // System-Farbe statt primary
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
    infoCard: {
      backgroundColor: colors.primary + '15',
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    passwordStrength: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    strengthIndicator: {
      height: 4,
      flex: 1,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginRight: 8,
    },
    strengthWeak: {
      backgroundColor: colors.error,
    },
    strengthMedium: {
      backgroundColor: '#F59E0B',
    },
    strengthStrong: {
      backgroundColor: colors.success,
    },
    strengthText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
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
    profilePhotoPreview: {
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
    pickerButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pickerButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    pickerButtonTextActive: {
      color: '#FFFFFF',
    },
  });

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, text: '' };
    if (password.length < 6) return { strength: 1, text: 'Schwach' };
    if (password.length >= 6 && password.length < 10) return { strength: 2, text: 'Mittel' };
    return { strength: 3, text: 'Stark' };
  };

  // MOBILE OPTIMIZED: Debugging und korrektes Modal Rendering  
  if (!visible) {
    console.log('🔍 [DEBUG] Modal nicht sichtbar, returning null');
    return null;
  }

  console.log('✅ [DEBUG] Modal wird gerendert!');

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{
        flex: 1,
        backgroundColor: colors.background,
      }}>
        {/* MOBILE OPTIMIZED HEADER */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: isSmallScreen ? 16 : 20,
          paddingVertical: isSmallScreen ? 12 : 16,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 4,
        }}>
          <TouchableOpacity 
            onPress={handleClose}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: colors.border,
            }}
          >
            <Ionicons name="close" size={isSmallScreen ? 22 : 24} color={colors.text} />
          </TouchableOpacity>
          
          <Text style={{
            fontSize: isSmallScreen ? 18 : 20,
            fontWeight: 'bold',
            color: colors.text,
            flex: 1,
            textAlign: 'center',
            marginHorizontal: 16,
          }}>
            👤 Benutzer hinzufügen
          </Text>
          
          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: loading ? colors.border : colors.success,
              paddingHorizontal: isSmallScreen ? 12 : 16,
              paddingVertical: isSmallScreen ? 8 : 10,
              borderRadius: 8,
              minWidth: isSmallScreen ? 80 : 100,
              alignItems: 'center',
            }}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={{
                color: 'white',
                fontWeight: '600',
                fontSize: isSmallScreen ? 14 : 16,
              }}>
                Speichern
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* MOBILE OPTIMIZED CONTENT */}
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: isSmallScreen ? 16 : 20,
              paddingBottom: isSmallScreen ? 40 : 60,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Info Card */}
            <View style={{
              backgroundColor: colors.primary + '10',
              padding: isSmallScreen ? 12 : 16,
              borderRadius: 12,
              marginBottom: isSmallScreen ? 20 : 24,
              borderLeftWidth: 4,
              borderLeftColor: colors.primary,
            }}>
              <Text style={{
                fontSize: isSmallScreen ? 14 : 16,
                color: colors.text,
                lineHeight: isSmallScreen ? 20 : 22,
              }}>
                🔐 Erstellen Sie einen neuen Benutzer für das Stadtwache-System. 
                Alle mit * markierten Felder sind erforderlich.
              </Text>
            </View>

            {/* Basic Information Section */}
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: isSmallScreen ? 16 : 20,
              marginBottom: isSmallScreen ? 16 : 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}>
              <Text style={{
                fontSize: isSmallScreen ? 18 : 20,
                fontWeight: 'bold',
                color: colors.text,
                marginBottom: isSmallScreen ? 16 : 20,
              }}>
                📋 Grunddaten
              </Text>

              {/* Email */}
              <View style={{ marginBottom: isSmallScreen ? 16 : 20 }}>
                <Text style={{
                  fontSize: isSmallScreen ? 14 : 16,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 8,
                }}>
                  📧 E-Mail Adresse <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: isSmallScreen ? 12 : 16,
                    paddingVertical: isSmallScreen ? 12 : 14,
                    fontSize: isSmallScreen ? 16 : 18,
                    color: colors.text,
                    minHeight: 48, // Mobile touch target
                  }}
                  value={formData.email}
                  onChangeText={(text) => updateField('email', text)}
                  placeholder="benutzer@stadtwache.de"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Username */}
              <View style={{ marginBottom: isSmallScreen ? 16 : 20 }}>
                <Text style={{
                  fontSize: isSmallScreen ? 14 : 16,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 8,
                }}>
                  👤 Benutzername <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: isSmallScreen ? 12 : 16,
                    paddingVertical: isSmallScreen ? 12 : 14,
                    fontSize: isSmallScreen ? 16 : 18,
                    color: colors.text,
                    minHeight: 48,
                  }}
                  value={formData.username}
                  onChangeText={(text) => updateField('username', text)}
                  placeholder="Max Mustermann"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </View>

              {/* Password */}
              <View style={{ marginBottom: isSmallScreen ? 16 : 20 }}>
                <Text style={{
                  fontSize: isSmallScreen ? 14 : 16,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 8,
                }}>
                  🔒 Passwort <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingHorizontal: isSmallScreen ? 12 : 16,
                      paddingVertical: isSmallScreen ? 12 : 14,
                      fontSize: isSmallScreen ? 16 : 18,
                      color: colors.text,
                      minHeight: 48,
                      paddingRight: 50,
                    }}
                    value={formData.password}
                    onChangeText={(text) => updateField('password', text)}
                    placeholder="Mindestens 6 Zeichen"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPasswords}
                  />
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: isSmallScreen ? 12 : 14,
                      padding: 4,
                    }}
                    onPress={() => setShowPasswords(!showPasswords)}
                  >
                    <Ionicons 
                      name={showPasswords ? "eye-off" : "eye"} 
                      size={20} 
                      color={colors.textMuted} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={{ marginBottom: isSmallScreen ? 12 : 16 }}>
                <Text style={{
                  fontSize: isSmallScreen ? 14 : 16,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 8,
                }}>
                  🔒 Passwort bestätigen <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: isSmallScreen ? 12 : 16,
                    paddingVertical: isSmallScreen ? 12 : 14,
                    fontSize: isSmallScreen ? 16 : 18,
                    color: colors.text,
                    minHeight: 48,
                  }}
                  value={formData.confirmPassword}
                  onChangeText={(text) => updateField('confirmPassword', text)}
                  placeholder="Passwort wiederholen"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPasswords}
                />
              </View>
            </View>

            {/* Role & Department Section */}
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: isSmallScreen ? 16 : 20,
              marginBottom: isSmallScreen ? 16 : 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}>
              <Text style={{
                fontSize: isSmallScreen ? 18 : 20,
                fontWeight: 'bold',
                color: colors.text,
                marginBottom: isSmallScreen ? 16 : 20,
              }}>
                🏢 Rolle & Abteilung
              </Text>

              {/* Role Selection */}
              <View style={{ marginBottom: isSmallScreen ? 16 : 20 }}>
                <Text style={{
                  fontSize: isSmallScreen ? 14 : 16,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 12,
                }}>
                  🎖️ Rolle
                </Text>
                <View style={{
                  flexDirection: isSmallScreen ? 'column' : 'row',
                  gap: isSmallScreen ? 8 : 12,
                }}>
                  {['officer', 'admin', 'dispatcher'].map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={{
                        backgroundColor: formData.role === role ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor: formData.role === role ? colors.primary : colors.border,
                        borderRadius: 8,
                        paddingHorizontal: isSmallScreen ? 16 : 20,
                        paddingVertical: isSmallScreen ? 12 : 14,
                        flex: isSmallScreen ? 0 : 1,
                        alignItems: 'center',
                        minHeight: 48,
                        justifyContent: 'center',
                      }}
                      onPress={() => updateField('role', role)}
                    >
                      <Text style={{
                        color: formData.role === role ? 'white' : colors.text,
                        fontWeight: '600',
                        fontSize: isSmallScreen ? 14 : 16,
                      }}>
                        {role === 'officer' ? '👮 Beamter' : 
                         role === 'admin' ? '⚙️ Admin' : 
                         '📡 Dispatcher'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Department */}
              <View style={{ marginBottom: isSmallScreen ? 16 : 20 }}>
                <Text style={{
                  fontSize: isSmallScreen ? 14 : 16,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 8,
                }}>
                  🏢 Abteilung
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: isSmallScreen ? 12 : 16,
                    paddingVertical: isSmallScreen ? 12 : 14,
                    fontSize: isSmallScreen ? 16 : 18,
                    color: colors.text,
                    minHeight: 48,
                  }}
                  value={formData.department}
                  onChangeText={(text) => updateField('department', text)}
                  placeholder="z.B. Streifendienst, Kriminalpolizei"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Dienstgrad */}
              <View style={{ marginBottom: isSmallScreen ? 16 : 20 }}>
                <Text style={{
                  fontSize: isSmallScreen ? 14 : 16,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 8,
                }}>
                  🎖️ Dienstgrad
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: isSmallScreen ? 12 : 16,
                    paddingVertical: isSmallScreen ? 12 : 14,
                    fontSize: isSmallScreen ? 16 : 18,
                    color: colors.text,
                    minHeight: 48,
                  }}
                  value={formData.rank}
                  onChangeText={(text) => updateField('rank', text)}
                  placeholder="z.B. Polizeihauptmeister, Kommissar"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Phone */}
              <View>
                <Text style={{
                  fontSize: isSmallScreen ? 14 : 16,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 8,
                }}>
                  📞 Telefonnummer
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: isSmallScreen ? 12 : 16,
                    paddingVertical: isSmallScreen ? 12 : 14,
                    fontSize: isSmallScreen ? 16 : 18,
                    color: colors.text,
                    minHeight: 48,
                  }}
                  value={formData.phone}
                  onChangeText={(text) => updateField('phone', text)}
                  placeholder="+49 123 456789"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Submit Button for Mobile */}
            {isSmallScreen && (
              <TouchableOpacity 
                onPress={handleSubmit}
                disabled={loading}
                style={{
                  backgroundColor: loading ? colors.border : colors.success,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 20,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={{
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 18,
                  }}>
                    👤 Benutzer erstellen
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

export default AddUserModal;