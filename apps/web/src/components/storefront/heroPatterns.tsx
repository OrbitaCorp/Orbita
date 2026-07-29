// Capa decorativa detrás del hero en modo "imagen centrada" — compartida entre
// el storefront real (Inicio.tsx) y la vista previa de Apariencia
// (StorePreview.tsx) para que ambos rendericen exactamente lo mismo.
// Presets 100% CSS/SVG, sin assets nuevos.

export type HeroBgPattern = 'none' | 'rings' | 'dots' | 'waves' | 'diagonal' | string

export function renderHeroBgPattern(pattern: HeroBgPattern | undefined) {
  switch (pattern) {
    case 'rings':
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <svg style={{ position: 'absolute', top: '50%', right: '8%', transform: 'translateY(-50%)' }} width="440" height="440" viewBox="0 0 440 440">
            <circle cx="220" cy="220" r="200" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
            <circle cx="220" cy="220" r="150" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
            <circle cx="220" cy="220" r="100" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
          </svg>
        </div>
      )
    case 'dots':
      return (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(to right, transparent, black 60%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 60%)',
        }} />
      )
    case 'waves':
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-10%', right: '10%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', filter: 'blur(70px)' }} />
          <div style={{ position: 'absolute', bottom: '-15%', right: '28%', width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', filter: 'blur(60px)' }} />
        </div>
      )
    case 'diagonal':
      return (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(115deg, transparent 55%, rgba(255,255,255,0.14) 55%, rgba(255,255,255,0.14) 68%, transparent 68%)',
        }} />
      )
    default:
      return null
  }
}
