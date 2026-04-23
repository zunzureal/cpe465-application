import { useLocalSearchParams } from 'expo-router';

import { ActiveTherapySession } from '@/components/screens/ActiveTherapySession';

export default function TherapySessionScreen() {
  const { isManualMode } = useLocalSearchParams<{ isManualMode?: string }>();
  const manual = isManualMode === 'true';

  return <ActiveTherapySession isManualMode={manual} />;
}
