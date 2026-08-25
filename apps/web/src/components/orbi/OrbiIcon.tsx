export function OrbiIcon({ size = 24, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: size, height: size }}>
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeOpacity={0.5} strokeWidth="1.8" strokeDasharray="38 16" strokeLinecap="round" />
      <circle cx="18.5" cy="5.5" r="2.5" fill={color} fillOpacity={0.9} />
      <circle cx="12" cy="12" r="3" fill={color} />
    </svg>
  )
}
