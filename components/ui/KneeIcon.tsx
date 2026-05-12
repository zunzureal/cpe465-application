/**
 * KneeIcon – Branded circle with a bone/joint icon.
 * Used on the Pre-Training (PREPARATION) screen.
 */
import { FontAwesome5 } from '@expo/vector-icons';
import { View } from 'react-native';

import { DSColors } from '@/constants/design-system';

interface KneeIconProps {
  size?: number;
  color?: string;
}

export function KneeIcon({ size = 96, color = DSColors.primary }: KneeIconProps) {
  const containerSize = size + 40;
  return (
    <View
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: containerSize / 2,
        backgroundColor: DSColors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FontAwesome5 name="bone" size={Math.round(size * 0.55)} color={color} />
    </View>
  );
}
