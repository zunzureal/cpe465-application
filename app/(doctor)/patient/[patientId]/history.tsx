import { useLocalSearchParams } from 'expo-router';
import { DoctorPatientHistory } from '@/components/screens/DoctorPatientHistory';

export default function HistoryScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  return <DoctorPatientHistory patientId={Number(patientId)} />;
}
