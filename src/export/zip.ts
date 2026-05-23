// Minimal store-only ZIP writer (no compression).
//
// PNG payloads are already compressed, so a "stored" zip adds only
// the per-file header overhead and avoids pulling in a full
// deflate implementation. The resulting archive is a valid ZIP that
// every standard tool — Finder, Explorer, `unzip`, 7-Zip — can open.

const textEncoder = new TextEncoder()

type Entry = {
  name: string
  data: Uint8Array
  crc32: number
  localHeaderOffset: number
}

// CRC-32 table, lazily built and reused across calls.
let crcTable: Uint32Array | null = null
function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
}

function crc32(bytes: Uint8Array): number {
  if (!crcTable) crcTable = buildCrcTable()
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

export class ZipWriter {
  private entries: Entry[] = []
  private chunks: Uint8Array[] = []
  private offset = 0

  private push(bytes: Uint8Array) {
    this.chunks.push(bytes)
    this.offset += bytes.length
  }

  add(name: string, data: Uint8Array) {
    const nameBytes = textEncoder.encode(name)
    const crc = crc32(data)
    const localHeaderOffset = this.offset

    // Local file header
    const header = new Uint8Array(30 + nameBytes.length)
    const dv = new DataView(header.buffer)
    dv.setUint32(0, 0x04034b50, true)
    dv.setUint16(4, 20, true) // version needed
    dv.setUint16(6, 0, true) // flags
    dv.setUint16(8, 0, true) // method = stored
    dv.setUint16(10, 0, true) // mtime
    dv.setUint16(12, 0, true) // mdate
    dv.setUint32(14, crc, true)
    dv.setUint32(18, data.length, true) // compressed size
    dv.setUint32(22, data.length, true) // uncompressed size
    dv.setUint16(26, nameBytes.length, true)
    dv.setUint16(28, 0, true) // extra field length
    header.set(nameBytes, 30)
    this.push(header)
    this.push(data)

    this.entries.push({ name, data, crc32: crc, localHeaderOffset })
  }

  finalize(): Blob {
    const centralDirOffset = this.offset
    for (const entry of this.entries) {
      const nameBytes = textEncoder.encode(entry.name)
      const cdh = new Uint8Array(46 + nameBytes.length)
      const dv = new DataView(cdh.buffer)
      dv.setUint32(0, 0x02014b50, true)
      dv.setUint16(4, 20, true) // version made by
      dv.setUint16(6, 20, true) // version needed
      dv.setUint16(8, 0, true) // flags
      dv.setUint16(10, 0, true) // method
      dv.setUint16(12, 0, true) // mtime
      dv.setUint16(14, 0, true) // mdate
      dv.setUint32(16, entry.crc32, true)
      dv.setUint32(20, entry.data.length, true)
      dv.setUint32(24, entry.data.length, true)
      dv.setUint16(28, nameBytes.length, true)
      dv.setUint16(30, 0, true) // extra
      dv.setUint16(32, 0, true) // comment
      dv.setUint16(34, 0, true) // disk
      dv.setUint16(36, 0, true) // internal attrs
      dv.setUint32(38, 0, true) // external attrs
      dv.setUint32(42, entry.localHeaderOffset, true)
      cdh.set(nameBytes, 46)
      this.push(cdh)
    }
    const centralDirSize = this.offset - centralDirOffset

    // End of central directory record
    const eocd = new Uint8Array(22)
    const dv = new DataView(eocd.buffer)
    dv.setUint32(0, 0x06054b50, true)
    dv.setUint16(4, 0, true) // disk
    dv.setUint16(6, 0, true) // disk where CD starts
    dv.setUint16(8, this.entries.length, true)
    dv.setUint16(10, this.entries.length, true)
    dv.setUint32(12, centralDirSize, true)
    dv.setUint32(16, centralDirOffset, true)
    dv.setUint16(20, 0, true) // comment length
    this.push(eocd)

    return new Blob(this.chunks as BlobPart[], { type: 'application/zip' })
  }
}
