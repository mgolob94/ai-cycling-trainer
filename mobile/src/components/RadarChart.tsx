import { View } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';

import { lightColors } from '../theme';

export interface RadarAxis {
  label: string;
  value: number; // user value (percent)
  ideal: number; // ideal/reference value (percent), typically 100
}

interface Props {
  data: RadarAxis[];
  size?: number;
}

/** Simple radar/spider chart: user polygon vs an "ideal" reference polygon. */
export default function RadarChart({ data, size = 260 }: Props) {
  const n = data.length;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 34; // leave room for labels
  const maxValue = Math.max(150, ...data.map((d) => d.value), ...data.map((d) => d.ideal));

  // Axis i points at angle starting from top (-90°), clockwise.
  const angleFor = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const point = (i: number, valuePct: number) => {
    const r = (valuePct / maxValue) * radius;
    return {
      x: cx + r * Math.cos(angleFor(i)),
      y: cy + r * Math.sin(angleFor(i)),
    };
  };

  const toPolygon = (key: 'value' | 'ideal') =>
    data.map((d, i) => { const p = point(i, d[key]); return `${p.x},${p.y}`; }).join(' ');

  const rings = [50, 100, 150].filter((v) => v <= maxValue);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* concentric reference rings */}
        {rings.map((ring) => (
          <Polygon
            key={`ring-${ring}`}
            points={data
              .map((_, i) => { const p = point(i, ring); return `${p.x},${p.y}`; })
              .join(' ')}
            fill="none"
            stroke={lightColors.border}
            strokeWidth={1}
          />
        ))}

        {/* axes + labels */}
        {data.map((d, i) => {
          const end = point(i, maxValue);
          const labelP = point(i, maxValue + 16);
          return (
            <Line key={`axis-${i}`} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={lightColors.border} strokeWidth={1} />
          );
        })}
        {data.map((d, i) => {
          const labelP = point(i, maxValue + 14);
          return (
            <SvgText
              key={`lab-${i}`}
              x={labelP.x}
              y={labelP.y + 3}
              fontSize={10}
              fill={lightColors.textMuted}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          );
        })}

        {/* ideal polygon (reference) */}
        <Polygon points={toPolygon('ideal')} fill="none" stroke={lightColors.textMuted} strokeWidth={1} strokeDasharray="4 3" />

        {/* user polygon */}
        <Polygon points={toPolygon('value')} fill={`${lightColors.primary}33`} stroke={lightColors.primary} strokeWidth={2} />
        {data.map((d, i) => { const p = point(i, d.value); return (
          <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3} fill={lightColors.primary} />
        ); })}
      </Svg>
    </View>
  );
}
