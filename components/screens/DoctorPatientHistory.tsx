/**
 * Doctor Patient History — paginated session list with summary stats.
 * Uses getDoctorPatientSessions (authenticated), with graceful fallback to
 * the unauthenticated endpoint if the backend hasn't added auth yet.
 */

import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  DSColors,
  DSLayout,
  DSShadowSoft,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { getDoctorPatientSessions, type SessionWithResult } from '@/services/apiClient';
import { SessionHistoryCard } from '@/components/ui/SessionHistoryCard';

const PAGE_SIZE = 20;

interface Props {
  patientId: number;
}

export function DoctorPatientHistory({ patientId }: Props) {
  const router = useRouter();
  const { authToken } = useAuth();

  const [sessions, setSessions] = useState<SessionWithResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (!authToken) {
        setError('ไม่มีสิทธิ์เข้าถึง');
        setIsLoading(false);
        return;
      }

      if (replace) setIsLoading(true);
      else setIsFetchingMore(true);

      setError(null);

      try {
        const res = await getDoctorPatientSessions(patientId, authToken, {
          limit: PAGE_SIZE,
          offset,
        });

        if (!res.success || !res.data) {
          setError(res.error ?? 'ไม่สามารถโหลดประวัติได้');
          return;
        }

        setSessions((prev) => (replace ? res.data!.sessions : [...prev, ...res.data!.sessions]));
        setTotal(res.data.total);
      } catch {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        if (replace) setIsLoading(false);
        else setIsFetchingMore(false);
      }
    },
    [authToken, patientId]
  );

  useEffect(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  function loadMore() {
    if (isFetchingMore || sessions.length >= total) return;
    fetchPage(sessions.length, false);
  }

  // Compute summary stats
  const avgFlexion =
    sessions.length > 0
      ? Math.round(sessions.reduce((s, x) => s + x.actualMaxFlexion, 0) / sessions.length)
      : null;
  const avgPain =
    sessions.filter((s) => s.painLevel != null).length > 0
      ? (
          sessions.reduce((s, x) => s + (x.painLevel ?? 0), 0) /
          sessions.filter((s) => s.painLevel != null).length
        ).toFixed(1)
      : null;
  const metCount = sessions.filter((s) => s.targetMet).length;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <NavBar onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={DSColors.primary} />
          <Text style={styles.loadingText}>กำลังโหลดประวัติ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <NavBar onBack={() => router.back()} />

      {error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={52} color={DSColors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchPage(0, true)}>
            <Text style={styles.retryLabel}>ลองใหม่</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {/* Summary bar */}
              {sessions.length > 0 && (
                <View style={[styles.summaryBar, DSShadowSoft]}>
                  <SumCell label="เซสชันทั้งหมด" value={String(total)} />
                  <View style={styles.sumDivider} />
                  <SumCell
                    label="บรรลุเป้าหมาย"
                    value={`${metCount} / ${sessions.length}`}
                    color={DSColors.success}
                  />
                  <View style={styles.sumDivider} />
                  <SumCell
                    label="Avg Flexion"
                    value={avgFlexion != null ? `${avgFlexion}°` : '—'}
                  />
                  <View style={styles.sumDivider} />
                  <SumCell
                    label="Avg ความเจ็บปวด"
                    value={avgPain != null ? `${avgPain}/10` : '—'}
                    color={
                      avgPain != null && Number(avgPain) >= 7
                        ? DSColors.danger
                        : DSColors.text.primary
                    }
                  />
                </View>
              )}
              <Text style={styles.listHeader}>
                ประวัติเซสชัน · Session History ({total})
              </Text>
            </>
          }
          renderItem={({ item }) => <SessionHistoryCard session={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-outline" size={48} color={DSColors.text.secondary} />
              <Text style={styles.emptyText}>ยังไม่มีประวัติการรักษา</Text>
            </View>
          }
          ListFooterComponent={
            isFetchingMore ? (
              <ActivityIndicator
                size="small"
                color={DSColors.primary}
                style={styles.footerSpinner}
              />
            ) : sessions.length < total ? (
              <Pressable style={styles.loadMoreBtn} onPress={loadMore}>
                <Text style={styles.loadMoreLabel}>โหลดเพิ่มเติม</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function NavBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.navBar}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color={DSColors.primary} />
        <Text style={styles.backLabel}>ย้อนกลับ</Text>
      </Pressable>
      <View style={styles.navTitle}>
        <Text style={styles.title}>ประวัติการรักษา</Text>
        <Text style={styles.subtitle}>Session History</Text>
      </View>
    </View>
  );
}

function SumCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.sumCell}>
      <Text style={[styles.sumValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
  },
  errorText: {
    ...DSTypography.body,
    color: DSColors.danger,
    textAlign: 'center',
    marginHorizontal: 32,
  },
  retryBtn: {
    backgroundColor: DSColors.primary,
    borderRadius: DSShape.radiusButton,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryLabel: {
    ...DSTypography.bodyBold,
    color: '#fff',
  },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DSLayout.screenPadding,
    paddingVertical: 8,
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    ...DSTypography.body,
    color: DSColors.primary,
  },
  navTitle: {
    flex: 1,
  },
  title: {
    ...DSTypography.h2,
    color: DSColors.text.primary,
  },
  subtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },

  listContent: {
    paddingHorizontal: DSLayout.screenPadding,
    paddingBottom: 32,
  },

  summaryBar: {
    flexDirection: 'row',
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: 16,
    marginTop: 8,
  },
  sumCell: {
    flex: 1,
    alignItems: 'center',
  },
  sumValue: {
    ...DSTypography.dataSmall,
    color: DSColors.text.primary,
  },
  sumLabel: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  sumDivider: {
    width: 1,
    height: 32,
    backgroundColor: DSColors.border,
    marginHorizontal: 4,
    alignSelf: 'center',
  },

  listHeader: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    marginBottom: 12,
  },

  empty: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyText: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
  },

  footerSpinner: {
    marginVertical: 16,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  loadMoreLabel: {
    ...DSTypography.body,
    color: DSColors.primary,
  },
});
