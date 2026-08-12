import { promises as fs } from "node:fs";
import path from "node:path";

import { logger } from "@main/services/logger";
import { parseParamSfo } from "./param-sfo";
import { readCsoLeadingData } from "./cso-reader";

// PSP images keep their metadata in /PSP_GAME/PARAM.SFO. We read that blob and
// pull the official TITLE / DISC_ID. Supports .pbp (header offsets), .iso and
// .cso (ISO9660 walk over the leading data). Best-effort: any failure returns
// null and the caller falls back to the file name.

const ISO_SECTOR = 2048;
const ISO_READ_LIMIT = 16 * 1024 * 1024; // PARAM.SFO lives near the start
const MAX_SFO_BYTES = 1024 * 1024;

export interface PspDiscInfo {
  title?: string;
  discId?: string;
}

// PARAM.SFO titles carry trademark glyphs ("God of War®: ...", "...(R)...") that
// hurt readability and box-art matching. Strip them.
const cleanPspTitle = (raw: string): string =>
  raw
    .replace(/[®™©]/g, "")
    .replace(/\((?:r|tm|c)\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

interface IsoEntry {
  lba: number;
  size: number;
}

const findEntryInDir = (
  iso: Buffer,
  dirLba: number,
  dirSize: number,
  targetName: string,
  wantDir: boolean
): IsoEntry | null => {
  let offset = dirLba * ISO_SECTOR;
  const end = Math.min(offset + dirSize, iso.length);

  while (offset < end) {
    const recLen = iso[offset];
    if (recLen === 0) {
      // records don't span sectors — jump to the next one
      offset = (Math.floor(offset / ISO_SECTOR) + 1) * ISO_SECTOR;
      continue;
    }
    if (offset + 33 > iso.length) break;

    const flags = iso[offset + 25];
    const isDir = (flags & 0x02) !== 0;
    const nameLen = iso[offset + 32];
    let name = iso.toString(
      "latin1",
      offset + 33,
      Math.min(offset + 33 + nameLen, iso.length)
    );
    const semi = name.indexOf(";");
    if (semi !== -1) name = name.slice(0, semi);

    if (name.toUpperCase() === targetName && isDir === wantDir) {
      return {
        lba: iso.readUInt32LE(offset + 2),
        size: iso.readUInt32LE(offset + 10),
      };
    }
    offset += recLen;
  }
  return null;
};

// Walk an ISO9660 image (in memory) to a file by path segments.
const findFileInIso = (iso: Buffer, segments: string[]): Buffer | null => {
  const pvdOffset = 16 * ISO_SECTOR;
  if (iso.length < pvdOffset + ISO_SECTOR) return null;
  if (iso.toString("latin1", pvdOffset + 1, pvdOffset + 6) !== "CD001") {
    return null;
  }

  // Root directory record is embedded in the PVD at offset 156.
  let lba = iso.readUInt32LE(pvdOffset + 156 + 2);
  let size = iso.readUInt32LE(pvdOffset + 156 + 10);

  for (let s = 0; s < segments.length; s++) {
    const isLast = s === segments.length - 1;
    const entry = findEntryInDir(iso, lba, size, segments[s], !isLast);
    if (!entry) return null;

    if (isLast) {
      const start = entry.lba * ISO_SECTOR;
      const fileEnd = start + entry.size;
      if (
        fileEnd > iso.length ||
        entry.size <= 0 ||
        entry.size > MAX_SFO_BYTES
      ) {
        return null;
      }
      return iso.subarray(start, fileEnd);
    }
    lba = entry.lba;
    size = entry.size;
  }
  return null;
};

const readParamSfoFromPbp = async (romPath: string): Promise<Buffer | null> => {
  const fh = await fs.open(romPath, "r");
  try {
    const header = Buffer.alloc(44);
    const { bytesRead } = await fh.read(header, 0, 44, 0);
    if (bytesRead < 44) return null;
    // magic: 0x00 'P' 'B' 'P'
    if (
      header[0] !== 0x00 ||
      header[1] !== 0x50 ||
      header[2] !== 0x42 ||
      header[3] !== 0x50
    ) {
      return null;
    }
    const sfoStart = header.readUInt32LE(8);
    const sfoEnd = header.readUInt32LE(12);
    const len = sfoEnd - sfoStart;
    if (len <= 0 || len > MAX_SFO_BYTES) return null;

    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, sfoStart);
    return buf;
  } finally {
    await fh.close();
  }
};

const readIsoLeading = async (romPath: string): Promise<Buffer | null> => {
  const fh = await fs.open(romPath, "r");
  try {
    const stat = await fh.stat();
    const len = Math.min(stat.size, ISO_READ_LIMIT);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, 0);
    return buf;
  } finally {
    await fh.close();
  }
};

const readCsoLeading = async (romPath: string): Promise<Buffer | null> => {
  const scan = await readCsoLeadingData(romPath);
  if (!scan || scan.chunks.length === 0) return null;
  return Buffer.concat(scan.chunks);
};

/**
 * Reads the official TITLE / DISC_ID from a PSP image's PARAM.SFO. Returns null
 * for unsupported/unreadable files so the caller can fall back to the file name.
 */
export const readPspDiscInfo = async (
  romPath: string
): Promise<PspDiscInfo | null> => {
  try {
    const ext = path.extname(romPath).toLowerCase();
    let sfoBuf: Buffer | null = null;

    if (ext === ".pbp") {
      sfoBuf = await readParamSfoFromPbp(romPath);
    } else if (ext === ".iso") {
      const iso = await readIsoLeading(romPath);
      sfoBuf = iso && findFileInIso(iso, ["PSP_GAME", "PARAM.SFO"]);
    } else if (ext === ".cso") {
      const iso = await readCsoLeading(romPath);
      sfoBuf = iso && findFileInIso(iso, ["PSP_GAME", "PARAM.SFO"]);
    }

    if (!sfoBuf) return null;

    const sfo = parseParamSfo(sfoBuf);
    if (!sfo) return null;
    return {
      title: sfo.title ? cleanPspTitle(sfo.title) : undefined,
      discId: sfo.discId,
    };
  } catch (error) {
    logger.warn("[psp] failed to read PARAM.SFO", { romPath, error });
    return null;
  }
};
