/**
 * Manual Session Setup (ตั้งค่าโหมดฝึกอิสระ) – Stack screen.
 * Navigate from Home "โหมดฝึกอิสระ"; starts session with isManualMode=true.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeviceConnectionModal } from '@/components/ui/DeviceConnectionModal';
import {
  DSColors,
  DSLayout,
  DSShadow,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useMockDeviceConnection } from '@/hooks/useMockDeviceConnection';

const MAX_SAFE_ANGLE = 65;
const MAX_SAFE_FORCE_CEILING = 50; // safety cap for self-practice ceiling
const MIN_FORCE_CEILING = 5;
const FORCE_LEVEL_MAX = 10;
const SPEED_MIN = 1;
const SPEED_MAX = 5;

const TOUCH_HEIGHT = 52;
const STEP_ANGLE = 5;
const STEP_DURATION = 5;
const STEP_FORCE_CEILING = 5;

// ─── Stepper row ─────────────────────────────────────────────────────────────

type StepperRowProps = {
  label: string;
  sublabel?: string;
  value: number;
  unit: string;
  onMinus: () => void;
  onPlus: () => void;
  atMin: boolean;
  atMax: boolean;
};

function StepperRow({ label, sublabel, value, unit, onMinus, onPlus, atMin, atMax }: StepperRowProps) {
  return (
    <View style={rowStyles.field}>
      <View style={rowStyles.labelWrap}>
        <Text style={rowStyles.label}>{label}</Text>
        {sublabel && <Text style={rowStyles.sublabel}>{sublabel}</Text>}
      </View>
      <View style={rowStyles.controls}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[rowStyles.btn, atMin && rowStyles.btnDisabled]}
          onPress={onMinus}
          disabled={atMin}
          accessibilityLabel={`ลด ${label}`}
        >
          <Ionicons name="remove" size={22} color={atMin ? DSColors.border : DSColors.primary} />
        </TouchableOpacity>

        <View style={rowStyles.valueWrap}>
          <Text style={rowStyles.value}>{value}</Text>
          <Text style={rowStyles.unit}>{unit}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[rowStyles.btn, atMax && rowStyles.btnDisabled]}
          onPress={onPlus}
          disabled={atMax}
          accessibilityLabel={`เพิ่ม ${label}`}
        >
          <Ionicons name="add" size={22} color={atMax ? DSColors.border : DSColors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  labelWrap: { flex: 1, paddingRight: 12 },
  label: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  sublabel: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    width: TOUCH_HEIGHT,
    height: TOUCH_HEIGHT,
    borderRadius: TOUCH_HEIGHT / 2,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: DSColors.primary,
  },
  btnDisabled: {
    backgroundColor: DSColors.borderLight,
    borderColor: DSColors.border,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 72,
    justifyContent: 'center',
    gap: 2,
  },
  value: {
    ...DSTypography.data,
    color: DSColors.primary,
  },
  unit: {
    ...DSTypography.bodyBold,
    color: DSColors.primary,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ManualSetupScreen() {
  const router = useRouter();
  const {
    visible,
    status,
    startMockConnection,
    selectDiscoveredDevice,
    dismiss,
    canDismiss,
  } = useMockDeviceConnection();

  const [angleStart, setAngleStart] = useState(15);
  const [angleEnd, setAngleEnd] = useState(MAX_SAFE_ANGLE);
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [speedLevel, setSpeedLevel] = useState(3);
  const [forceCeilingN, setForceCeilingN] = useState(20);

  const handleStart = () => {
    startMockConnection(() =>
      router.push({
        pathname: '/therapy-session',
        params: {
          isManualMode: 'true',
          angleStart: String(angleStart),
          angleEnd: String(angleEnd),
          durationMinutes: String(durationMinutes),
          speedLevel: String(speedLevel),
          forceCeilingN: String(forceCeilingN),
          forceLevel: String(FORCE_LEVEL_MAX),
        },
      })
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Page heading */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>ตั้งค่าโหมดฝึกอิสระ</Text>
          <Text style={styles.pageSubtitle}>ปรับแต่งการฝึกให้อยู่ในขอบเขตที่ปลอดภัย</Text>
        </View>

        {/* Settings card */}
        <View style={[styles.card, DSShadow]}>
          <StepperRow
            label="เหยียดขา"
            sublabel="เป้าหมายองศาต่ำสุด"
            value={angleStart}
            unit="°"
            onMinus={() => setAngleStart(p => Math.max(0, p - STEP_ANGLE))}
            onPlus={() => setAngleStart(p => Math.min(MAX_SAFE_ANGLE, p + STEP_ANGLE))}
            atMin={angleStart <= 0}
            atMax={angleStart >= MAX_SAFE_ANGLE}
          />
          <StepperRow
            label="งอเข่าสูงสุด"
            sublabel="เป้าหมายองศาสูงสุด"
            value={angleEnd}
            unit="°"
            onMinus={() => setAngleEnd(p => Math.max(0, p - STEP_ANGLE))}
            onPlus={() => setAngleEnd(p => Math.min(MAX_SAFE_ANGLE, p + STEP_ANGLE))}
            atMin={angleEnd <= 0}
            atMax={angleEnd >= MAX_SAFE_ANGLE}
          />
          <StepperRow
            label="ระยะเวลา"
            sublabel="รวมเวลาทั้งเซสชัน"
            value={durationMinutes}
            unit="นาที"
            onMinus={() => setDurationMinutes(p => Math.max(5, p - STEP_DURATION))}
            onPlus={() => setDurationMinutes(p => Math.min(60, p + STEP_DURATION))}
            atMin={durationMinutes <= 5}
            atMax={durationMinutes >= 60}
          />
          <StepperRow
            label="ความเร็ว"
            sublabel={`ระดับ ${SPEED_MIN}–${SPEED_MAX}`}
            value={speedLevel}
            unit="lv."
            onMinus={() => setSpeedLevel(p => Math.max(SPEED_MIN, p - 1))}
            onPlus={() => setSpeedLevel(p => Math.min(SPEED_MAX, p + 1))}
            atMin={speedLevel <= SPEED_MIN}
            atMax={speedLevel >= SPEED_MAX}
          />
          <View style={styles.lastRow}>
            <StepperRow
              label="แรงจำกัด"
              sublabel="เพดานสูงสุด (= ระดับ 10)"
              value={forceCeilingN}
              unit="N"
              onMinus={() => setForceCeilingN(p => Math.max(MIN_FORCE_CEILING, p - STEP_FORCE_CEILING))}
              onPlus={() => setForceCeilingN(p => Math.min(MAX_SAFE_FORCE_CEILING, p + STEP_FORCE_CEILING))}
              atMin={forceCeilingN <= MIN_FORCE_CEILING}
              atMax={forceCeilingN >= MAX_SAFE_FORCE_CEILING}
            />
          </View>

          <View style={styles.safetyNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={DSColors.text.secondary} />
            <Text style={styles.safetyNoteText}>
              จำกัดความปลอดภัยสูงสุดตามคำสั่งแพทย์
            </Text>
          </View>
        </View>

        {/* Start button */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.startBtn}
          onPress={handleStart}
          accessibilityLabel="เริ่มเซสชันอิสระ"
        >
          <Ionicons name="play-circle" size={26} color="#FFFFFF" />
          <Text style={styles.startBtnText}>เริ่มเซสชันอิสระ</Text>
        </TouchableOpacity>
      </ScrollView>

      <DeviceConnectionModal
        visible={visible}
        status={status}
        onSelectDevice={selectDiscoveredDevice}
        allowDismiss={canDismiss}
        onRequestClose={dismiss}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  scroll: { flex: 1 },
  content: {
    padding: DSLayout.screenPadding,
    paddingBottom: 40,
  },

  pageHeader: {
    marginBottom: DSLayout.sectionGap,
  },
  pageTitle: {
    ...DSTypography.h2,
    color: DSColors.text.primary,
    marginBottom: 4,
  },
  pageSubtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },

  card: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    paddingHorizontal: DSLayout.cardPadding,
    paddingTop: 4,
    paddingBottom: 12,
    marginBottom: DSLayout.sectionGap,
  },
  lastRow: {
    // Remove bottom border on last StepperRow
    overflow: 'hidden',
  },

  safetyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DSColors.borderLight,
  },
  safetyNoteText: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    flex: 1,
  },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: DSColors.primary,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 18,
    minHeight: 60,
    width: '100%',
  },
  startBtnText: {
    ...DSTypography.bodyBold,
    color: '#FFFFFF',
    fontSize: 18,
  },
});
