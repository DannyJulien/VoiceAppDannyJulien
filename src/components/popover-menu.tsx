import type { ReactElement } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { type AppColors, useTheme } from '@/features/theme/theme-provider';

/** Window coordinates of the control the menu should visually hang from. */
export type PopoverAnchor = { height: number; width: number; x: number; y: number };

export type PopoverMenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  /** Called with the resolved colour, so the icon always matches the row's tone. */
  renderIcon: (color: string, size: number) => ReactElement;
  tone?: 'neutral' | 'danger';
  loading?: boolean;
  /** Small line under the row, e.g. a destructive-action warning. */
  hint?: string;
};

const ICON_SIZE = 20;
const MENU_WIDTH = 264;

/**
 * Compact context menu anchored to the control that opened it: one line per action.
 * Rendered in a Modal so it floats above the scroll content on every platform, and
 * a tap anywhere outside the menu dismisses it.
 */
export function PopoverMenu({
  visible,
  anchor,
  items,
  onRequestClose,
}: {
  visible: boolean;
  anchor: PopoverAnchor | null;
  items: PopoverMenuItem[];
  onRequestClose: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const window = useWindowDimensions();

  if (!anchor) return null;

  // Hang the menu from the anchor's bottom-right corner, but never off-screen.
  const right = Math.max(window.width - (anchor.x + anchor.width), 12);
  const top = Math.min(anchor.y + anchor.height + 8, window.height - 96);

  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}>
      <Pressable accessibilityLabel="Close menu" onPress={onRequestClose} style={styles.backdrop} />
      <View
        accessibilityRole="menu"
        style={[styles.menu, { maxWidth: window.width - 24, right, top }]}
      >
        {items.map((item) => {
          const tint = item.tone === 'danger' ? colors.danger : colors.ink;
          const iconTint = item.tone === 'danger' ? colors.danger : colors.brand;
          return (
            <View key={item.key}>
              <Pressable
                accessibilityRole="menuitem"
                accessibilityState={{ busy: item.loading }}
                disabled={item.loading}
                onPress={item.onPress}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                {item.loading ? (
                  <ActivityIndicator color={iconTint} size="small" />
                ) : (
                  item.renderIcon(iconTint, ICON_SIZE)
                )}
                <Text numberOfLines={1} style={[styles.rowLabel, { color: tint }]}>
                  {item.label}
                </Text>
              </Pressable>
              {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
            </View>
          );
        })}
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      backgroundColor: `${colors.ink}14`,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    menu: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      elevation: 12,
      paddingVertical: 8,
      position: 'absolute',
      shadowColor: colors.ink,
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 22,
      width: MENU_WIDTH,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 48,
      paddingHorizontal: 18,
    },
    rowPressed: { backgroundColor: colors.canvas },
    rowLabel: { flex: 1, fontSize: 15, fontWeight: '800' },
    // Indented past the icon so the warning reads as part of the row above it.
    hint: {
      color: colors.danger,
      fontSize: 12,
      lineHeight: 16,
      paddingBottom: 8,
      paddingLeft: 50,
      paddingRight: 18,
    },
  });
