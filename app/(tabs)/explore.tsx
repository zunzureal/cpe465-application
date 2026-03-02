import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function TabTwoScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [angleStart, setAngleStart] = useState('15');
  const [angleEnd, setAngleEnd] = useState('65');
  const [forceTarget, setForceTarget] = useState('10');
  const [durationMinutes, setDurationMinutes] = useState('20');
  const [autoStop, setAutoStop] = useState(true);
  const [assistMode, setAssistMode] = useState(true);

  const borderColor = useThemeColor({}, 'icon');
  const textColor = useThemeColor({}, 'text');

  const handleSave = () => {
    Alert.alert('บันทึกการตั้งค่า', 'ระบบบันทึกค่าการรักษาเรียบร้อยแล้ว');
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">ตั้งค่าเครื่องกายภาพ</ThemedText>
      </ThemedView>
      <ThemedText>กำหนดค่าการรักษาที่ต้องส่งเข้าเครื่องก่อนเริ่มรอบบำบัด</ThemedText>

      <View style={[styles.contentWrapper, isTablet && styles.contentWrapperTablet]}>
        <View style={[styles.grid, isTablet && styles.gridTablet]}>
          <ThemedView style={[styles.settingCard, { borderColor }, isTablet && styles.halfCard]}>
            <ThemedText type="subtitle">องศาการเคลื่อนไหว</ThemedText>
            <ThemedText>เริ่มต้น (°)</ThemedText>
            <TextInput
              value={angleStart}
              onChangeText={setAngleStart}
              keyboardType="numeric"
              style={[styles.input, { borderColor, color: textColor }]}
            />
            <ThemedText>สิ้นสุด (°)</ThemedText>
            <TextInput
              value={angleEnd}
              onChangeText={setAngleEnd}
              keyboardType="numeric"
              style={[styles.input, { borderColor, color: textColor }]}
            />
          </ThemedView>

          <ThemedView style={[styles.settingCard, { borderColor }, isTablet && styles.halfCard]}>
            <ThemedText type="subtitle">แรงและเวลา</ThemedText>
            <ThemedText>แรงเป้าหมาย (N)</ThemedText>
            <TextInput
              value={forceTarget}
              onChangeText={setForceTarget}
              keyboardType="numeric"
              style={[styles.input, { borderColor, color: textColor }]}
            />
            <ThemedText>เวลาต่อรอบ (นาที)</ThemedText>
            <TextInput
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              keyboardType="numeric"
              style={[styles.input, { borderColor, color: textColor }]}
            />
          </ThemedView>

          <ThemedView style={[styles.settingCard, { borderColor }, isTablet && styles.halfCard]}>
            <ThemedText type="subtitle">โหมดการทำงาน</ThemedText>
            <ThemedView style={styles.switchRow}>
              <ThemedText>หยุดอัตโนมัติเมื่อเกินค่า</ThemedText>
              <Switch value={autoStop} onValueChange={setAutoStop} />
            </ThemedView>
            <ThemedView style={styles.switchRow}>
              <ThemedText>โหมดช่วยพยุงการเคลื่อนไหว</ThemedText>
              <Switch value={assistMode} onValueChange={setAssistMode} />
            </ThemedView>
          </ThemedView>

          <ThemedView style={[styles.summaryCard, { borderColor }, isTablet && styles.halfCard]}>
            <ThemedText type="defaultSemiBold">สรุปค่าปัจจุบัน</ThemedText>
            <ThemedText>
              ช่วงองศา: {angleStart}° ถึง {angleEnd}°
            </ThemedText>
            <ThemedText>แรงเป้าหมาย: {forceTarget} N</ThemedText>
            <ThemedText>เวลาต่อรอบ: {durationMinutes} นาที</ThemedText>
            <ThemedText>หยุดอัตโนมัติ: {autoStop ? 'เปิด' : 'ปิด'}</ThemedText>
            <ThemedText>โหมดช่วยพยุง: {assistMode ? 'เปิด' : 'ปิด'}</ThemedText>
          </ThemedView>
        </View>

        <Pressable style={[styles.saveButton, { borderColor }, isTablet && styles.saveButtonTablet]} onPress={handleSave}>
          <ThemedText type="link">บันทึกค่าการรักษา</ThemedText>
        </Pressable>
      </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 32,
    gap: 16,
  },
  titleContainer: {
    marginBottom: 8,
  },
  contentWrapper: {
    width: '100%',
  },
  contentWrapperTablet: {
    alignSelf: 'center',
    maxWidth: 980,
  },
  grid: {
    width: '100%',
  },
  gridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  settingCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 12,
  },
  halfCard: {
    width: '48%',
    marginTop: 0,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginTop: 12,
  },
  saveButton: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 20,
  },
  saveButtonTablet: {
    width: '50%',
    alignSelf: 'center',
  },
});
