import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '@/constants/theme';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';

const destinations = [
  { icon: '●', label: 'Capture', path: '/home' },
  { icon: '≡', label: 'Timeline', path: '/timeline' },
  { icon: '□', label: 'Calendar', path: '/calendar' },
  { icon: '◇', label: 'Projects', path: '/projects' },
  { icon: '◌', label: 'People', path: '/contacts' },
] as const;

// Space between the pill and the physical bottom edge when the device has no home indicator.
const MIN_BOTTOM_GAP = 12;
// The full home-indicator inset (~34pt) leaves the pill floating too high; pull it down this much.
const INSET_OVERLAP = 12;
// Rendered height of the pill itself (item padding + icon + label + bar padding).
const BAR_HEIGHT = 60;
// Breathing room between the last piece of content and the top of the pill.
const CONTENT_GAP = 16;

function useBottomGap() {
  const insets = useSafeAreaInsets();
  // Sit just above the home indicator; on devices without one fall back to a fixed gap.
  return Math.max(insets.bottom - INSET_OVERLAP, MIN_BOTTOM_GAP);
}

/**
 * The tab bar floats over the screen, so scrolling content needs this much bottom padding
 * to be able to scroll fully above the pill. Spread into a ScrollView's contentContainerStyle.
 */
export function useTabBarInset() {
  const bottomGap = useBottomGap();
  return { paddingBottom: bottomGap + BAR_HEIGHT + CONTENT_GAP };
}

function isCurrent(pathname: string, destination: (typeof destinations)[number]['path']) {
  if (destination === '/home') return pathname === '/home' || pathname === '/';
  return pathname === destination || pathname.startsWith(`${destination}/`);
}

export function MobileNavigation() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const pathname = usePathname();
  const router = useRouter();
  const bottomGap = useBottomGap();

  return (
    // box-none: the transparent gutter around the pill lets touches reach the content beneath.
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: bottomGap }]}>
      <View style={styles.bar}>
        {destinations.map((destination) => {
          const selected = isCurrent(pathname, destination.path);
          return (
            <Pressable
              accessibilityLabel={destination.label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={destination.path}
              onPress={() => router.replace(destination.path as never)}
              style={({ pressed }) => [
                styles.item,
                selected && styles.itemSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconWrap}>
                <Text style={[styles.icon, selected && styles.iconSelected]}>
                  {destination.icon}
                </Text>
              </View>
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {destination.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrapper: {
    // Overlay the screen content instead of reserving a strip below it.
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    paddingHorizontal: 20,
  },
  bar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.nav,
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: Layout.contentMaxWidth,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: '100%',
    // Soft lift so the pill reads as floating above the page.
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  item: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  itemSelected: { backgroundColor: 'rgba(255,255,255,0.12)' },
  pressed: { opacity: 0.72 },
  iconWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 21, minWidth: 24 },
  icon: { color: '#98A2B3', fontSize: 18, fontWeight: '900', lineHeight: 21 },
  iconSelected: { color: '#FFFFFF' },
  label: { color: '#98A2B3', fontSize: 11, fontWeight: '700' },
  labelSelected: { color: '#FFFFFF', fontWeight: '900' },
});
