// Mantine's RingProgress component is too complicated for our needs, so we'll create a simple one.
export const CircularProgress = ({
  fraction,
  size = 12,
  strokeWidth = 1.5,
  minFraction = 0,
}: {
  fraction: number;
  minFraction?: number;
  size?: number;
  strokeWidth?: number;
}) => {
  if (fraction < minFraction) {
    fraction = minFraction;
  }
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - fraction * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {/* Background circle */}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--fg-divider)" strokeWidth={strokeWidth} />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`var(--fg-secondary)`}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
      />
    </svg>
  );
};
