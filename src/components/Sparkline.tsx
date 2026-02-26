type SparklineProps = {
  values: number[];
};

export function Sparkline({ values }: SparklineProps) {
  if (!values.length) return null;

  const width = 160;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="url(#sparkGradient)" strokeWidth="1" strokeLinecap="round" />
      <defs>
        <linearGradient id="sparkGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.8)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
