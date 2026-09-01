import { useRef, useState } from 'react';
import { View, type ViewStyle } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { MoreHorizontalIcon } from '@/components/icons';
import { type PopoverAnchor, PopoverMenu, type PopoverMenuItem } from '@/components/popover-menu';

type MoreMenuProps = {
  /** Spoken name of the More button, e.g. "Open note actions". */
  accessibilityLabel: string;
  items: PopoverMenuItem[];
  visible: boolean;
  onOpen: () => void;
  onRequestClose: () => void;
  style?: ViewStyle;
};

/**
 * The "More" button and the actions menu that hangs from it. The parent owns `visible`
 * so it can close the menu itself once an action settles; this component owns the
 * button's window position, which the menu needs to anchor to the right spot.
 */
export function MoreMenu({
  accessibilityLabel,
  items,
  visible,
  onOpen,
  onRequestClose,
  style,
}: MoreMenuProps) {
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const buttonRef = useRef<View>(null);

  function open() {
    // The menu hangs from the More button, so it needs the button's window position.
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ height, width, x, y });
      onOpen();
    });
  }

  return (
    <>
      <View collapsable={false} ref={buttonRef} style={style}>
        <IconButton
          accessibilityLabel={accessibilityLabel}
          label="More"
          onPress={open}
          renderIcon={(color, size) => <MoreHorizontalIcon color={color} size={size} />}
        />
      </View>
      <PopoverMenu
        anchor={anchor}
        items={items}
        onRequestClose={onRequestClose}
        visible={visible}
      />
    </>
  );
}
