import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

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

export function MoreHorizontalIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Circle cx={5} cy={12} fill={color} r={1.5} />
      <Circle cx={12} cy={12} fill={color} r={1.5} />
      <Circle cx={19} cy={12} fill={color} r={1.5} />
    </IconFrame>
  );
}

export function CalendarIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M4 5h16a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke={color}
        {...stroke}
      />
      <Line stroke={color} x1={16} x2={16} y1={3} y2={7} {...stroke} />
      <Line stroke={color} x1={8} x2={8} y1={3} y2={7} {...stroke} />
      <Line stroke={color} x1={2} x2={22} y1={11} y2={11} {...stroke} />
    </IconFrame>
  );
}

export function MicrophoneIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" stroke={color} {...stroke} />
      <Path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke={color} {...stroke} />
    </IconFrame>
  );
}

export function TimelineIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Line stroke={color} x1={8} x2={21} y1={6} y2={6} {...stroke} />
      <Line stroke={color} x1={8} x2={21} y1={12} y2={12} {...stroke} />
      <Line stroke={color} x1={8} x2={21} y1={18} y2={18} {...stroke} />
      <Circle cx={4} cy={6} fill={color} r={1.5} />
      <Circle cx={4} cy={12} fill={color} r={1.5} />
      <Circle cx={4} cy={18} fill={color} r={1.5} />
    </IconFrame>
  );
}

export function FolderIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
        stroke={color}
        {...stroke}
      />
    </IconFrame>
  );
}

export function SearchIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Circle cx={11} cy={11} r={7} stroke={color} {...stroke} />
      <Line stroke={color} x1={16.2} x2={21} y1={16.2} y2={21} {...stroke} />
    </IconFrame>
  );
}

export function UsersIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={color} {...stroke} />
      <Circle cx={9} cy={7} r={4} stroke={color} {...stroke} />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={color} {...stroke} />
    </IconFrame>
  );
}

export function MessageIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        stroke={color}
        {...stroke}
      />
    </IconFrame>
  );
}

export function CopyIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Rect height={13} rx={2} ry={2} stroke={color} width={13} x={9} y={9} {...stroke} />
      <Path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke={color}
        {...stroke}
      />
    </IconFrame>
  );
}

export function MailIcon({ color, size = 20 }: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke={color}
        {...stroke}
      />
      <Polyline points="22 6 12 13 2 6" stroke={color} {...stroke} />
    </IconFrame>
  );
}
