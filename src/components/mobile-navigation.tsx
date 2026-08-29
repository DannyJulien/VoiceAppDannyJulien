import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Layout } from '@/constants/theme';

const destinations = [
  { icon: '●', label: 'Capture', path: '/home' },
  { icon: '≡', label: 'Timeline', path: '/timeline' },
  { icon: '□', label: 'Calendar', path: '/calendar' },
  { icon: '◇', label: 'Projects', path: '/projects' },
  { icon: '◌', label: 'People', path: '/contacts' },
] as const;

// Space between the pill and the physical bottom edge when the device has no home indicator.
const MIN_BOTTOM_GAP = 12;

function isCurrent(pathname: string, destination: (typeof destinations)[number]['path']) {
  if (destination === '/home') return pathname === '/home' || pathname === '/';
  return pathname === destination || pathname.startsWith(`${destination}/`);
}

export function MobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // On phones with a home indicator the inset (~34pt) already clears it; otherwise use a fixed gap.
  const bottomGap = Math.max(insets.bottom, MIN_BOTTOM_GAP);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomGap }]}>
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

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.canvas,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.nav,
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: Layout.contentMaxWidth,
    paddingHorizontal: 8,
    paddingVertical: 8,
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
    paddingVertical: 8,
  },
  itemSelected: { backgroundColor: 'rgba(255,255,255,0.12)' },
  pressed: { opacity: 0.72 },
  iconWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 21, minWidth: 24 },
  icon: { color: '#98A2B3', fontSize: 18, fontWeight: '900', lineHeight: 21 },
  iconSelected: { color: '#FFFFFF' },
  label: { color: '#98A2B3', fontSize: 11, fontWeight: '700' },
  labelSelected: { color: '#FFFFFF', fontWeight: '900' },
});
