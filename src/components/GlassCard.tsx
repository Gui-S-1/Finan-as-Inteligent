import type { PropsWithChildren } from 'react';
import clsx from 'clsx';

type GlassCardProps = PropsWithChildren<{
  className?: string;
}>;

export function GlassCard({ className, children }: GlassCardProps) {
  return <section className={clsx('glass-card', className)}>{children}</section>;
}
