import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';

import { clamp } from '@/lib/format';
import { usePalette } from '@/lib/theme';

/** Circular progress ring with arbitrary center content. Never "overfills" red — past 100% the ring simply completes. */
export function ProgressRing({
  size,
  stroke,
  progress,
  color,
  children,
}: PropsWithChildren<{ size: number; stroke: number; progress: number; color: string }>) {
  const p = usePalette();
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const sweep = clamp(progress, 0, 1) * 359.9;

  // arc as an SVG path (from 12 o'clock, clockwise) — avoids deprecated Path APIs
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(0));
  const y1 = cy + r * Math.sin(rad(0));
  const x2 = cx + r * Math.cos(rad(sweep));
  const y2 = cy + r * Math.sin(rad(sweep));
  const largeArc = sweep > 180 ? 1 : 0;
  const arc =
    sweep > 0
      ? Skia.Path.MakeFromSVGString(
          `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        )
      : null;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={cx} cy={cy} r={r} style="stroke" strokeWidth={stroke} color={p.raise} />
        {arc ? (
          <Path path={arc} style="stroke" strokeWidth={stroke} color={color} strokeCap="round" />
        ) : null}
      </Canvas>
      <View className="absolute inset-0 items-center justify-center">{children}</View>
    </View>
  );
}

/** Thin horizontal macro bar: label left, grams right, 6px rounded fill. */
export function MacroBar({
  label,
  color,
  consumed,
  target,
  remainingMode,
}: {
  label: string;
  color: string;
  consumed: number;
  target: number;
  remainingMode: boolean;
}) {
  const pct = target > 0 ? clamp(consumed / target, 0, 1) : 0;
  const remaining = Math.max(0, target - consumed);
  const over = consumed - target;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[12px] font-semibold text-ink-sec dark:text-ink-dsec">{label}</Text>
        <View className="flex-row items-baseline gap-1">
          <Text className="font-mono text-[13px] text-ink dark:text-ink-inv">
            {remainingMode
              ? over > 0.5
                ? `+${Math.round(over)}`
                : `${Math.round(remaining)}`
              : `${Math.round(consumed)}`}
          </Text>
          <Text className="text-[11px] text-ink-mut">
            {remainingMode ? (over > 0.5 ? 'g over' : 'g left') : `/ ${Math.round(target)} g`}
          </Text>
        </View>
      </View>
      <View className="h-[3px] overflow-hidden bg-raise dark:bg-raise-dark">
        <View
          className="h-full"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

/** Tiny sparkline for card corners (weight trend). */
export function Sparkline({
  values,
  width,
  height,
  color,
}: {
  values: number[];
  width: number;
  height: number;
  color: string;
}) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / span) * (height - pad * 2),
  }));
  const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
  const path = Skia.Path.MakeFromSVGString(d);
  if (!path) return <View style={{ width, height }} />;
  return (
    <Canvas style={{ width, height }}>
      <Path path={path} style="stroke" strokeWidth={2} color={color} strokeCap="round" strokeJoin="round" />
    </Canvas>
  );
}
