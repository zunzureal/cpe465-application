/**
 * Doctor Prescription Form — set CPM parameters and save/send to patient.
 * Pre-fills from existing active preset. Creates new preset (POST) if none exists,
 * updates in-place (PUT) otherwise.
 */

import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  DSColors,
  DSLayout,
  DSShadowSoft,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPatientPreset,
  createPreset,
  updatePreset,
  type PresetPayload,
} from '@/services/apiClient';

interface Props {
  patientId: number;
}

interface FormState {
  targetFlexion: string;
  targetExtension: string;
  speedLevel: string;
  durationMinutes: string;
  useWarmup: boolean;
  targetForceN: string;
}

const SPEED_OPTIONS = [1, 2, 3, 4, 5];

export function DoctorPrescriptionForm({ patientId }: Props) {
  const router = useRouter();
  const { authToken } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingPreset, setHasExistingPreset] = useState(false);
  const [form, setForm] = useState<FormState>({
    targetFlexion: '',
    targetExtension: '',
    speedLevel: '3',
    durationMinutes: '',
    useWarmup: true,
    targetForceN: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    let cancelled = false;

    getPatientPreset(patientId)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setHasExistingPreset(true);
          const p = res.data;
          setForm({
            targetFlexion: String(p.targetFlexion),
            targetExtension: String(p.targetExtension),
            speedLevel: String(p.speedLevel),
            durationMinutes: String(p.durationMinutes),
            useWarmup: p.useWarmup,
            targetForceN: p.targetForceN != null ? String(p.targetForceN) : '',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};

    const flex = Number(form.targetFlexion);
    if (!form.targetFlexion || isNaN(flex) || flex < 0 || flex > 120)
      next.targetFlexion = 'กรอก 0–120 องศา';

    const ext = Number(form.targetExtension);
    if (!form.targetExtension || isNaN(ext) || ext < 0 || ext > 30)
      next.targetExtension = 'กรอก 0–30 องศา';

    const dur = Number(form.durationMinutes);
    if (!form.durationMinutes || isNaN(dur) || dur < 1 || dur > 60)
      next.durationMinutes = 'กรอก 1–60 นาที';

    if (form.targetForceN !== '') {
      const force = Number(form.targetForceN);
      if (isNaN(force) || force < 0 || force > 50)
        next.targetForceN = 'กรอก 0–50 N หรือเว้นว่างเพื่อปิด';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    if (!authToken) {
      Alert.alert('ข้อผิดพลาด', 'ไม่มีสิทธิ์เข้าถึง');
      return;
    }

    const payload: PresetPayload = {
      targetFlexion: Number(form.targetFlexion),
      targetExtension: Number(form.targetExtension),
      speedLevel: Number(form.speedLevel),
      durationMinutes: Number(form.durationMinutes),
      useWarmup: form.useWarmup,
      targetForceN: form.targetForceN !== '' ? Number(form.targetForceN) : null,
    };

    setIsSaving(true);
    try {
      const res = hasExistingPreset
        ? await updatePreset(patientId, payload, authToken)
        : await createPreset(patientId, payload, authToken);

      if (res.success) {
        setHasExistingPreset(true);
        Alert.alert('สำเร็จ', 'บันทึกแผนการรักษาเรียบร้อย', [
          { text: 'ตกลง', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('ข้อผิดพลาด', res.error ?? 'ไม่สามารถบันทึกได้');
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={DSColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Nav bar */}
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={DSColors.primary} />
            <Text style={styles.backLabel}>ย้อนกลับ</Text>
          </Pressable>
          <View style={styles.navTitle}>
            <Text style={styles.title}>ใบสั่งยา</Text>
            <Text style={styles.subtitle}>Prescription Form</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {hasExistingPreset && (
            <View style={[styles.infoBanner, DSShadowSoft]}>
              <Ionicons name="information-circle" size={18} color={DSColors.primary} />
              <Text style={styles.infoBannerText}>กำลังแก้ไขแผนปัจจุบัน (PUT)</Text>
            </View>
          )}

          {/* ROM */}
          <SectionHeader title="ช่วงการเคลื่อนไหว · Range of Motion" />
          <View style={[styles.card, DSShadowSoft]}>
            <FieldRow
              label="Flexion เป้าหมาย (°)"
              hint="0 – 120 องศา"
              value={form.targetFlexion}
              onChangeText={(v) => setForm((f) => ({ ...f, targetFlexion: v }))}
              error={errors.targetFlexion}
              keyboardType="numeric"
            />
            <View style={styles.fieldDivider} />
            <FieldRow
              label="Extension เป้าหมาย (°)"
              hint="0 – 30 องศา"
              value={form.targetExtension}
              onChangeText={(v) => setForm((f) => ({ ...f, targetExtension: v }))}
              error={errors.targetExtension}
              keyboardType="numeric"
            />
          </View>

          {/* Speed */}
          <SectionHeader title="ความเร็ว · Speed Level" />
          <View style={[styles.card, DSShadowSoft]}>
            <View style={styles.speedRow}>
              {SPEED_OPTIONS.map((level) => (
                <Pressable
                  key={level}
                  style={[
                    styles.speedBtn,
                    form.speedLevel === String(level) && styles.speedBtnActive,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, speedLevel: String(level) }))}
                >
                  <Text
                    style={[
                      styles.speedBtnLabel,
                      form.speedLevel === String(level) && styles.speedBtnLabelActive,
                    ]}
                  >
                    {level}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.speedHint}>ระดับ 1 = ช้าสุด · ระดับ 5 = เร็วสุด</Text>
          </View>

          {/* Duration & warmup */}
          <SectionHeader title="เวลา & Warm-up" />
          <View style={[styles.card, DSShadowSoft]}>
            <FieldRow
              label="ระยะเวลา (นาที)"
              hint="1 – 60 นาที"
              value={form.durationMinutes}
              onChangeText={(v) => setForm((f) => ({ ...f, durationMinutes: v }))}
              error={errors.durationMinutes}
              keyboardType="numeric"
            />
            <View style={styles.fieldDivider} />
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.fieldLabel}>โหมด Warm-up</Text>
                <Text style={styles.fieldHint}>เริ่มต้นด้วยการเคลื่อนไหวช้าๆ ก่อน</Text>
              </View>
              <Switch
                value={form.useWarmup}
                onValueChange={(v) => setForm((f) => ({ ...f, useWarmup: v }))}
                trackColor={{ false: DSColors.border, true: DSColors.primaryLight }}
                thumbColor={form.useWarmup ? DSColors.primary : DSColors.text.secondary}
              />
            </View>
          </View>

          {/* Force */}
          <SectionHeader title="แรง · Force (ไม่บังคับ)" />
          <View style={[styles.card, DSShadowSoft]}>
            <FieldRow
              label="แรงเป้าหมาย (N)"
              hint="0 – 50 N · เว้นว่างเพื่อปิดโหมดแรง"
              value={form.targetForceN}
              onChangeText={(v) => setForm((f) => ({ ...f, targetForceN: v }))}
              error={errors.targetForceN}
              keyboardType="numeric"
            />
          </View>

          {/* Save button */}
          <Pressable
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveBtnLabel}>
                  {hasExistingPreset ? 'อัปเดตแผนการรักษา' : 'สร้างแผนการรักษา'}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function FieldRow({
  label,
  hint,
  value,
  onChangeText,
  error,
  keyboardType,
}: {
  label: string;
  hint: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  keyboardType?: 'numeric' | 'default';
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldMeta}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldHint}>{hint}</Text>
      </View>
      <View style={styles.fieldInputWrap}>
        <TextInput
          style={[styles.fieldInput, !!error && styles.fieldInputError]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType ?? 'default'}
          placeholder="—"
          placeholderTextColor={DSColors.text.secondary}
        />
        {error && <Text style={styles.fieldError}>{error}</Text>}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DSLayout.screenPadding,
    paddingVertical: 8,
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    ...DSTypography.body,
    color: DSColors.primary,
  },
  navTitle: {
    flex: 1,
  },
  title: {
    ...DSTypography.h2,
    color: DSColors.text.primary,
  },
  subtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },

  scrollContent: {
    paddingHorizontal: DSLayout.screenPadding,
    paddingBottom: 40,
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DSColors.primaryLight,
    borderRadius: DSShape.radiusCard,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    ...DSTypography.caption,
    color: DSColors.primary,
  },

  sectionTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    marginBottom: 10,
    marginTop: DSLayout.sectionGap,
  },

  card: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    overflow: 'hidden',
  },
  fieldDivider: {
    height: 1,
    backgroundColor: DSColors.borderLight,
    marginHorizontal: DSLayout.cardPadding,
  },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DSLayout.cardPadding,
    paddingVertical: 14,
    gap: 12,
  },
  fieldMeta: {
    flex: 1,
  },
  fieldLabel: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  fieldHint: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  fieldInputWrap: {
    alignItems: 'flex-end',
  },
  fieldInput: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
    borderWidth: 1,
    borderColor: DSColors.border,
    borderRadius: DSShape.radiusChip,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    textAlign: 'center',
    backgroundColor: DSColors.background,
  },
  fieldInputError: {
    borderColor: DSColors.danger,
  },
  fieldError: {
    ...DSTypography.small,
    color: DSColors.danger,
    marginTop: 4,
    textAlign: 'right',
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DSLayout.cardPadding,
    paddingVertical: 14,
    gap: 12,
  },
  switchInfo: {
    flex: 1,
  },

  speedRow: {
    flexDirection: 'row',
    gap: 8,
    padding: DSLayout.cardPadding,
  },
  speedBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: DSShape.radiusChip,
    alignItems: 'center',
    backgroundColor: DSColors.background,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  speedBtnActive: {
    backgroundColor: DSColors.primary,
    borderColor: DSColors.primary,
  },
  speedBtnLabel: {
    ...DSTypography.bodyBold,
    color: DSColors.text.secondary,
  },
  speedBtnLabelActive: {
    color: '#fff',
  },
  speedHint: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    textAlign: 'center',
    paddingBottom: 14,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: DSColors.primary,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 16,
    marginTop: DSLayout.sectionGap,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnLabel: {
    ...DSTypography.bodyBold,
    color: '#fff',
  },
});
