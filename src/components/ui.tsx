import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps, type ViewProps } from 'react-native';

import { usePalette } from '@/lib/theme';

/** Surface card: warm white / carbon with hairline border. */
export function Card({ children, className, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-card border border-line bg-card dark:border-line-dark dark:bg-card-dark ${className ?? ''}`}
      {...rest}>
      {children}
    </View>
  );
}

/** Uppercase micro-label above data. */
export function SectionLabel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <Text
      className={`text-[11px] font-semibold uppercase tracking-[1.5px] text-ink-mut ${className ?? ''}`}>
      {children}
    </Text>
  );
}

/** Pressable with subtle scale + haptic. */
export function Press({
  children,
  onPress,
  haptic = true,
  className,
  ...rest
}: PressableProps & PropsWithChildren<{ haptic?: boolean; className?: string }>) {
  return (
    <Pressable
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      className={className}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      {...rest}>
      {children}
    </Pressable>
  );
}

export function Icon({ name, size = 20, tint, weight }: { name: SFSymbol; size?: number; tint?: string; weight?: 'regular' | 'medium' | 'semibold' | 'bold' }) {
  const p = usePalette();
  return <SymbolView name={name} size={size} tintColor={tint ?? p.ink} weight={weight ?? 'medium'} resizeMode="scaleAspectFit" />;
}

/** Full-width primary button. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  className,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: SFSymbol;
  className?: string;
}) {
  const p = usePalette();
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      className={`h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-ink dark:bg-ink-inv ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}>
      {icon ? <SymbolView name={icon} size={17} tintColor={p.isDark ? '#141412' : '#F6F6F3'} weight="semibold" /> : null}
      <Text className="text-[16px] font-semibold text-ink-inv dark:text-ink">{label}</Text>
    </Press>
  );
}

export function GhostButton({
  label,
  onPress,
  className,
}: {
  label: string;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Press
      onPress={onPress}
      className={`h-[48px] items-center justify-center rounded-2xl border border-line bg-transparent dark:border-line-dark ${className ?? ''}`}>
      <Text className="text-[15px] font-semibold text-ink dark:text-ink-inv">{label}</Text>
    </Press>
  );
}

/** Small stat: mono value + micro label. */
export function Stat({
  label,
  value,
  unit,
  color,
  align = 'left',
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const alignCls = align === 'center' ? 'items-center' : align === 'right' ? 'items-end' : 'items-start';
  return (
    <View className={alignCls}>
      <View className="flex-row items-baseline gap-1">
        <Text
          className="font-monosemi text-[17px] text-ink dark:text-ink-inv"
          style={color ? { color } : undefined}>
          {value}
        </Text>
        {unit ? <Text className="text-[11px] font-medium text-ink-mut">{unit}</Text> : null}
      </View>
      <SectionLabel className="mt-0.5 tracking-[1px]">{label}</SectionLabel>
    </View>
  );
}

export function Divider({ className }: { className?: string }) {
  return <View className={`h-px bg-line dark:bg-line-dark ${className ?? ''}`} />;
}

/** Row with chevron for settings-style lists. */
export function NavRow({
  title,
  detail,
  onPress,
  icon,
  destructive,
}: {
  title: string;
  detail?: ReactNode;
  onPress?: () => void;
  icon?: SFSymbol;
  destructive?: boolean;
}) {
  const p = usePalette();
  return (
    <Press onPress={onPress} disabled={!onPress} className="flex-row items-center gap-3 px-4 py-3.5">
      {icon ? <SymbolView name={icon} size={18} tintColor={destructive ? '#C24040' : p.inkSec} /> : null}
      <Text className={`flex-1 text-[15px] font-medium ${destructive ? 'text-[#C24040]' : 'text-ink dark:text-ink-inv'}`}>
        {title}
      </Text>
      {typeof detail === 'string' ? (
        <Text className="text-[14px] text-ink-mut">{detail}</Text>
      ) : (
        detail
      )}
      {onPress ? <SymbolView name="chevron.right" size={12} tintColor={p.inkFaint} /> : null}
    </Press>
  );
}
