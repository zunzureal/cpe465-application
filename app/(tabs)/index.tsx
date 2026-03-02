import { Link } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

const treatmentPrograms = [
  {
    id: 'PT-2401',
    patientName: 'คุณสมชาย ใจดี',
    doctorName: 'นพ.ธนา วัฒนกิจ',
    treatmentArea: 'เข่าขวา',
    angle: '15° - 65°',
    force: '8 - 12 N',
    duration: '20 นาที',
    rounds: '3 รอบ/วัน',
  },
  {
    id: 'PT-2402',
    patientName: 'คุณอารยา พูนสุข',
    doctorName: 'พญ.จิราพร ทองแท้',
    treatmentArea: 'ข้อไหล่ซ้าย',
    angle: '10° - 90°',
    force: '6 - 9 N',
    duration: '15 นาที',
    rounds: '2 รอบ/วัน',
  },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const borderColor = useThemeColor({}, 'icon');

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">โปรแกรมกายภาพบำบัด</ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">คิวโปรแกรมจากแพทย์</ThemedText>
        <ThemedText>
          หน้านี้ใช้ตรวจสอบโปรแกรมการรักษาที่ส่งจากแพทย์ก่อนเริ่มกับเครื่องกายภาพบำบัด
          และยืนยันช่วงองศา/แรงที่ต้องใช้
        </ThemedText>
      </ThemedView>

      <View style={[styles.contentWrapper, isTablet && styles.contentWrapperTablet]}>
        <View style={[styles.programGrid, isTablet && styles.programGridTablet]}>
          {treatmentPrograms.map((program) => (
            <ThemedView
              key={program.id}
              style={[styles.programCard, { borderColor }, isTablet && styles.programCardTablet]}>
              <ThemedText type="defaultSemiBold">โปรแกรม: {program.id}</ThemedText>
              <ThemedText>ผู้ป่วย: {program.patientName}</ThemedText>
              <ThemedText>แพทย์ผู้สั่ง: {program.doctorName}</ThemedText>
              <ThemedText>ตำแหน่ง: {program.treatmentArea}</ThemedText>
              <ThemedText>ช่วงองศา: {program.angle}</ThemedText>
              <ThemedText>แรงที่กำหนด: {program.force}</ThemedText>
              <ThemedText>ระยะเวลา: {program.duration}</ThemedText>
              <ThemedText>ความถี่: {program.rounds}</ThemedText>
            </ThemedView>
          ))}
        </View>

        <Link href="/modal" style={[styles.addProgramLink, { borderColor }, isTablet && styles.addProgramLinkTablet]}>
          <ThemedText type="link">+ รับโปรแกรมใหม่จากแพทย์</ThemedText>
        </Link>
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
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  contentWrapper: {
    width: '100%',
  },
  contentWrapperTablet: {
    alignSelf: 'center',
    maxWidth: 980,
  },
  programGrid: {
    width: '100%',
  },
  programGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  programCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginBottom: 12,
  },
  programCardTablet: {
    width: '48%',
    marginBottom: 0,
  },
  addProgramLink: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 12,
  },
  addProgramLinkTablet: {
    alignSelf: 'center',
    width: '60%',
  },
});
