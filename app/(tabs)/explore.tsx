import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

const TEAL = '#0B8FAC';
const TEAL_LIGHT = '#E8F6FA';

type LabeledInputProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  textColor: string;
  borderColor: string;
  inputBg: string;
  primaryColor: string;
};

function LabeledInput({ label, value, onChange, unit, textColor, borderColor, inputBg, primaryColor }: LabeledInputProps) {
  return (
    <View style={inputStyles.field}>
      <Text style={[inputStyles.label, { color: textColor }]}>{label}</Text>
      <View style={[inputStyles.row, { backgroundColor: inputBg, borderColor }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          style={[inputStyles.input, { color: textColor }]}
        />
        {unit && <Text style={[inputStyles.unit, { color: primaryColor }]}>{unit}</Text>}
      </View>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 10 },
  unit: { fontSize: 14, fontWeight: '700', paddingLeft: 4 },
});

export default function TabTwoScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDark = useColorScheme() === 'dark';

  const [angleStart, setAngleStart] = useState('15');
  const [angleEnd, setAngleEnd] = useState('65');
  const [forceTarget, setForceTarget] = useState('10');
  const [durationMinutes, setDurationMinutes] = useState('20');
  const [autoStop, setAutoStop] = useState(true);
  const [assistMode, setAssistMode] = useState(true);

  const bg = isDark ? '#0D1117' : '#F0F6FA';
  const cardBg = isDark ? '#1C2128' : '#FFFFFF';
  const textPrimary = isDark ? '#E8EDF2' : '#1A2B3C';
  const textSecondary = isDark ? '#8FA0B0' : '#6B8099';
  const borderColor = isDark ? '#2D3945' : '#D8E9F0';
  const inputBg = isDark ? '#0D1117' : '#F7FBFD';
  const primaryColor = isDark ? '#1DD4B3' : TEAL;
  const primaryLight = isDark ? '#0D2630' : TEAL_LIGHT;

  const handleSave = () => {
    Alert.alert('บันทึกการตั้งค่า', 'ระบบบันทึกค่าการรักษาเรียบร้อยแล้ว');
  };

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#0C2535' : TEAL }]}>
        <Text style={styles.headerTitle}>ตั้งค่าเครื่องกายภาพ</Text>
        <Text style={styles.headerSubtitle}>Device Configuration</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionDesc, { color: textSecondary }]}>
          กำหนดค่าการรักษาที่จะส่งเข้าเครื่องก่อนเริ่มรอบบำบัด
        </Text>

        <View style={isTablet ? styles.gridTablet : undefined}>
          {/* Motion Range Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }, isTablet ? styles.halfCard : null]}>
            <View style={[styles.cardTitleBar, { backgroundColor: primaryLight }]}>
              <Text style={[styles.cardTitle, { color: primaryColor }]}>ช่วงการเคลื่อนไหว</Text>
              <Text style={[styles.cardTitleSub, { color: textSecondary }]}>Range of Motion</Text>
            </View>
            <View style={styles.cardBody}>
              <LabeledInput label="มุมเริ่มต้น" value={angleStart} onChange={setAngleStart} unit="°"
                textColor={textPrimary} borderColor={borderColor} inputBg={inputBg} primaryColor={primaryColor} />
              <LabeledInput label="มุมสิ้นสุด" value={angleEnd} onChange={setAngleEnd} unit="°"
                textColor={textPrimary} borderColor={borderColor} inputBg={inputBg} primaryColor={primaryColor} />
            </View>
          </View>

          {/* Force & Duration Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }, isTablet ? styles.halfCard : null]}>
            <View style={[styles.cardTitleBar, { backgroundColor: primaryLight }]}>
              <Text style={[styles.cardTitle, { color: primaryColor }]}>แรงและระยะเวลา</Text>
              <Text style={[styles.cardTitleSub, { color: textSecondary }]}>Force & Duration</Text>
            </View>
            <View style={styles.cardBody}>
              <LabeledInput label="แรงเป้าหมาย" value={forceTarget} onChange={setForceTarget} unit="N"
                textColor={textPrimary} borderColor={borderColor} inputBg={inputBg} primaryColor={primaryColor} />
              <LabeledInput label="เวลาต่อรอบ" value={durationMinutes} onChange={setDurationMinutes} unit="นาที"
                textColor={textPrimary} borderColor={borderColor} inputBg={inputBg} primaryColor={primaryColor} />
            </View>
          </View>

          {/* Operation Mode Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }, isTablet ? styles.halfCard : null]}>
            <View style={[styles.cardTitleBar, { backgroundColor: primaryLight }]}>
              <Text style={[styles.cardTitle, { color: primaryColor }]}>โหมดการทำงาน</Text>
              <Text style={[styles.cardTitleSub, { color: textSecondary }]}>Operation Mode</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={[styles.toggleRow, { borderBottomColor: borderColor }]}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleLabel, { color: textPrimary }]}>หยุดอัตโนมัติเมื่อเกินค่า</Text>
                  <Text style={[styles.toggleDesc, { color: textSecondary }]}>Auto-stop on limit exceed</Text>
                </View>
                <Switch value={autoStop} onValueChange={setAutoStop}
                  trackColor={{ false: '#CBD5E0', true: primaryColor }} thumbColor="#FFFFFF" />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleLabel, { color: textPrimary }]}>โหมดช่วยพยุงการเคลื่อนไหว</Text>
                  <Text style={[styles.toggleDesc, { color: textSecondary }]}>Assisted motion mode</Text>
                </View>
                <Switch value={assistMode} onValueChange={setAssistMode}
                  trackColor={{ false: '#CBD5E0', true: primaryColor }} thumbColor="#FFFFFF" />
              </View>
            </View>
          </View>

          {/* Summary Card */}
          <View style={[
            styles.card,
            { backgroundColor: isDark ? '#0C2535' : TEAL_LIGHT, borderColor: primaryColor + '50' },
            isTablet ? styles.halfCard : null,
          ]}>
            <View style={styles.summaryHeader}>
              <Text style={[styles.summaryTitle, { color: primaryColor }]}>สรุปค่าปัจจุบัน</Text>
              <Text style={[styles.summaryTitleSub, { color: textSecondary }]}>Current Settings Summary</Text>
            </View>
            <View style={styles.summaryBody}>
              {([
                ['ช่วงองศา', `${angleStart}° – ${angleEnd}°`],
                ['แรงเป้าหมาย', `${forceTarget} N`],
                ['เวลาต่อรอบ', `${durationMinutes} นาที`],
                ['หยุดอัตโนมัติ', autoStop ? 'เปิด' : 'ปิด'],
                ['โหมดช่วยพยุง', assistMode ? 'เปิด' : 'ปิด'],
              ] as [string, string][]).map(([label, val], i, arr) => (
                <View key={label} style={[
                  styles.summaryRow,
                  { borderBottomColor: primaryColor + '25' },
                  i === arr.length - 1 ? styles.summaryRowLast : null,
                ]}>
                  <Text style={[styles.summaryLabel, { color: textSecondary }]}>{label}</Text>
                  <Text style={[styles.summaryValue, { color: primaryColor }]}>{val}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.saveButton, { backgroundColor: primaryColor }, isTablet ? styles.saveButtonTablet : null]}
          onPress={handleSave}>
          <Text style={styles.saveButtonText}>บันทึกค่าการรักษา</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  sectionDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  gridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  halfCard: {
    width: '48%',
    marginBottom: 0,
  },
  cardTitleBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardTitleSub: {
    fontSize: 12,
    marginTop: 1,
  },
  cardBody: {
    padding: 16,
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toggleInfo: { flex: 1, paddingRight: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDesc: { fontSize: 12, marginTop: 2 },
  summaryHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryTitleSub: {
    fontSize: 12,
    marginTop: 1,
  },
  summaryBody: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: { fontSize: 13, fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  saveButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonTablet: {
    width: '50%',
    alignSelf: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});


