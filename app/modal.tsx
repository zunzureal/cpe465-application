import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

const TEAL = '#0B8FAC';
const TEAL_LIGHT = '#E8F6FA';

export default function ModalScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const [doctorName, setDoctorName] = useState('');
  const [programCode, setProgramCode] = useState('');
  const [targetArea, setTargetArea] = useState('');
  const [angleRange, setAngleRange] = useState('');
  const [forceRange, setForceRange] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');

  const bg = isDark ? '#0D1117' : '#F0F6FA';
  const cardBg = isDark ? '#1C2128' : '#FFFFFF';
  const textPrimary = isDark ? '#E8EDF2' : '#1A2B3C';
  const textSecondary = isDark ? '#8FA0B0' : '#6B8099';
  const borderColor = isDark ? '#2D3945' : '#D8E9F0';
  const inputBg = isDark ? '#0D1117' : '#F7FBFD';
  const primaryColor = isDark ? '#1DD4B3' : TEAL;
  const primaryLight = isDark ? '#0D2630' : TEAL_LIGHT;
  const placeholderColor = isDark ? '#4A5568' : '#A0AEC0';

  const fields: { label: string; placeholder: string; value: string; onChange: (v: string) => void }[] = [
    { label: 'ชื่อแพทย์', placeholder: 'เช่น นพ.ธนา วัฒนกิจ', value: doctorName, onChange: setDoctorName },
    { label: 'รหัสโปรแกรม', placeholder: 'เช่น PT-2403', value: programCode, onChange: setProgramCode },
    { label: 'ตำแหน่งการรักษา', placeholder: 'เช่น ข้อเข่าซ้าย', value: targetArea, onChange: setTargetArea },
    { label: 'ช่วงองศา', placeholder: 'เช่น 20° – 70°', value: angleRange, onChange: setAngleRange },
    { label: 'ช่วงแรง', placeholder: 'เช่น 7 – 11 N', value: forceRange, onChange: setForceRange },
    { label: 'ระยะเวลา', placeholder: 'เช่น 20 นาที', value: duration, onChange: setDuration },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={[styles.content, isTablet ? styles.contentTablet : null]}
        showsVerticalScrollIndicator={false}>

        {/* Form header banner */}
        <View style={[styles.formHeader, { backgroundColor: primaryLight, borderColor: primaryColor + '40' }]}>
          <View style={[styles.formHeaderAccent, { backgroundColor: primaryColor }]} />
          <View style={styles.formHeaderText}>
            <Text style={[styles.formHeaderTitle, { color: primaryColor }]}>รับโปรแกรมจากแพทย์</Text>
            <Text style={[styles.formHeaderSub, { color: textSecondary }]}>
              กรอกข้อมูลโปรแกรมเพื่อส่งเข้าเครื่องกายภาพบำบัด
            </Text>
          </View>
        </View>

        {/* Fields card */}
        <View style={[styles.formCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.fieldGrid, isTablet ? styles.fieldGridTablet : null]}>
            {fields.map(({ label, placeholder, value, onChange }) => (
              <View key={label} style={[styles.fieldItem, isTablet ? styles.fieldItemHalf : null]}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>{label}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor }]}>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={placeholderColor}
                    style={[styles.inputField, { color: textPrimary }]}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Notes */}
          <View>
            <Text style={[styles.fieldLabel, { color: textSecondary }]}>หมายเหตุ</Text>
            <View style={[styles.textAreaWrapper, { backgroundColor: inputBg, borderColor }]}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="ข้อควรระวังหรือคำแนะนำเพิ่มเติม"
                placeholderTextColor={placeholderColor}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.textArea, { color: textPrimary }]}
              />
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.submitButton, { backgroundColor: primaryColor }, isTablet ? styles.submitButtonTablet : null]}
          onPress={() => router.dismissTo('/(tabs)')}>
          <Text style={styles.submitButtonText}>บันทึกและกลับหน้าหลัก</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  contentTablet: { alignItems: 'center' },
  formHeader: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
    maxWidth: 980,
  },
  formHeaderAccent: {
    width: 5,
  },
  formHeaderText: {
    padding: 16,
    gap: 4,
    flex: 1,
  },
  formHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  formHeaderSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
    width: '100%',
    maxWidth: 980,
  },
  fieldGrid: { gap: 12 },
  fieldGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldItem: { width: '100%' },
  fieldItemHalf: { width: '48%' },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 96,
    marginTop: 6,
  },
  textArea: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 72,
  },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 980,
  },
  submitButtonTablet: {
    width: '60%',
    alignSelf: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
