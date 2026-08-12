// Parser for the PSP/PS3 PARAM.SFO metadata blob (key/value table). We use it to
// read the official game TITLE and DISC_ID straight from a PSP image, instead of
// guessing from the file name.

export interface ParamSfo {
  title?: string;
  discId?: string;
  values: Record<string, string | number>;
}

// "\0PSF" as a little-endian uint32.
const SFO_MAGIC = 0x46535000;
const FMT_INT32 = 0x0404;

export const parseParamSfo = (buf: Buffer): ParamSfo | null => {
  if (buf.length < 20) return null;
  if (buf.readUInt32LE(0) !== SFO_MAGIC) return null;

  const keyTableStart = buf.readUInt32LE(8);
  const dataTableStart = buf.readUInt32LE(12);
  const numEntries = buf.readUInt32LE(16);
  if (keyTableStart > buf.length || dataTableStart > buf.length) return null;
  // Sanity guard against a corrupt count.
  if (numEntries > 10000) return null;

  const values: Record<string, string | number> = {};

  for (let i = 0; i < numEntries; i++) {
    const base = 20 + i * 16;
    if (base + 16 > buf.length) break;

    const keyOffset = buf.readUInt16LE(base);
    const dataFmt = buf.readUInt16LE(base + 2);
    const dataLen = buf.readUInt32LE(base + 4);
    const dataOffset = buf.readUInt32LE(base + 12);

    const keyStart = keyTableStart + keyOffset;
    if (keyStart >= buf.length) continue;
    let keyEnd = keyStart;
    while (keyEnd < buf.length && buf[keyEnd] !== 0) keyEnd++;
    const key = buf.toString("utf8", keyStart, keyEnd);
    if (!key) continue;

    const dataStart = dataTableStart + dataOffset;
    if (dataStart > buf.length) continue;

    if (dataFmt === FMT_INT32) {
      if (dataStart + 4 <= buf.length) values[key] = buf.readUInt32LE(dataStart);
    } else {
      const end = Math.min(dataStart + dataLen, buf.length);
      let str = buf.toString("utf8", dataStart, end);
      const nul = str.indexOf("\0");
      if (nul !== -1) str = str.slice(0, nul);
      values[key] = str.trim();
    }
  }

  const title = typeof values.TITLE === "string" ? values.TITLE : undefined;
  const discId =
    typeof values.DISC_ID === "string" ? values.DISC_ID : undefined;

  return { title, discId, values };
};
