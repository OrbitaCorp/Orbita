import { describe, expect, it } from 'vitest'
import { headersDeIpDelCliente, ipDelVisitante } from '../bff'

// Hallazgo rate-limit-ip-proxy (auditoría interna 10/09): el BFF reenvía la
// IP real del visitante a la API con un secreto compartido. Sin
// BFF_IP_SECRET no manda nada, y nunca manda algo que no parezca una IP.

const SECRETO = 's'.repeat(32)

function req(headers: Record<string, string | string[]>, remoteAddress?: string) {
  return { headers, socket: { remoteAddress } as { remoteAddress?: string } } as Parameters<typeof ipDelVisitante>[0]
}

describe('ipDelVisitante', () => {
  it('toma el primer valor de X-Forwarded-For (el que escribe Vercel)', () => {
    expect(ipDelVisitante(req({ 'x-forwarded-for': '190.190.1.2, 76.76.21.21' }))).toBe('190.190.1.2')
    expect(ipDelVisitante(req({ 'x-forwarded-for': ['190.190.1.2', '1.1.1.1'] }))).toBe('190.190.1.2')
  })

  it('cae a X-Real-Ip y después al socket', () => {
    expect(ipDelVisitante(req({ 'x-real-ip': '181.1.1.1' }))).toBe('181.1.1.1')
    expect(ipDelVisitante(req({}, '127.0.0.1'))).toBe('127.0.0.1')
  })

  it('descarta lo que no parece una IP', () => {
    expect(ipDelVisitante(req({ 'x-forwarded-for': 'no-es-ip' }))).toBeNull()
    expect(ipDelVisitante(req({ 'x-forwarded-for': 'basura', 'x-real-ip': '2800:810:4ea:2c4::1' }))).toBe('2800:810:4ea:2c4::1')
  })
})

describe('headersDeIpDelCliente', () => {
  it('sin BFF_IP_SECRET (o demasiado corto) no manda nada', () => {
    const r = req({ 'x-forwarded-for': '190.190.1.2' })
    expect(headersDeIpDelCliente(r, {})).toEqual({})
    expect(headersDeIpDelCliente(r, { BFF_IP_SECRET: 'corto' })).toEqual({})
  })

  it('con secreto manda la IP y el secreto en los headers propios', () => {
    const r = req({ 'x-forwarded-for': '190.190.1.2, 76.76.21.21' })
    expect(headersDeIpDelCliente(r, { BFF_IP_SECRET: SECRETO })).toEqual({
      'X-Orbita-Client-Ip': '190.190.1.2',
      'X-Orbita-Client-Ip-Secret': SECRETO,
    })
  })

  it('con secreto pero sin una IP válida no manda nada (ni el secreto)', () => {
    expect(headersDeIpDelCliente(req({ 'x-forwarded-for': 'basura' }), { BFF_IP_SECRET: SECRETO })).toEqual({})
  })
})
