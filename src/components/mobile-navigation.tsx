import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

const destinations = [
  { icon: '●', label: 'Capture', path: '/home' },
  { icon: '↗', label: 'Timeline', path: '/inbox' },
  { icon: '□', label: 'Projects', path: '/projects' },
  { icon: '◌', label: 'People', path: '/contacts' },
] as const;

function isCurrent(pathname: string, destination: (typeof destinations)[number]['path']) {
  if (destination === '/home') return pathname === '/home' || pathname === '/';
  return pathname === destination || pathname.startsWith(`${destination}/`);
}

export function MobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
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
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Text style={[styles.icon, selected && styles.iconSelected]}>{destination.icon}</Text>
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {destination.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: Colors.nav },
  bar: {
    alignItems: 'center',
    backgroundColor: Colors.nav,
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: 68,
    paddingHorizontal: 8,
    paddingTop: 7,
  },
  item: {
    alignItems: 'center',
    borderRadius: 14,
    gap: 2,
    minWidth: 58,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pressed: { opacity: 0.72 },
  icon: { color: '#98A2B3', fontSize: 18, fontWeight: '900', lineHeight: 21 },
  iconSelected: { color: '#FFFFFF' },
  label: { color: '#98A2B3', fontSize: 11, fontWeight: '700' },
  labelSelected: { color: '#FFFFFF', fontWeight: '900' },
});
