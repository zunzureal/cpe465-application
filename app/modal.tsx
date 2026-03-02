import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Box,
  Button,
  ButtonText,
  Heading,
  Input,
  InputField,
  Text,
  Textarea,
  TextareaInput,
  VStack,
} from '@gluestack-ui/themed';

export default function ModalScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();

  const [doctorName, setDoctorName] = useState('');
  const [programCode, setProgramCode] = useState('');
  const [targetArea, setTargetArea] = useState('');
  const [angleRange, setAngleRange] = useState('');
  const [forceRange, setForceRange] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');

  return (
    <Box style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}>
        <Box style={styles.formCard}>
          <Heading size="2xl">รับโปรแกรมจากแพทย์</Heading>
          <Text>กรอกข้อมูลโปรแกรมเพื่อส่งเข้าเครื่องกายภาพบำบัด</Text>

          <View style={[styles.fieldGrid, isTablet && styles.fieldGridTablet]}>
            <View style={[styles.fieldItem, isTablet && styles.fieldItemTablet]}>
              <VStack space="xs">
                <Text bold>ชื่อแพทย์</Text>
                <Input style={styles.input}>
                  <InputField
                    value={doctorName}
                    onChangeText={setDoctorName}
                    placeholder="เช่น นพ.ธนา วัฒนกิจ"
                  />
                </Input>
              </VStack>
            </View>

            <View style={[styles.fieldItem, isTablet && styles.fieldItemTablet]}>
              <VStack space="xs">
                <Text bold>รหัสโปรแกรม</Text>
                <Input style={styles.input}>
                  <InputField
                    value={programCode}
                    onChangeText={setProgramCode}
                    placeholder="เช่น PT-2403"
                  />
                </Input>
              </VStack>
            </View>

            <View style={[styles.fieldItem, isTablet && styles.fieldItemTablet]}>
              <VStack space="xs">
                <Text bold>ตำแหน่งการรักษา</Text>
                <Input style={styles.input}>
                  <InputField
                    value={targetArea}
                    onChangeText={setTargetArea}
                    placeholder="เช่น ข้อเข่าซ้าย"
                  />
                </Input>
              </VStack>
            </View>

            <View style={[styles.fieldItem, isTablet && styles.fieldItemTablet]}>
              <VStack space="xs">
                <Text bold>ช่วงองศา</Text>
                <Input style={styles.input}>
                  <InputField
                    value={angleRange}
                    onChangeText={setAngleRange}
                    placeholder="เช่น 20° - 70°"
                  />
                </Input>
              </VStack>
            </View>

            <View style={[styles.fieldItem, isTablet && styles.fieldItemTablet]}>
              <VStack space="xs">
                <Text bold>ช่วงแรง</Text>
                <Input style={styles.input}>
                  <InputField
                    value={forceRange}
                    onChangeText={setForceRange}
                    placeholder="เช่น 7 - 11 N"
                  />
                </Input>
              </VStack>
            </View>

            <View style={[styles.fieldItem, isTablet && styles.fieldItemTablet]}>
              <VStack space="xs">
                <Text bold>ระยะเวลา</Text>
                <Input style={styles.input}>
                  <InputField
                    value={duration}
                    onChangeText={setDuration}
                    placeholder="เช่น 20 นาที"
                  />
                </Input>
              </VStack>
            </View>
          </View>

          <VStack space="xs">
            <Text bold>หมายเหตุ</Text>
            <Textarea style={styles.textArea}>
              <TextareaInput
                value={note}
                onChangeText={setNote}
                placeholder="ข้อควรระวังหรือคำแนะนำเพิ่มเติม"
              />
            </Textarea>
          </VStack>

          <Button
            style={[styles.link, isTablet && styles.linkTablet]}
            onPress={() => router.dismissTo('/(tabs)')}>
            <ButtonText>บันทึกและกลับหน้าหลัก</ButtonText>
          </Button>
        </Box>
      </ScrollView>
    </Box>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  contentTablet: {
    alignItems: 'center',
  },
  formCard: {
    borderRadius: 14,
    padding: 16,
    gap: 8,
    width: '100%',
    maxWidth: 980,
  },
  fieldGrid: {
    width: '100%',
  },
  fieldGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldItem: {
    width: '100%',
  },
  fieldItemTablet: {
    width: '48%',
  },
  input: {
    marginBottom: 8,
  },
  textArea: {
    marginBottom: 8,
    minHeight: 96,
  },
  link: {
    borderRadius: 12,
    marginTop: 12,
  },
  linkTablet: {
    alignSelf: 'center',
    width: '50%',
  },
});
