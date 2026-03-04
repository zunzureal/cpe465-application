/**
 * Manual Session Setup (ตั้งค่าโหมดฝึกอิสระ) – Stack screen.
 * Navigate from Home "โหมดฝึกอิสระ"; starts session with isManualMode=true.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';

const MAX_SAFE_ANGLE = 65;
const MAX_SAFE_FORCE = 10;

const TOUCH_HEIGHT = 52;
const ICON_SIZE = 24;
const STEP_ANGLE = 5;
const STEP_DURATION = 5;
const STEP_FORCE = 1;

const TEAL = '#0B8FAC';
const TEAL_LIGHT = '#E8F6FA';

type StepperRowProps = {
  label: string;
  value: number;
  unit: string;
  onMinus: () => void;
  onPlus: () => void;
  atMin: boolean;
  atMax: boolean;
  textColor: string;
  primaryColor: string;
  primaryLight: string;
  disabledColor: string;
};

function StepperRow({ label, value, unit, onMinus, onPlus, atMin, atMax, textColor, primaryColor, primaryLight, disabledColor }: StepperRowProps) {
  return (
    <View style={localStyles.stepperField}>
      <Text style={[localStyles.stepperLabel, { color: textColor }]}>{label}</Text>
      <View style={localStyles.stepperRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[localStyles.stepperBtn, { backgroundColor: primaryLight }, atMin && localStyles.stepperBtnDisabled]}
          onPress={onMinus}
          disabled={atMin}
        >
          <Ionicons name="remove" size={ICON_SIZE} color={atMin ? disabledColor : primaryColor} />
        </TouchableOpacity>
        <View style={localStyles.stepperValueWrap}>
          <Text style={[localStyles.stepperValue, { color: primaryColor }]}>{value}</Text>
          <Text style={[localStyles.stepperUnit, { color: primaryColor }]}> {unit}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[localStyles.stepperBtn, { backgroundColor: primaryLight }, atMax && localStyles.stepperBtnDisabled]}
          onPress={onPlus}
          disabled={atMax}
        >
          <Ionicons name="add" size={ICON_SIZE} color={atMax ? disabledColor : primaryColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  stepperField: { marginBottom: 20 },
  stepperLabel: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: TOUCH_HEIGHT,
    gap: 12,
  },
  stepperBtn: {
    width: TOUCH_HEIGHT,
    height: TOUCH_HEIGHT,
    borderRadius: TOUCH_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.45 },
  stepperValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { fontSize: 22, fontWeight: '700' },
  stepperUnit: { fontSize: 16, fontWeight: '600' },
});

export default function ManualSetupScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const [angleStart, setAngleStart] = useState(15);
  const [angleEnd, setAngleEnd] = useState(MAX_SAFE_ANGLE);
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [forceN, setForceN] = useState(5);

  const atMinAngleStart = angleStart <= 0;
  const atMaxAngleStart = angleStart >= MAX_SAFE_ANGLE;
  const atMinAngleEnd = angleEnd <= 0;
  const atMaxAngleEnd = angleEnd >= MAX_SAFE_ANGLE;
  const atMinDuration = durationMinutes <= 5;
  const atMaxDuration = durationMinutes >= 60;
  const atMinForce = forceN <= 1;
  const atMaxForce = forceN >= MAX_SAFE_FORCE;

  const bg = isDark ? '#0D1117' : '#F8FAFC';
  const cardBg = isDark ? '#1C2128' : '#FFFFFF';
  const textPrimary = isDark ? '#E8EDF2' : '#1F2937';
  const textSecondary = isDark ? '#8FA0B0' : '#6B7280';
  const primaryColor = isDark ? '#1DD4B3' : TEAL;
  const primaryLight = isDark ? '#0D2630' : TEAL_LIGHT;
  const borderColor = isDark ? '#2D3945' : '#E5E7EB';
  const disabledColor = '#9CA3AF';

  const handleStartManualSession = () => {
    router.push({ pathname: '/therapy-session', params: { isManualMode: 'true' } });
  };

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#0C2535' : TEAL }]}>
        <Text style={styles.headerTitle}>ตั้งค่าโหมดฝึกอิสระ</Text>
        <Text style={styles.headerSubtitle}>Manual Practice Setup</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: textSecondary }]}>
          ปรับแต่งการฝึกของคุณให้อยู่ในขอบเขตที่ปลอดภัย
        </Text>
        <Text style={[styles.subtitleEn, { color: textSecondary }]}>
          Adjust your practice within safe limits
        </Text>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <StepperRow
            label="มุมเริ่มต้น (Starting Angle)"
            value={angleStart}
            unit="°"
            onMinus={() => setAngleStart((p) => Math.max(0, p - STEP_ANGLE))}
            onPlus={() => setAngleStart((p) => Math.min(MAX_SAFE_ANGLE, p + STEP_ANGLE))}
            atMin={atMinAngleStart}
            atMax={atMaxAngleStart}
            textColor={textPrimary}
            primaryColor={primaryColor}
            primaryLight={primaryLight}
            disabledColor={disabledColor}
          />
          <StepperRow
            label="มุมสิ้นสุด (Ending Angle)"
            value={angleEnd}
            unit="°"
            onMinus={() => setAngleEnd((p) => Math.max(0, p - STEP_ANGLE))}
            onPlus={() => setAngleEnd((p) => Math.min(MAX_SAFE_ANGLE, p + STEP_ANGLE))}
            atMin={atMinAngleEnd}
            atMax={atMaxAngleEnd}
            textColor={textPrimary}
            primaryColor={primaryColor}
            primaryLight={primaryLight}
            disabledColor={disabledColor}
          />
          <StepperRow
            label="ระยะเวลา (Duration)"
            value={durationMinutes}
            unit="นาที"
            onMinus={() => setDurationMinutes((p) => Math.max(5, p - STEP_DURATION))}
            onPlus={() => setDurationMinutes((p) => Math.min(60, p + STEP_DURATION))}
            atMin={atMinDuration}
            atMax={atMaxDuration}
            textColor={textPrimary}
            primaryColor={primaryColor}
            primaryLight={primaryLight}
            disabledColor={disabledColor}
          />
          <StepperRow
            label="แรง (Force Level)"
            value={forceN}
            unit="N"
            onMinus={() => setForceN((p) => Math.max(1, p - STEP_FORCE))}
            onPlus={() => setForceN((p) => Math.min(MAX_SAFE_FORCE, p + STEP_FORCE))}
            atMin={atMinForce}
            atMax={atMaxForce}
            textColor={textPrimary}
            primaryColor={primaryColor}
            primaryLight={primaryLight}
            disabledColor={disabledColor}
          />

          <Text style={[styles.safetyNote, { color: textSecondary }]}>
            จำกัดความปลอดภัยสูงสุดตามคำสั่งแพทย์ (Limited by doctor's safety preset)
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.startButton, { backgroundColor: primaryColor }]}
          onPress={handleStartManualSession}
        >
          <Ionicons name="play" size={ICON_SIZE} color="#FFFFFF" style={styles.startButtonIcon} />
          <Text style={styles.startButtonText}>เริ่มเซสชันอิสระ (Start Manual Session)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  subtitleEn: {
    fontSize: 14,
    marginBottom: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    borderWidth: 1,
  },
  safetyNote: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_HEIGHT + 8,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  startButtonIcon: {
    marginRight: 12,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
