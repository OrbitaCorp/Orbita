import { useState } from 'react'
import { DateInput } from '../../../_shared/components'

const MONO = '"Geist Mono", "Fira Code", monospace'

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  prefix?: string
  suffix?: string
  error?: string
  mono?: boolean
}

export function FormField({ label, prefix, suffix, error, mono, disabled, ...props }: FieldProps) {
  const [focus, setFocus] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}
          htmlFor={props.id}
        >
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 40,
          padding: '0 12px',
          gap: 6,
          background: disabled ? 'var(--color-surface-alt)' : 'var(--color-bg)',
          border: `1px solid ${error ? 'var(--color-error)' : focus ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 8,
          opacity: disabled ? 0.55 : 1,
          boxShadow: focus && !error ? '0 0 0 3px rgba(59,130,246,.12)' : 'none',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
      >
        {prefix && (
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: 14,
              fontFamily: mono ? MONO : 'inherit',
              flexShrink: 0,
            }}
          >
            {prefix}
          </span>
        )}
        {props.type === 'date' ? (
          <DateInput
            id={props.id}
            value={typeof props.value === 'string' ? props.value : ''}
            onChange={(v) => props.onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>)}
            disabled={disabled}
            onFocus={(e) => {
              setFocus(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocus(false)
              props.onBlur?.(e)
            }}
            style={{
              flex: 1,
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              color: 'var(--color-text)',
              fontFamily: mono ? MONO : 'inherit',
              minWidth: 0,
              cursor: disabled ? 'default' : 'text',
            }}
          />
        ) : (
          <input
            {...props}
            disabled={disabled}
            onFocus={(e) => {
              setFocus(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocus(false)
              props.onBlur?.(e)
            }}
            style={{
              flex: 1,
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              color: 'var(--color-text)',
              fontFamily: mono ? MONO : 'inherit',
              minWidth: 0,
              cursor: disabled ? 'default' : 'text',
            }}
          />
        )}
        {suffix && (
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: 14,
              fontFamily: mono ? MONO : 'inherit',
              flexShrink: 0,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <span style={{ fontSize: 12, color: 'var(--color-error)' }}>{error}</span>
      )}
    </div>
  )
}

interface SectionCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

interface LabelRowProps {
  label: string
  right?: React.ReactNode
}

export function LabelRow({ label, right }: LabelRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}
    >
      <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>
        {label}
      </label>
      {right}
    </div>
  )
}
