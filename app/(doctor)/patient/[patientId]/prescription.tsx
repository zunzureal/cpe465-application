import { useLocalSearchParams } from 'expo-router';
import { DoctorPrescriptionForm } from '@/components/screens/DoctorPrescriptionForm';

export default function PrescriptionScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  return <DoctorPrescriptionForm patientId={Number(patientId)} />;
}
