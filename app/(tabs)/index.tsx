import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

const TEAL = '#0B8FAC';
const TEAL_LIGHT = '#E8F6FA';
const GREEN = '#22A861';
const GREEN_LIGHT = '#E8F7EF';
const AMBER = '#E67E22';
const AMBER_LIGHT = '#FEF3E2';

const treatmentPrograms = [
  {
    id: 'PT-2401',
    patientName: 'คุณสมชาย ใจดี',
    doctorName: 'นพ.ธนา วัฒนกิจ',
    treatmentArea: 'เข่าขวา',
    angle: '15° – 65°',
    force: '8 – 12 N',
    duration: '20 นาที',
    rounds: '3 รอบ/วัน',
    status: 'กำลังรักษา',
  },
  {
    id: 'PT-2402',
    patientName: 'คุณอารยา พูนสุข',
    doctorName: 'พญ.จิราพร ทองแท้',
    treatmentArea: 'ข้อไหล่ซ้าย',
    angle: '10° – 90°',
    force: '6 – 9 N',
    duration: '15 นาที',
    rounds: '2 รอบ/วัน',
    status: 'รอดำเนินการ',
  },
];

type Program = (typeof treatmentPrograms)[0];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();

  const bg = isDark ? '#0D1117' : '#F0F6FA';
  const cardBg = isDark ? '#1C2128' : '#FFFFFF';
  const textPrimary = isDark ? '#E8EDF2' : '#1A2B3C';
  const textSecondary = isDark ? '#8FA0B0' : '#6B8099';
  const borderColor = isDark ? '#2D3945' : '#D8E9F0';
  const primaryColor = isDark ? '#1DD4B3' : TEAL;
  const primaryLight = isDark ? '#0D2630' : TEAL_LIGHT;

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#0C2535' : TEAL }]}>
        <View>
          <Text style={styles.headerTitle}>โปรแกรมกายภาพบำบัด</Text>
          <Text style={styles.headerSubtitle}>Physical Therapy Programs</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={[styles.headerBadgeText, { color: isDark ? '#1DD4B3' : TEAL }]}>
            {treatmentPrograms.length} โปรแกรม
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionDesc, { color: textSecondary }]}>
          ตรวจสอบโปรแกรมการรักษาที่ส่งจากแพทย์ก่อนเริ่มกับเครื่องกายภาพบำบัด
        </Text>

        <View style={isTablet ? styles.programGridTablet : undefined}>
          {treatmentPrograms.map((program: Program) => {
            const isActive = program.status === 'กำลังรักษา';
            const statusColor = isActive ? GREEN : AMBER;
            const statusLight = isDark
              ? isActive ? '#0D2118' : '#2A1C00'
              : isActive ? GREEN_LIGHT : AMBER_LIGHT;

            return (
              <View
                key={program.id}
                style={[
                  styles.card,
                  { backgroundColor: cardBg, borderColor },
                  isTablet ? styles.cardTablet : null,
                ]}>
                <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />
                <View style={styles.cardInner}>
                  {/* Card header row */}
                  <View style={styles.cardHeader}>
                    <View style={[styles.idBadge, { backgroundColor: primaryLight }]}>
                      <Text style={[styles.idBadgeText, { color: primaryColor }]}>{program.id}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusLight }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>{program.status}</Text>
                    </View>
                  </View>

                  {/* Patient / Doctor info */}
                  <View style={[styles.infoSection, { borderBottomColor: borderColor }]}>
                    {[
                      ['ผู้ป่วย', program.patientName],
                      ['แพทย์ผู้สั่ง', program.doctorName],
                    ].map(([label, value]) => (
                      <View key={label} style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: textSecondary }]}>{label}</Text>
                        <Text style={[styles.infoValue, { color: textPrimary }]}>{value}</Text>
                      </View>
                    ))}
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: textSecondary }]}>ตำแหน่ง</Text>
                      <View style={[styles.areaBadge, { backgroundColor: primaryLight }]}>
                        <Text style={[styles.areaText, { color: primaryColor }]}>{program.treatmentArea}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Treatment params grid */}
                  <View style={styles.paramsGrid}>
                    {[
                      ['ช่วงองศา', program.angle],
                      ['แรงที่กำหนด', program.force],
                      ['ระยะเวลา', program.duration],
                      ['ความถี่', program.rounds],
                    ].map(([label, value]) => (
                      <View key={label} style={[styles.paramChip, { backgroundColor: primaryLight }]}>
                        <Text style={[styles.paramLabel, { color: textSecondary }]}>{label}</Text>
                        <Text style={[styles.paramValue, { color: primaryColor }]}>{value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <Pressable
          style={[styles.addButton, { backgroundColor: primaryColor }]}
          onPress={() => router.push('/modal')}>
          <Text style={styles.addButtonText}>＋  รับโปรแกรมใหม่จากแพทย์</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '600',
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
  programGridTablet: {
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
  cardTablet: {
    width: '48%',
    marginBottom: 0,
  },
  cardAccent: {
    height: 4,
  },
  cardInner: {
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  idBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoSection: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  areaBadge: {
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  areaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  paramsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paramChip: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '47%',
    flexGrow: 1,
  },
  paramLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  paramValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  addButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
