import { useLocalSearchParams } from 'expo-router';

import { ActiveTherapySession } from '@/components/screens/ActiveTherapySession';

export default function TherapySessionScreen() {
  const params = useLocalSearchParams<{
    isManualMode?: string;
    angleStart?: string;
    angleEnd?: string;
    durationMinutes?: string;
    speedLevel?: string;
    forceCeilingN?: string;
    forceLevel?: string;
  }>();
  const manual = params.isManualMode === 'true';

  const parseNum = (s?: string): number | undefined => {
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <ActiveTherapySession
      isManualMode={manual}
      manualOverrides={
        manual
          ? {
              angleStart: parseNum(params.angleStart),
              angleEnd: parseNum(params.angleEnd),
              durationMinutes: parseNum(params.durationMinutes),
              speedLevel: parseNum(params.speedLevel),
              forceCeilingN: parseNum(params.forceCeilingN),
              forceLevel: parseNum(params.forceLevel),
            }
          : undefined
      }
    />
  );
}
