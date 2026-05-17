import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, TextInput, Switch, StyleSheet, FlatList, Pressable, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DSColors, DSLayout, DSShape, DSShadowSoft, DSTypography } from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { putPatientPreset, getDoctorPatient, getPatientPreset, getPatientSessions } from '@/services/apiClient';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ManagePatientScreen({ patientIdProp, embedded = false, onClose }: { patientIdProp?: number; embedded?: boolean; onClose?: () => void } = {}) {
  const params = useLocalSearchParams();
  const routeId = params?.id;
  const patientId = typeof patientIdProp === 'number' ? patientIdProp : Number(routeId);
  const { authToken } = useAuth();

  const [planStart, setPlanStart] = useState('');
  const [planEnd, setPlanEnd] = useState('');
  const [sessionsPerDay, setSessionsPerDay] = useState('1');
  const [daysOfWeek, setDaysOfWeek] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [isSaving, setIsSaving] = useState(false);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [patientHn, setPatientHn] = useState<string | null>(null);
  // Preset fields
  const [targetFlexion, setTargetFlexion] = useState<string>('120');
  const [targetExtension, setTargetExtension] = useState<string>('0');
  const [speedLevel, setSpeedLevel] = useState<string>('5');
  const [durationMinutes, setDurationMinutes] = useState<string>('10');
  const [forceLevel, setForceLevel] = useState<string>('1');
  const [targetForceN, setTargetForceN] = useState<string>('70');
  const [useWarmup, setUseWarmup] = useState<boolean>(true);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    // Could fetch existing preset for patient and populate fields. Skipping for MVP.
  }, [patientId]);

  useEffect(() => {
    async function fetchPatient() {
      if (!authToken || Number.isNaN(patientId)) return;
      const res = await getDoctorPatient(authToken, patientId);
      if (res.success && res.data) {
        setPatientName((res.data as any).name ?? null);
        setPatientHn((res.data as any).hnCode ?? null);
      }
    }
    fetchPatient();
  }, [authToken, patientId]);

  useEffect(() => {
    async function fetchPresetAndSessions() {
      if (Number.isNaN(patientId)) return;
      const presetRes = await getPatientPreset(patientId);
      if (presetRes.success && presetRes.data) {
        const p = presetRes.data;
        setTargetFlexion(String(p.targetFlexion ?? 120));
        setTargetExtension(String(p.targetExtension ?? 0));
        setSpeedLevel(String(p.speedLevel ?? 5));
        setDurationMinutes(String(p.durationMinutes ?? 10));
        setUseWarmup(Boolean(p.useWarmup ?? true));
        setTargetForceN(String(p.targetForceN ?? 70));
        setForceLevel(String(p.forceLevel ?? 1));
      }

      const sessRes = await getPatientSessions(patientId, { limit: 20 });
      if (sessRes.success && Array.isArray(sessRes.data)) {
        setSessions(sessRes.data as any[]);
      }
    }
    fetchPresetAndSessions();
  }, [patientId]);

  async function handleSave() {
    if (!authToken) return;
    setIsSaving(true);
    try {
      const days = daysOfWeek.reduce<number[]>((acc, v, i) => (v ? acc.concat(i) : acc), []);
      const payload: any = {
        targetFlexion: Number(targetFlexion) || 120,
        targetExtension: Number(targetExtension) || 0,
        speedLevel: Number(speedLevel) || 5,
        durationMinutes: Number(durationMinutes) || 10,
        useWarmup: Boolean(useWarmup),
        targetForceN: targetForceN ? Number(targetForceN) : null,
        forceLevel: forceLevel ? Number(forceLevel) : null,
        startDate: planStart || undefined,
        endDate: planEnd || undefined,
        sessionsPerDay: Number(sessionsPerDay) || 1,
        daysOfWeek: days.length ? days : undefined,
      };

      const res = await putPatientPreset(authToken!, patientId, payload);
      if (!res.success) {
        alert(res.error || 'ไม่สามารถบันทึกแผนได้');
        return;
      }

      // Refresh sessions after saving preset
      const sessRes = await getPatientSessions(patientId, { limit: 20 });
      if (sessRes.success && Array.isArray(sessRes.data)) setSessions(sessRes.data as any[]);

      alert('บันทึกแผนสำเร็จ');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดขณะบันทึกแผน');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: embedded ? 0 : 1, backgroundColor: embedded ? 'transparent' : undefined }}>
      <ThemedView style={[styles.container, embedded && styles.embeddedContainer]}>
        <View style={styles.headerRow}>
          <ThemedText type="title" style={styles.heading}>{'จัดการแผนผู้ป่วย #'}{patientId}</ThemedText>
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>ปิด</Text>
            </Pressable>
          )}
        </View>
        {patientName && <ThemedText type="default" style={styles.meta}>ชื่อ: {patientName}</ThemedText>}
        {patientHn && <ThemedText type="caption" style={styles.meta}>HN: {patientHn}</ThemedText>}

        <Text style={{ ...DSTypography.caption, marginBottom: 6 }}>PRESCRIPTION (PHASE 1)</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text>Target Flexion (°)</Text>
            <TextInput value={targetFlexion} onChangeText={setTargetFlexion} style={styles.input} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text>Target Extension (°)</Text>
            <TextInput value={targetExtension} onChangeText={setTargetExtension} style={styles.input} keyboardType="numeric" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text>Speed (1–10)</Text>
            <TextInput value={speedLevel} onChangeText={setSpeedLevel} style={styles.input} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text>Duration (min)</Text>
            <TextInput value={durationMinutes} onChangeText={setDurationMinutes} style={styles.input} keyboardType="numeric" />
          </View>
          <View style={{ width: 120 }}>
            <Text>Force Level (1–10)</Text>
            <TextInput value={forceLevel} onChangeText={setForceLevel} style={styles.input} keyboardType="numeric" />
          </View>
        </View>

        <Text style={{ marginBottom: 6 }}>Max Resistance Force (N)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <TextInput value={targetForceN} onChangeText={setTargetForceN} style={[styles.input, { flex: 1 }]} keyboardType="numeric" />
          <Text style={{ width: 48 }}>{targetForceN} N</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Switch value={useWarmup} onValueChange={setUseWarmup} />
          <Text style={{ marginLeft: 8 }}>Warm-up mode</Text>
        </View>

        <View style={{ marginBottom: 18 }}>
          <Pressable
            onPress={() => { if (!isSaving) handleSave(); }}
            style={({ pressed }) => [
              styles.primaryButton,
              { opacity: isSaving ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.primaryButtonText}>{isSaving ? 'กำลังบันทึก...' : 'Save & Send to Machine'}</Text>
          </Pressable>
        </View>

        <ThemedText type="caption" style={styles.sectionLabel}>PROGRESS — TARGET VS ACTUAL FLEXION (LAST 7 SESSIONS)</ThemedText>
        <ThemedView style={styles.chartCard}>
          <ThemedText type="caption" style={{ color: DSColors.text.secondary }}>Chart placeholder (use react-native-chart-kit)</ThemedText>
        </ThemedView>

        <ThemedText type="caption" style={styles.sectionLabel}>SESSION HISTORY</ThemedText>
        {sessions.length === 0 ? (
          <ThemedText type="default" style={styles.empty}>ยังไม่มีประวัติการบำบัด</ThemedText>
        ) : (
          embedded ? (
            <View>
              {sessions.map((item) => (
                <ThemedView key={String((item as any).id)} style={styles.sessionRow}>
                  <Text style={styles.sessionDate}>{new Date((item as any).sessionDate).toLocaleString()}</Text>
                  <Text style={styles.sessionText}>Actual Max Flexion: {(item as any).actualMaxFlexion}</Text>
                  <Text style={styles.sessionText}>Status: {(item as any).sessionStatus}</Text>
                </ThemedView>
              ))}
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(s) => String((s as any).id)}
              nestedScrollEnabled
              renderItem={({ item }) => (
                <ThemedView style={styles.sessionRow}>
                  <Text style={styles.sessionDate}>{new Date((item as any).sessionDate).toLocaleString()}</Text>
                  <Text style={styles.sessionText}>Actual Max Flexion: {(item as any).actualMaxFlexion}</Text>
                  <Text style={styles.sessionText}>Status: {(item as any).sessionStatus}</Text>
                </ThemedView>
              )}
            />
          )
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: DSLayout.screenPadding,
    backgroundColor: DSColors.background,
  },
  heading: {
    ...DSTypography.h2,
    marginBottom: 8,
    color: DSColors.text.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeButton: {
    borderWidth: 1,
    borderColor: DSColors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
  },
  closeButtonText: {
    color: DSColors.text.primary,
    fontWeight: '600',
  },
  meta: {
    ...DSTypography.body,
    marginBottom: 8,
    color: DSColors.text.secondary,
  },
  label: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 6,
  },
  sectionLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: DSColors.border,
    padding: 10,
    borderRadius: DSShape.radiusButton,
    marginBottom: 8,
    backgroundColor: DSColors.surface,
    color: DSColors.text.primary,
  },
  chartCard: {
    height: 160,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    borderWidth: 1,
    borderColor: DSColors.border,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...DSShadowSoft,
  },
  empty: {
    color: DSColors.text.secondary,
    marginBottom: 12,
  },
  sessionRow: {
    padding: 12,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  sessionDate: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 6,
  },
  sessionText: {
    ...DSTypography.body,
    color: DSColors.text.primary,
  },
  primaryButton: {
    backgroundColor: DSColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: DSColors.text.inverse,
    fontWeight: '700',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: DSColors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
    marginRight: 8,
  },
  embeddedContainer: {
    backgroundColor: 'transparent',
    padding: 0,
    flex: 0,
  },
});
