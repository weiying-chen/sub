import { readFile } from 'node:fs/promises'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

export async function readTextFile(path: string): Promise<string> {
  const bytes = await readFile(path)

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le')
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const content = Buffer.from(bytes.subarray(2))
    if (content.length % 2 !== 0) {
      throw new Error(`Invalid UTF-16BE byte length: ${path}`)
    }
    content.swap16()
    return content.toString('utf16le')
  }

  const hasUtf8Bom = bytes
    .subarray(0, UTF8_BOM.length)
    .equals(UTF8_BOM)
  return bytes.subarray(hasUtf8Bom ? UTF8_BOM.length : 0).toString('utf8')
}
