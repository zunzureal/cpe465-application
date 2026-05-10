/**
 * CircularTimer – SVG ring countdown for the Active Therapy Session.
 * Props:
 *   timeLeft       – remaining seconds (integer ≥ 0)
 *   totalSeconds   – full duration in seconds
 *   isPaused       – shows warning-orange ring while paused
 *   size           – outer dimension of the SVG (default 220)
 *   strokeWidth    – ring thickness (default 14)
 */
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { DSColors } from '@/constants/design-system';

interface CircularTimerProps {
  timeLeft: number;
  totalSeconds: number;
  isPaused?: boolean;
  size?: number;
  strokeWidth?: number;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CircularTimer({
  timeLeft,
  totalSeconds,
  isPaused = false,
  size = 220,
  strokeWidth = 14,
}: CircularTimerProps) {
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = totalSeconds > 0 ? timeLeft / totalSeconds : 0;
  const dashOffset = circumference * (1 - progress);

  const activeColor = isPaused ? DSColors.warning : DSColors.primary;
  const trackColor = DSColors.borderLight;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc — rotated so it starts at 12 o'clock */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>

      {/* Centered text overlay */}
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPaused && (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: DSColors.warning,
              marginBottom: 4,
              letterSpacing: 0.5,
            }}
          >
            ⏸ หยุดชั่วคราว
          </Text>
        )}
        <Text
          style={{
            fontSize: 48,
            fontWeight: '800',
            color: activeColor,
            letterSpacing: 2,
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatTime(timeLeft)}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: DSColors.text.secondary,
            marginTop: 2,
          }}
        >
          เวลาที่เหลือ
        </Text>
      </View>
    </View>
  );
}
