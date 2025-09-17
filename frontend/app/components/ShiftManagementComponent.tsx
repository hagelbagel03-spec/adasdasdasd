import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const ShiftManagementComponent = ({ user, token, API_URL, colors }) => {
  const [vacations, setVacations] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  
  const [vacationFormData, setVacationFormData] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      // Lade Urlaubsanträge
      const vacationsResponse = await axios.get(`${API_URL}/api/vacations`, config);
      setVacations(vacationsResponse.data || []);

      // Lade Check-Ins
      const checkinsResponse = await axios.get(`${API_URL}/api/checkins`, config);
      setCheckins(checkinsResponse.data || []);
      
      if (checkinsResponse.data && checkinsResponse.data.length > 0) {
        setLastCheckIn(checkinsResponse.data[0].timestamp);
      }

    } catch (error) {
      console.error('❌ Error loading shift data:', error);
      Alert.alert('❌ Fehler', 'Schichtdaten konnten nicht geladen werden');
    }
  };

  const performCheckIn = async (status = 'ok') => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const response = await axios.post(`${API_URL}/api/checkin`, { status }, config);
      
      if (response.data) {
        setLastCheckIn(new Date().toISOString());
        Alert.alert('✅ Check-In erfolgreich', 'Ihr Status wurde aktualisiert.');
        await loadData(); // Reload data
      }

    } catch (error) {
      console.error('❌ Check-In error:', error);
      Alert.alert('❌ Fehler', 'Check-In konnte nicht übertragen werden.');
    }
  };

  const requestVacation = async () => {
    if (!vacationFormData.start_date || !vacationFormData.end_date || !vacationFormData.reason) {
      Alert.alert('⚠️ Fehler', 'Bitte füllen Sie alle Felder aus');
      return;
    }

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const response = await axios.post(`${API_URL}/api/vacations`, vacationFormData, config);
      
      if (response.data) {
        Alert.alert('✅ Erfolg', 'Urlaubsantrag wurde eingereicht!');
        setShowVacationModal(false);
        setVacationFormData({ start_date: '', end_date: '', reason: '' });
        await loadData();
      }

    } catch (error) {
      console.error('❌ Vacation request error:', error);
      Alert.alert('❌ Fehler', 'Urlaubsantrag konnte nicht eingereicht werden.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return colors.success;
      case 'rejected': return colors.error;
      case 'pending': return colors.warning;
      case 'ok': return colors.success;
      case 'help_needed': return colors.error;
      case 'emergency': return colors.error;
      default: return colors.textMuted;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return '✅ Genehmigt';
      case 'rejected': return '❌ Abgelehnt';
      case 'pending': return '⏳ Ausstehend';
      case 'ok': return '✅ Alles OK';
      case 'help_needed': return '🚨 Hilfe benötigt';
      case 'emergency': return '🚨 Notfall';
      default: return status;
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginLeft: 12,
      color: colors.text,
    },
    quickActions: {
      flexDirection: 'row',
      padding: 16,
      justifyContent: 'space-around',
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      marginHorizontal: 4,
      borderRadius: 8,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      marginLeft: 8,
    },
    statusCard: {
      backgroundColor: colors.surface,
      margin: 16,
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    statusText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    section: {
      backgroundColor: colors.surface,
      margin: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      padding: 16,
      paddingBottom: 8,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textMuted,
      padding: 32,
      fontStyle: 'italic',
    },
    vacationCard: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    vacationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    vacationDates: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    vacationReason: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 8,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    checkinCard: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    checkinHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    checkinTime: {
      fontSize: 14,
      color: colors.text,
    },
    checkinMessage: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: '90%',
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    modalContent: {
      padding: 16,
    },
    formGroup: {
      marginBottom: 16,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.background,
      color: colors.text,
    },
    multilineInput: {
      height: 80,
      textAlignVertical: 'top',
    },
    submitButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 16,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <ScrollView style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <Ionicons name="time" size={32} color={colors.primary} />
        <Text style={dynamicStyles.title}>Schichtverwaltung</Text>
      </View>

      {/* Quick Actions */}
      <View style={dynamicStyles.quickActions}>
        <TouchableOpacity 
          style={[dynamicStyles.actionButton, { backgroundColor: colors.success }]}
          onPress={() => performCheckIn('ok')}
        >
          <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          <Text style={dynamicStyles.actionButtonText}>✅ Check-In</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[dynamicStyles.actionButton, { backgroundColor: colors.warning }]}
          onPress={() => setShowVacationModal(true)}
        >
          <Ionicons name="calendar" size={24} color="#FFFFFF" />
          <Text style={dynamicStyles.actionButtonText}>📅 Urlaub</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[dynamicStyles.actionButton, { backgroundColor: colors.error }]}
          onPress={() => performCheckIn('help_needed')}
        >
          <Ionicons name="warning" size={24} color="#FFFFFF" />
          <Text style={dynamicStyles.actionButtonText}>🚨 Hilfe</Text>
        </TouchableOpacity>
      </View>

      {/* Last Check-In Status */}
      <View style={dynamicStyles.statusCard}>
        <Text style={dynamicStyles.cardTitle}>📍 Letzter Check-In</Text>
        <Text style={dynamicStyles.statusText}>
          {lastCheckIn 
            ? new Date(lastCheckIn).toLocaleString('de-DE')
            : 'Noch kein Check-In heute'
          }
        </Text>
      </View>

      {/* Vacation Requests */}
      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>📅 Meine Urlaubsanträge</Text>
        {vacations.length === 0 ? (
          <Text style={dynamicStyles.emptyText}>Keine Urlaubsanträge vorhanden</Text>
        ) : (
          vacations.map((vacation) => (
            <View key={vacation.id} style={dynamicStyles.vacationCard}>
              <View style={dynamicStyles.vacationHeader}>
                <Text style={dynamicStyles.vacationDates}>
                  {vacation.start_date} - {vacation.end_date}
                </Text>
                <View style={[dynamicStyles.statusBadge, { backgroundColor: getStatusColor(vacation.status) }]}>
                  <Text style={dynamicStyles.statusBadgeText}>{getStatusText(vacation.status)}</Text>
                </View>
              </View>
              <Text style={dynamicStyles.vacationReason}>{vacation.reason}</Text>
            </View>
          ))
        )}
      </View>

      {/* Recent Check-Ins */}
      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>📋 Letzte Check-Ins</Text>
        {checkins.slice(0, 5).map((checkin) => (
          <View key={checkin.id} style={dynamicStyles.checkinCard}>
            <View style={dynamicStyles.checkinHeader}>
              <Text style={dynamicStyles.checkinTime}>
                {new Date(checkin.timestamp).toLocaleString('de-DE')}
              </Text>
              <View style={[dynamicStyles.statusBadge, { backgroundColor: getStatusColor(checkin.status) }]}>
                <Text style={dynamicStyles.statusBadgeText}>{getStatusText(checkin.status)}</Text>
              </View>
            </View>
            {checkin.message && (
              <Text style={dynamicStyles.checkinMessage}>{checkin.message}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Vacation Request Modal */}
      <Modal
        visible={showVacationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVacationModal(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContainer}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>📅 Urlaubsantrag</Text>
              <TouchableOpacity 
                style={dynamicStyles.closeButton}
                onPress={() => setShowVacationModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalContent}>
              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>Startdatum (YYYY-MM-DD)</Text>
                <TextInput
                  style={dynamicStyles.input}
                  value={vacationFormData.start_date}
                  onChangeText={(text) => setVacationFormData({...vacationFormData, start_date: text})}
                  placeholder="2024-12-01"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>Enddatum (YYYY-MM-DD)</Text>
                <TextInput
                  style={dynamicStyles.input}
                  value={vacationFormData.end_date}
                  onChangeText={(text) => setVacationFormData({...vacationFormData, end_date: text})}
                  placeholder="2024-12-07"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>Grund</Text>
                <TextInput
                  style={[dynamicStyles.input, dynamicStyles.multilineInput]}
                  value={vacationFormData.reason}
                  onChangeText={(text) => setVacationFormData({...vacationFormData, reason: text})}
                  placeholder="Urlaub, Krank, Fortbildung..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity 
                style={dynamicStyles.submitButton}
                onPress={requestVacation}
              >
                <Text style={dynamicStyles.submitButtonText}>📤 Antrag einreichen</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default ShiftManagementComponent;
