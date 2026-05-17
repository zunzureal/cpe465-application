import { useLocalSearchParams } from 'expo-router';
import { DoctorPatientDetail } from '@/components/screens/DoctorPatientDetail';

export default function PatientDetailScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  return <DoctorPatientDetail patientId={Number(patientId)} />;
}
