import Svg, { Line, Path, Polyline } from 'react-native-svg';

/**
 * Line icons drawn from Feather (https://feathericons.com, MIT). Feather's 24x24 grid and
 * 2px round stroke match the weight of the app's type, and because these are real vectors
 * the colour comes from the `color` prop instead of a font's own rendering.
 */
type IconProps = {
  color: string;
  /** Rendered size in points. The 24x24 viewBox scales to it. */
  size?: number;
};

const stroke = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 2,
} as const;

function IconFrame({ children, size }: { children: React.ReactNode; size: number }) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {children}
    </Svg>
  );
}
export function PlusIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Line stroke={color} x1={12} x2={12} y1={5} y2={19} {...stroke} />
      <Line stroke={color} x1={5} x2={19} y1={12} y2={12} {...stroke} />
    </IconFrame>
  );
}

export function PencilIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Path d="M12 20h9" stroke={color} {...stroke} />
      <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" stroke={color} {...stroke} />
    </IconFrame>
  );
}

export function TrashIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Polyline points="3 6 5 6 21 6" stroke={color} {...stroke} />
      <Path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke={color}
        {...stroke}
      />
      <Line stroke={color} x1={10} x2={10} y1={11} y2={17} {...stroke} />
      <Line stroke={color} x1={14} x2={14} y1={11} y2={17} {...stroke} />
    </IconFrame>
  );
}
