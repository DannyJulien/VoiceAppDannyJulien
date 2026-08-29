import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Layout } from '@/constants/theme';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { getActions } from '@/features/actions/action-service';
import { useAuth } from '@/features/auth/auth-provider';

/**
 * The persistent account controls share a single baseline with the Handled mark on Capture.
 * Keeping Settings here avoids adding a sixth item to the mobile navigation pill.
 */
export function HeaderActions() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const actionsQuery = useQuery({
    queryKey: ['actions', session?.user.id, 'all'],
    queryFn: () => getActions(session!.user.id, 'all'),
    enabled: Boolean(session?.user.id),
  });
  const pendingCount =
    actionsQuery.data?.filter((action) => action.status === 'pending').length ?? 0;
  const isInbox = pathname === '/inbox';
  const isSettings = pathname === '/settings';
  const accountInitial = session?.user.email?.trim().charAt(0).toUpperCase() || 'U';

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + 8 }]}>
      <View pointerEvents="box-none" style={styles.row}>
        {!isInbox ? (
          <Pressable
            accessibilityLabel={
              pendingCount
                ? `Inbox, ${pendingCount} ${pendingCount === 1 ? 'capture' : 'captures'} to approve`
                : 'Inbox'
            }
            accessibilityRole="button"
            onPress={() => router.push('/inbox')}
            style={({ pressed }) => [styles.inboxButton, pressed && styles.pressed]}
          >
            <Text style={styles.inboxIcon}>↗</Text>
            <Text style={styles.inboxLabel}>Inbox</Text>
            {pendingCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        {!isSettings ? (
          <Pressable
            accessibilityLabel="Open account settings"
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
          >
            <Text style={styles.accountInitial}>{accountInitial}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  layer: { left: 0, position: 'absolute', right: 0, zIndex: 10 },
  row: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    maxWidth: Layout.contentMaxWidth,
    paddingHorizontal: Layout.horizontalPadding,
    width: '100%',
  },
  inboxButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    elevation: 3,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 13,
    shadowColor: colors.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  accountButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderColor: colors.surface,
    borderRadius: 20,
    borderWidth: 2,
    elevation: 3,
    height: 40,
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    width: 40,
  },
  accountInitial: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.8 },
  inboxIcon: { color: colors.brand, fontSize: 16, fontWeight: '900' },
  inboxLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderColor: colors.surface,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -8,
    top: -8,
  },
  badgeText: { color: colors.surface, fontSize: 10, fontWeight: '900', lineHeight: 14 },
});
