import { describe, expect, test } from 'bun:test'
import { ZipWriter } from './zip'

const u8 = (s: string) => new TextEncoder().encode(s)

describe('ZipWriter', () => {
  test('emits a valid PK magic + EOCD', async () => {
    const z = new ZipWriter()
    z.add('hello.txt', u8('hello, world'))
    const blob = z.finalize()
    expect(blob.type).toBe('application/zip')
    const buf = new Uint8Array(await blob.arrayBuffer())
    // Local file header magic
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
    expect(buf[2]).toBe(0x03)
    expect(buf[3]).toBe(0x04)
    // End of central dir signature near the tail
    const dv = new DataView(buf.buffer, buf.byteOffset + buf.length - 22)
    expect(dv.getUint32(0, true)).toBe(0x06054b50)
    // Entry count == 1
    expect(dv.getUint16(8, true)).toBe(1)
  })

  test('round-trips multiple files with different sizes', async () => {
    const z = new ZipWriter()
    z.add('a.txt', u8('a'))
    z.add('big.bin', new Uint8Array(1024).fill(7))
    z.add('empty', new Uint8Array(0))
    const blob = z.finalize()
    expect(blob.size).toBeGreaterThan(1024)
    const buf = new Uint8Array(await blob.arrayBuffer())
    // EOCD count should be 3
    const dv = new DataView(buf.buffer, buf.byteOffset + buf.length - 22)
    expect(dv.getUint16(8, true)).toBe(3)
  })
})
