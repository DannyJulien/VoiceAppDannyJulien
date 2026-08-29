import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { Colors, Layout } from '@/constants/theme';
import { getActions } from '@/features/actions/action-service';
import { useAuth } from '@/features/auth/auth-provider';

/**
 * Floating Inbox entry, rendered once in the app layout so it sits on every screen.
 * The badge counts captures still waiting for approval.
 */
export function InboxButton() {
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

  if (pathname === '/inbox') return null;

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + 8 }]}>
      <View pointerEvents="box-none" style={styles.column}>
        <Pressable
          accessibilityLabel={
            pendingCount
              ? `Inbox, ${pendingCount} ${pendingCount === 1 ? 'capture' : 'captures'} to approve`
              : 'Inbox'
          }
          accessibilityRole="button"
          onPress={() => router.push('/inbox')}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.icon}>↗</Text>
          <Text style={styles.label}>Inbox</Text>
          {pendingCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { left: 0, position: 'absolute', right: 0, zIndex: 10 },
  column: {
    alignItems: 'flex-end',
    alignSelf: 'center',
    maxWidth: Layout.contentMaxWidth,
    paddingHorizontal: Layout.horizontalPadding,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 999,
    borderWidth: 1,
    elevation: 3,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 13,
    shadowColor: Colors.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  pressed: { opacity: 0.8 },
  icon: { color: Colors.brand, fontSize: 16, fontWeight: '900' },
  label: { color: Colors.ink, fontSize: 13, fontWeight: '800' },
  badge: {
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -8,
    top: -8,
  },
  badgeText: { color: Colors.surface, fontSize: 10, fontWeight: '900', lineHeight: 14 },
});
