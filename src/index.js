/**
 * @fileoverview Core RPX library.
 *
 * This module exposes the building blocks that power the RPX CLI while remaining framework agnostic.
 * Import the named exports to embed Ren'Py archive tooling in any JavaScript or TypeScript project.
 *
 * Supported capabilities:
 *  - Read metadata from legacy and modern `.rpa` archives (1.0 – 4.0).
 *  - Extract files and optionally decompile `.rpyc` scripts via unrpyc-js.
 *  - Detect the originating Ren'Py/Python runtime heuristically.
 *  - Create new archives (XOR obfuscation, Ren'Py markers, legacy `.rpi` indices).
 *
 * Extensive documentation is available in the `docs/` directory and the project README.
 */
import fs from 'fs';
/**
 * @typedef {Object} RuntimeClassification
 * @property {string} format Raw RPC format identifier detected from the archive.
 * @property {number} pythonMajor Detected Python major version (2/3) or 0 if unknown.
 * @property {number|string} renpyMajor Detected Ren'Py major or descriptor string.
 * @property {number} pickleProtocol Pickle protocol number used by the index (if available).
 * @property {?number} scriptVersion Raw `script_version` field from the archive metadata.
 * @property {boolean} hasInitOffset Whether init offset statements were observed.
 * @property {?string} confidence Qualitative confidence level of the detection.
 * @property {?string} build Optional build identifier extracted from the archive (if any).
 * @property {string[]} notes Human readable notes describing the heuristics applied.
 * @property {string} label Friendly label summarising the runtime.
 */

/**
 * @typedef {Object} CreateArchiveOptions
 * @property {string} input Source directory or file to pack.
 * @property {string} output Destination archive path.
 * @property {string} [version="3.0"] RPA version header to emit (e.g. `1.0`, `3.0`, `4.0`).
 * @property {(string|number)} [key] Custom XOR key for RPA-3.x/4.x archives.
 * @property {number} [pickleProtocol] Pickle protocol override (defaults per version).
 * @property {boolean} [marker] Force enabling/disabling the Ren'Py marker padding.
 * @property {boolean} [includeHidden=false] Whether dotfiles should be included when packing directories.
 * @property {boolean} [debug=false] Enable verbose debug logging.
 * @property {boolean} [force=false] Overwrite existing output files.
 */

/**
 * @typedef {Object} CreateArchiveResult
 * @property {string} version Header string written to the archive.
 * @property {string} output Resolved output path.
 * @property {number} files Number of files written.
 * @property {number} dataBytes Total size of user payload bytes.
 * @property {?number} key XOR key used (where applicable).
 * @property {?number} indexOffset Byte offset of the embedded index (null for RPA-1.0).
 * @property {?string} indexFile Companion `.rpi` path for RPA-1.0 archives, when produced.
 */

import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { PyRunner } from '@dynamicaaa/pyrunner';
import { RPYCDecompiler } from './decompiler.js';

// Load RPickleX with robust UMD/ESM interop
let __rpx_mod = await import('./rpicklex.js');
const RPickleX = __rpx_mod?.default || __rpx_mod?.RPickleX || globalThis.RPickleX;
if (!RPickleX) {
  throw new Error('RPickleX module failed to load');
}

const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);

/**
 * RPX - RenPy RPA Extractor Library
 * 
 * A comprehensive library for extracting RenPy RPA archives with support for
 * multiple versions and compression methods.
 */

/**
 * High level reader for Ren'Py `.rpa` archives.
 *
 * ```js
 * import { RPX } from '@dynamicaaa/rpx';
 * const archive = new RPX('game.rpa');
 * await archive.readHeader();
 * console.log(archive.header);
 * ```
 */
class RPX {
  /**
   * Create an RPX instance
   * @param {string} filePath - Path to the RPA file
   * @param {Object} options - Extraction options
   * @param {boolean} options.decompileRPYC - Whether to decompile RPYC files (default: true)
   * @param {boolean} options.overwriteRPY - Whether to overwrite existing RPY files (default: false)
   * @param {boolean} options.tryHarder - Whether to use try-harder mode for decompilation (default: false)
   * @param {boolean} options.debug - Whether to enable debug logging (default: false)
   */
  /**
   * @param {string} filePath Absolute or relative path to the `.rpa` archive.
   * @param {Object} [options]
   * @param {boolean} [options.decompileRPYC=true] Automatically decompile `.rpyc` files after extracting.
   * @param {boolean} [options.overwriteRPY=false] Overwrite existing `.rpy` targets during decompilation.
   * @param {boolean} [options.tryHarder=false] Enable unrpyc "try harder" mode.
   * @param {boolean} [options.keepRpycFiles=false] Preserve `.rpyc` files when decompiling.
   * @param {boolean} [options.debug=false] Emit verbose debug logging.
   */
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.header = null;
    this.index = null;
    this.version = null;
    this.decompileRPYC = options.decompileRPYC !== false; // Default true
    this.overwriteRPY = options.overwriteRPY || false;
    this.tryHarder = options.tryHarder || false;
    this.keepRpycFiles = options.keepRpycFiles || false; // Default false
    this.debug = options.debug || false;
    this.decompiler = null;
  }

  /**
   * Read the RPA file header and determine version
   * @returns {Promise<Object>} Parsed header information
   */
  /**
   * Lazily read and parse the archive header.
   *
   * @returns {Promise<Object>} Parsed header metadata including version, offset and XOR key information.
   * @throws {Error} When the archive header is malformed or unsupported.
   */
  async readHeader() {
    if (this.header) return this.header;

    const fileBuffer = await fs.promises.readFile(this.filePath);
    
    // Read first 50 bytes to get header information
    const headerBytes = fileBuffer.subarray(0, 50);
    const headerString = headerBytes.toString('utf8');
    
    // Find the end of header (newline character)
    const headerEnd = headerString.indexOf('\n');
    const actualHeaderString = headerEnd === -1 ? headerString : headerString.substring(0, headerEnd);

    const tokens = actualHeaderString.trim().split(/\s+/);
    const signature = tokens[0];

    if (!signature || !signature.startsWith('RPA-')) {
      this.version = 'RPA-1.0';
      this.header = {
        version: this.version,
        data: 'RPA-1.0',
        offset: 0,
        key: 0,
      };
      return this.header;
    }

    this.version = signature;
    this.header = {
      version: this.version,
      data: actualHeaderString
    };

    if (signature === 'RPA-1' || signature === 'RPA-1.0') {
      this.header.offset = 0;
      this.header.key = 0;
    } else if (signature === 'RPA-2' || signature === 'RPA-2.0') {
      const offsetHex = tokens[1];
      if (!offsetHex) {
        throw new Error('Missing index offset in RPA-2.0 header');
      }
      this.header.offset = parseInt(offsetHex, 16);
      this.header.key = 0;
    } else if (signature === 'RPA-3' || signature === 'RPA-3.0' || signature === 'RPA-3.2') {
      const offsetHex = tokens[1];
      const keyHex = tokens[2];
      if (!offsetHex || !keyHex) {
        throw new Error('Malformed RPA-3.x header');
      }
      this.header.offset = parseInt(offsetHex, 16);
      this.header.key = parseInt(keyHex, 16);
    } else if (signature === 'RPA-4' || signature === 'RPA-4.0') {
      const offsetHex = tokens[1];
      const keyHex = tokens[2];
      if (!offsetHex || !keyHex) {
        throw new Error('Malformed RPA-4.0 header');
      }
      this.header.offset = parseInt(offsetHex, 16);
      this.header.key = parseInt(keyHex, 16);
    } else {
      throw new Error(`Unsupported RPA version: ${signature}`);
    }

    return this.header;
  }

  /**
   * Parse the index section of the RPA file
   * @returns {Promise<Object>} Parsed index data
   */
  /**
   * Read and decode the archive index for the current archive.
   *
   * Handles both embedded indexes (RPA-2.0+) and legacy `.rpi` files (RPA-1.0).
   *
   * @returns {Promise<Object>} A mapping of archive paths to `{ offset, size }` entries.
   * @throws {Error} When the index cannot be located or decoded.
   */
  async parseIndex() {
    if (this.index) return this.index;

    await this.readHeader();

    if (this.version === 'RPA-1' || this.version === 'RPA-1.0') {
      const indexPath = await this.resolveLegacyIndexPath();
      const indexBytes = await fs.promises.readFile(indexPath);
      let decompressedIndex;
      try {
        decompressedIndex = await inflate(indexBytes);
      } catch (inflateError) {
        try {
          decompressedIndex = await inflateRaw(indexBytes);
        } catch (inflateRawError) {
          throw new Error(`Failed to decompress legacy index: inflate error: ${inflateError.message}, inflateRaw error: ${inflateRawError.message}`);
        }
      }

      const picklex = new RPickleX();
      const rawIndex = picklex.loads(decompressedIndex);
      this.index = this.processRawIndex(rawIndex);
      return this.index;
    }

    const fileBuffer = await fs.promises.readFile(this.filePath);
    const indexOffset = this.header.offset;

    if (indexOffset >= fileBuffer.length) {
      throw new Error(`Index offset ${indexOffset} is beyond file end ${fileBuffer.length}`);
    }

    // Extract index data
    const indexBuffer = fileBuffer.subarray(indexOffset);
    
    try {
      let decompressedIndex;
      try {
        // Try regular inflate first (with headers)
        decompressedIndex = await inflate(indexBuffer);
      } catch (inflateError) {
        // If that fails, try inflateRaw (without headers)
        try {
          decompressedIndex = await inflateRaw(indexBuffer);
        } catch (inflateRawError) {
          throw new Error(`Failed to decompress index: inflate error: ${inflateError.message}, inflateRaw error: ${inflateRawError.message}`);
        }
      }
      
      // Parse pickle data using rpicklex
      const picklex = new RPickleX();
      const rawIndex = picklex.loads(decompressedIndex);
      
      // Decode XOR'd entries for RPA-3.0+ and RPA-4.0
      if (this.header.key && this.header.key !== 0) {
        this.index = this.decodeXORIndex(rawIndex, this.header.key);
      } else {
        this.index = this.processRawIndex(rawIndex);
      }
      
      return this.index;
    } catch (error) {
      throw new Error(`Failed to parse index: ${error.message}`);
    }
  }

  /**
   * Resolve the companion `.rpi` file associated with an RPA-1.0 archive.
   *
   * @returns {Promise<string>} Absolute path to the `.rpi` file.
   */
  async resolveLegacyIndexPath() {
    const dir = path.dirname(this.filePath);
    const baseName = path.basename(this.filePath);
    const candidates = [];
    if (baseName.toLowerCase().endsWith('.rpa')) {
      candidates.push(path.join(dir, baseName.slice(0, -4) + '.rpi'));
    }
    candidates.push(`${this.filePath}.rpi`);

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        return candidate;
      }
    }

    throw new Error(`Legacy RPA index (.rpi) not found for ${this.filePath}`);
  }


  /**
   * Get the length of the header
   * @returns {number} Header length in bytes
   */
  getHeaderLength() {
    if (!this.header) return 0;
    return Buffer.byteLength(this.header.data, 'utf8') + 1; // +1 for newline
  }

  /**
   * Decode XOR-encrypted index entries (RPA-3.0+)
   * @param {Object} rawIndex - Raw pickle index data
   * @param {number} key - XOR key from header
   * @returns {Object} Decoded file index
   */
  decodeXORIndex(rawIndex, key) {
    const decodedIndex = {};
    
    for (const [filePath, entries] of Object.entries(rawIndex)) {
      if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error(`Invalid index entry for ${filePath}`);
      }
      
      // Each entry is [offset, size, prefix]
      const [offset, size] = entries[0];
      
      decodedIndex[filePath] = {
        offset: offset ^ key,  // XOR decode offset
        size: size ^ key,      // XOR decode size
      };
    }
    
    return decodedIndex;
  }

  /**
   * Process raw index for older RPA versions
   * @param {Object} rawIndex - Raw pickle index data
   * @returns {Object} Processed file index
   */
  processRawIndex(rawIndex) {
    const processedIndex = {};
    
    for (const [filePath, entries] of Object.entries(rawIndex)) {
      if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error(`Invalid index entry for ${filePath}`);
      }
      
      const [offset, size] = entries[0];
      
      processedIndex[filePath] = {
        offset: offset,
        size: size,
      };
    }
    
    return processedIndex;
  }

  /**
   * Extract a file from the RPA archive
   * @param {string} fileName - Name of the file to extract
   * @param {string} outputPath - Path to extract the file to
   * @returns {Promise<{extracted: boolean, decompiled?: boolean}>}
   */
  /**
   * Extract a single file from the archive to disk.
   *
   * @param {string} fileName Archive-internal path (using forward slashes).
   * @param {string} outputPath Destination path where the file should be written.
   * @returns {Promise<{ extracted: boolean, decompiled?: boolean }>} Extraction metadata.
   */
  async extractFile(fileName, outputPath) {
    if (!this.index) {
      await this.parseIndex();
    }

    const fileEntry = this.index[fileName];
    if (!fileEntry) {
      throw new Error(`File not found in archive: ${fileName}`);
    }

    const { offset, size } = fileEntry;
    const fileBuffer = await fs.promises.readFile(this.filePath);

    // Extract file data
    const fileData = fileBuffer.subarray(offset, offset + size);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Write extracted file
    await fs.promises.writeFile(outputPath, fileData);

    const result = { extracted: true };

    // Decompile if it's an RPYC file and decompilation is enabled
    if (this.decompileRPYC && (fileName.endsWith('.rpyc') || fileName.endsWith('.rpymc'))) {
      if (!this.decompiler) {
        this.decompiler = new RPYCDecompiler({
          autoDecompile: true,
          overwrite: this.overwriteRPY,
          tryHarder: this.tryHarder,
          keepRpycFiles: this.keepRpycFiles,
          debug: this.debug
        });
        await this.decompiler.init();
      }

      const decompileResult = await this.decompiler.decompileFile(outputPath);
      result.decompiled = decompileResult.success;
    }

    return result;
  }

  /**
   * Extract all files from the RPA archive
   * @param {string} outputDir - Directory to extract files to
   * @param {object} options - Extraction options
   * @param {function} options.onProgress - Progress callback function
   * @returns {Promise<{extracted: number, decompiled?: number, failed?: number}>}
   */
  /**
   * Extract all files contained in the archive to the given directory.
   *
   * @param {string} outputDir Directory that will receive the extracted files.
   * @param {Object} [options]
   * @param {Function} [options.onProgress] Optional callback invoked with progress events.
   * @returns {Promise<{ extracted: number, decompiled?: number, failed?: number }>} Summary statistics.
   */
  async extractAll(outputDir, options = {}) {
    if (!this.index) {
      await this.parseIndex();
    }

    // Ensure output directory exists
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Extract all files
    const files = Object.keys(this.index);
    const extractedFiles = [];
    const onProgress = options.onProgress;

    if (onProgress) {
      onProgress({ stage: 'extract', current: 0, total: files.length, message: 'Starting extraction...' });
    }

    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      const outputPath = path.join(outputDir, fileName);
      await this.extractFile(fileName, outputPath);
      extractedFiles.push(outputPath);

      if (onProgress) {
        onProgress({
          stage: 'extract',
          current: i + 1,
          total: files.length,
          message: `Extracted ${fileName}`
        });
      }
    }

    const result = { extracted: files.length };

    // Decompile RPYC files if enabled
    if (this.decompileRPYC) {
      if (!this.decompiler) {
        this.decompiler = new RPYCDecompiler({
          autoDecompile: true,
          overwrite: this.overwriteRPY,
          tryHarder: this.tryHarder,
          keepRpycFiles: this.keepRpycFiles,
          debug: this.debug
        });
        await this.decompiler.init();
      }

      const rpycFiles = await this.decompiler._findRpycFiles(outputDir);
      // Runtime detection (best-effort) for summary and initial note
      let runtimeInfo = null;
      try {
        if (rpycFiles.length > 0 && this.decompiler.unrpyc?.detectRpycRuntime) {
          const info = await this.decompiler.unrpyc.detectRpycRuntime(rpycFiles[0]);
          if (info) runtimeInfo = info;
        }
      } catch (e) { /* ignore detection errors */ }

      // Node-side fallback to avoid UNKNOWN in summary
      if (
        rpycFiles.length > 0 &&
        (!runtimeInfo || !runtimeInfo.renpyMajor || runtimeInfo.renpyMajor === 'unknown' || !runtimeInfo.pythonMajor || runtimeInfo.format === 'UNKNOWN')
      ) {
        const fallbackInfo = await detectRuntimeByBytes(rpycFiles[0]);
        if (fallbackInfo) runtimeInfo = fallbackInfo;
      }

      const classifiedRuntime = runtimeInfo ? classifyRuntime(runtimeInfo) : null;

      if (onProgress) {
        const detectNote = classifiedRuntime ? ` (Detected ${classifiedRuntime.label})` : '';
        onProgress({
          stage: 'decompile',
          current: 0,
          total: rpycFiles.length,
          message: `Starting decompilation of ${rpycFiles.length} RPYC files...${detectNote}`
        });
      }

      const decompileResult = await this.decompiler.processExtractedFiles(outputDir, { onProgress });
      result.decompiled = decompileResult.decompiled;
      result.failed = decompileResult.failed;
      result.replaced = decompileResult.replaced;
      if (classifiedRuntime) {
        result.runtime = classifiedRuntime;
      }

      if (onProgress && decompileResult.decompiled > 0) {
        onProgress({
          stage: 'complete',
          current: decompileResult.decompiled,
          total: decompileResult.decompiled,
          message: `Completed decompilation of ${decompileResult.decompiled} files`
        });
      }
    }

    return result;
  }

  /**
   * List all files in the RPA archive
   * @returns {Promise<Array<string>>} List of file names
   */
  /**
   * List every archive path contained within the RPA file.
   *
   * @returns {Promise<string[]>} Array of archive-relative file paths.
   */
  async listFiles() {
    if (!this.index) {
      await this.parseIndex();
    }

    return Object.keys(this.index);
  }
}

/**
 * Extract an RPA file
 * @param {string} filePath - Path to the RPA file
 * @param {string} outputDir - Directory to extract files to
 * @param {Object} options - Extraction options
 * @returns {Promise<{extracted: number, decompiled?: number, failed?: number}>}
 */
/**
 * Convenience helper that extracts an RPA archive without manually instantiating {RPX}.
 *
 * @param {string} filePath Path to the archive.
 * @param {string} outputDir Directory that will receive extracted files.
 * @param {Object} [options] Additional extraction options forwarded to the {RPX} constructor.
 * @returns {Promise<{ extracted: number, decompiled?: number, failed?: number }>} Summary statistics.
 */
async function extract(filePath, outputDir, options = {}) {
  const rpx = new RPX(filePath, options);
  return await rpx.extractAll(outputDir);
}

/**
 * List files in an RPA archive
 * @param {string} filePath - Path to the RPA file
 * @param {Object} options - Options (for consistency)
 * @returns {Promise<Array<string>>} List of file names
 */
/**
 * Convenience helper that lists all files in an archive without instantiating {RPX}.
 *
 * @param {string} filePath Path to the archive.
 * @param {Object} [options] Additional options forwarded to the {RPX} constructor.
 * @returns {Promise<string[]>} Array of archive paths.
 */
async function list(filePath, options = {}) {
  const rpx = new RPX(filePath, { decompileRPYC: false, ...options });
  return await rpx.listFiles();
}

// Best-effort runtime detection by reading file bytes
/**
 * Convert raw runtime detection metadata into a user friendly classification.
 *
 * @param {?RuntimeClassification} info Raw heuristics.
 * @returns {RuntimeClassification} Fully classified runtime descriptor.
 */
function classifyRuntime(info) {
  const runtime = {
    format: info?.format || 'UNKNOWN',
    pythonMajor: typeof info?.pythonMajor === 'number' ? info.pythonMajor : 0,
    renpyMajor: info?.renpyMajor ?? 'unknown',
    pickleProtocol: typeof info?.pickleProtocol === 'number' ? info.pickleProtocol : -1,
    scriptVersion: info?.scriptVersion ?? null,
    hasInitOffset: Boolean(info?.hasInitOffset),
    chunks: info?.chunks ?? null,
    confidence: info?.confidence || 'low',
    build: info?.build ?? null,
    notes: [],
  };

  const { format, pythonMajor, scriptVersion, hasInitOffset, pickleProtocol } = runtime;

 if (format === 'RPC1') {
    runtime.renpyMajor = 6;
    runtime.label = "Ren'Py <= 6.17 (legacy RPC1)";
    runtime.notes.push('RPC1 header (pre-6.18 format)');
  } else if (format === 'RPC2' && pythonMajor >= 3) {
    runtime.renpyMajor = 8;
    runtime.label = "Ren'Py 8.x (Python 3)";
    runtime.notes.push('RPC2 header');
    if (pickleProtocol >= 0) runtime.notes.push(`Pickle protocol v${pickleProtocol} (Python 3)`);
  } else if (format === 'RPC2') {
    runtime.renpyMajor = 6;
    runtime.label = "Ren'Py 6.x (Python 2)";
    runtime.notes.push('RPC2 header');
    if (typeof scriptVersion === 'number') {
      runtime.notes.push(`script_version=${scriptVersion}`);
      if (scriptVersion >= 7000000) {
        runtime.renpyMajor = 7;
        runtime.label = "Ren'Py 7.x (Python 2)";
      } else if (scriptVersion >= 6000000) {
        runtime.renpyMajor = '6.99';
        runtime.label = "Ren'Py 6.99.x (Python 2)";
      } else if (scriptVersion >= 5000000) {
        runtime.label = "Ren'Py 6.18–6.98 (Python 2)";
      }
    }
    if (pickleProtocol >= 0) runtime.notes.push(`Pickle protocol v${pickleProtocol} (Python 2)`);
    if (hasInitOffset) runtime.notes.push('init offset statements detected');
  } else {
    runtime.label = 'Unknown runtime';
    runtime.notes.push('Unrecognized RPYC format');
  }

  if (runtime.build) runtime.notes.push(`build=${runtime.build}`);

  return runtime;
}

/**
 * Attempt lightweight runtime detection purely by inspecting archive bytes.
 *
 * @param {string} filePath Path to the archive.
 * @returns {?RuntimeClassification} Runtime metadata or `null` when detection fails.
 */
async function detectRuntimeByBytes(filePath) {
  try {
    const raw = await fs.promises.readFile(filePath);
    const ascii = raw.subarray(0, 12).toString('ascii');
    if (ascii.startsWith('RENPY RPC2')) {
      let pos = 10;
      let slot1 = null;
      while (pos + 12 <= raw.length) {
        const slot = raw.readUInt32LE(pos);
        const start = raw.readUInt32LE(pos + 4);
        const length = raw.readUInt32LE(pos + 8);
        pos += 12;
        if (slot === 0) break;
        if (slot === 1) slot1 = { start, length };
      }
      if (slot1 && slot1.start + slot1.length <= raw.length) {
        const chunk = raw.subarray(slot1.start, slot1.start + slot1.length);
        try {
          const data = await inflate(chunk);
          let protocol = -1;
          if (data.length >= 2 && data[0] === 0x80) {
            protocol = data[1];
          }
          const pythonMajor = protocol >= 3 ? 3 : 2;
          const renpyMajor = pythonMajor >= 3 ? 8 : 7;
          return {
            format: 'RPC2',
            pythonMajor,
            renpyMajor,
            pickleProtocol: protocol,
            confidence: 'medium',
            scriptVersion: null,
            hasInitOffset: false,
          };
        } catch {
          return {
            format: 'RPC2',
            pythonMajor: 2,
            renpyMajor: 7,
            pickleProtocol: -1,
            confidence: 'low',
            scriptVersion: null,
            hasInitOffset: false,
          };
        }
      }
      return {
        format: 'RPC2',
        pythonMajor: 2,
        renpyMajor: 7,
        pickleProtocol: -1,
        confidence: 'low',
        scriptVersion: null,
        hasInitOffset: false,
      };
    }

    try {
      await inflate(raw);
      return {
        format: 'RPC1',
        pythonMajor: 2,
        renpyMajor: 6,
        pickleProtocol: 2,
        confidence: 'medium',
        scriptVersion: null,
        hasInitOffset: false,
      };
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

const MARKER_BUFFER = Buffer.from("Made with Ren'Py.");

/**
 * Utility helper to determine whether a file exists.
 *
 * @param {string} targetPath Path to test.
 * @returns {Promise<boolean>} `true` when the path exists.
 */
async function pathExists(targetPath) {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalise a version argument provided via CLI or API calls.
 *
 * @param {string|number} version Raw version identifier.
 * @returns {{ header: string, family: string, separateIndex: boolean, usesXor: boolean, defaultKey: number, defaultProtocol: number, defaultMarker: boolean, allowMarker: boolean }} Normalised metadata.
 */
function normalizeRpaVersion(version) {
  const raw = (version ?? '3.0').toString().trim().toUpperCase();
  const mappings = {
    '1': 'RPA-1.0',
    '1.0': 'RPA-1.0',
    'RPA-1': 'RPA-1.0',
    'RPA-1.0': 'RPA-1.0',
    '2': 'RPA-2.0',
    '2.0': 'RPA-2.0',
    'RPA-2': 'RPA-2.0',
    'RPA-2.0': 'RPA-2.0',
    '3': 'RPA-3.0',
    '3.0': 'RPA-3.0',
    'RPA-3': 'RPA-3.0',
    'RPA-3.0': 'RPA-3.0',
    '3.2': 'RPA-3.2',
    'RPA-3.2': 'RPA-3.2',
    '4': 'RPA-4.0',
    '4.0': 'RPA-4.0',
    'RPA-4': 'RPA-4.0',
    'RPA-4.0': 'RPA-4.0',
  };

  const header = mappings[raw];
  if (!header) {
    throw new Error(`Unsupported RPA version "${version}"`);
  }

  if (header === 'RPA-1.0') {
    return {
      header,
      family: '1.0',
      separateIndex: true,
      usesXor: false,
      defaultKey: 0,
      defaultProtocol: 2,
      defaultMarker: false,
      allowMarker: false,
    };
  }

  if (header === 'RPA-2.0') {
    return {
      header,
      family: '2.0',
      separateIndex: false,
      usesXor: false,
      defaultKey: 0,
      defaultProtocol: 2,
      defaultMarker: false,
      allowMarker: false,
    };
  }

  if (header === 'RPA-3.0' || header === 'RPA-3.2') {
    return {
      header,
      family: '3.0',
      separateIndex: false,
      usesXor: true,
      defaultKey: 0x42424242,
      defaultProtocol: 2,
      defaultMarker: true,
      allowMarker: true,
    };
  }

  return {
    header,
    family: '4.0',
    separateIndex: false,
    usesXor: true,
    defaultKey: 0x42,
    defaultProtocol: 4,
    defaultMarker: true,
    allowMarker: true,
  };
}
/**
 * Parse a user provided XOR key string/number.
 *
 * @param {string|number} value Raw key (hex string or decimal).
 * @param {number} fallback Default key when no value is supplied.
 * @param {boolean} enabled Whether XOR obfuscation applies to the target format.
 * @returns {number} Parsed key represented as an unsigned 32-bit integer.
 */
function parseXorKey(value, fallback, enabled) {
  if (!enabled) {
    return 0;
  }

  if (value === undefined || value === null || value === '') {
    return fallback >>> 0;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >>> 0;
  }

  const text = value.toString().trim();
  const normalized = text.toLowerCase().startsWith('0x') ? text : `0x${text}`;
  const parsed = Number.parseInt(normalized, 16);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid XOR key value "${value}"`);
  }
  return parsed >>> 0;
}
/**
 * Recursively collect files from a directory prior to packing them into an archive.
 *
 * @param {string} inputPath Absolute or relative file/directory path.
 * @param {{ includeHidden?: boolean }} [options] Additional collection options.
 * @returns {Promise<Array<{ absolute: string, relative: string, size: number }>>} List of files ready for packing.
 */
async function collectInputEntries(inputPath, { includeHidden = false } = {}) {
  if (!inputPath) {
    throw new Error('Input path is required');
  }

  const absoluteRoot = path.resolve(inputPath);
  const stat = await fs.promises.stat(absoluteRoot);
  const base = stat.isDirectory() ? absoluteRoot : path.dirname(absoluteRoot);
  const entries = [];

  if (stat.isDirectory()) {
    await (async function walk(dir) {
      const dirEntries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of dirEntries) {
        if (!includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(abs);
        } else if (entry.isFile()) {
          const fileStat = await fs.promises.stat(abs);
          const rel = path.relative(base, abs).split(path.sep).join('/');
          entries.push({ absolute: abs, relative: rel, size: fileStat.size });
        }
      }
    })(absoluteRoot);
  } else if (stat.isFile()) {
    const rel = path.relative(base, absoluteRoot).split(path.sep).join('/');
    entries.push({ absolute: absoluteRoot, relative: rel, size: stat.size });
  } else {
    throw new Error('Input path must be a file or directory');
  }

  entries.sort((a, b) => a.relative.localeCompare(b.relative));
  return entries;
}

let pickleRunnerInstance = null;
let pickleRunnerInitPromise = null;

async function getPickleRunner(debug = false) {
  if (!pickleRunnerInstance) {
    pickleRunnerInstance = new PyRunner({ debug: Boolean(debug) });
    pickleRunnerInitPromise = pickleRunnerInstance.init();
  }

  if (pickleRunnerInitPromise) {
    await pickleRunnerInitPromise;
    pickleRunnerInitPromise = null;
  }

  return pickleRunnerInstance;
}

/**
 * Serialise the archive index using Python's `pickle` implementation via PyRunner.
 *
 * @param {Object<string, Array<{ offset: number, length: number, prefix: ?Buffer }>>} indexMap Structured index data.
 * @param {{ protocol?: number, debug?: boolean }} [options] Serialization options.
 * @returns {Promise<Buffer>} Pickle payload ready for compression.
 */
async function pickleIndexData(indexMap, { protocol = 2, debug = false } = {}) {
  const runner = await getPickleRunner(debug);
  const payload = {
    protocol,
    entries: Object.entries(indexMap).map(([filePath, segments]) => ({
      path: filePath,
      segments: segments.map((segment) => ({
        offset: Number(segment.offset),
        length: Number(segment.length),
        prefix: segment.prefix ? segment.prefix.toString('base64') : null,
      })),
    })),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const script = `import json, base64, pickle\npayload = json.loads(base64.b64decode('${payloadBase64}').decode('utf-8'))\nindex = {}\nfor item in payload['entries']:\n    segs = []\n    for seg in item['segments']:\n        offset = int(seg['offset'])\n        length = int(seg['length'])\n        prefix_b64 = seg.get('prefix')\n        if prefix_b64:\n            prefix = base64.b64decode(prefix_b64)\n            segs.append((offset, length, prefix))\n        else:\n            segs.append((offset, length))\n    index[item['path']] = segs\nresult = pickle.dumps(index, protocol=payload['protocol'])\nprint(base64.b64encode(result).decode('ascii'))`;

  const execution = await runner.runCode(script);
  const stdout = (execution.stdout || '').trim();
  if (!stdout) {
    throw new Error('Python pickle serialization returned no data');
  }

  return Buffer.from(stdout, 'base64');
}

/**
 * Create a Ren'Py archive.
 *
 * @param {CreateArchiveOptions} options Archive creation options.
 * @returns {Promise<CreateArchiveResult>} Summary details describing the resulting archive.
 * @example
 * await createArchive({ input: 'dist/game', output: 'dist/game.rpa', version: '4.0' });
 */
async function createArchive({
  input,
  output,
  version = '3.0',
  key,
  pickleProtocol,
  marker,
  includeHidden = false,
  debug = false,
  force = false,
} = {}) {
  if (!input) {
    throw new Error('Input path is required');
  }
  if (!output) {
    throw new Error('Output file path is required');
  }

  const versionInfo = normalizeRpaVersion(version);
  const files = await collectInputEntries(input, { includeHidden });
  if (files.length === 0) {
    throw new Error('No files were found to include in the archive');
  }

  const resolvedOutput = path.resolve(output);
  if (!force && fs.existsSync(resolvedOutput)) {
    throw new Error(`Output file already exists: ${resolvedOutput}`);
  }
  await fs.promises.mkdir(path.dirname(resolvedOutput), { recursive: true });

  const useMarker = versionInfo.allowMarker
    ? (marker !== undefined ? Boolean(marker) : versionInfo.defaultMarker)
    : false;
  const markerLength = useMarker ? MARKER_BUFFER.length : 0;
  const xorKey = parseXorKey(key, versionInfo.defaultKey, versionInfo.usesXor);
  const protocol = pickleProtocol !== undefined && pickleProtocol !== null
    ? Number(pickleProtocol)
    : versionInfo.defaultProtocol;

  if (Number.isNaN(protocol) || protocol < 0) {
    throw new Error('Invalid pickle protocol specified');
  }

  const indexEntries = {};
  const records = [];
  let cursor = 0;
  let headerPlaceholder = null;

  if (!versionInfo.separateIndex) {
    if (versionInfo.usesXor) {
      headerPlaceholder = `${versionInfo.header} ${'0'.repeat(16)} ${'0'.repeat(8)}\n`;
    } else {
      headerPlaceholder = `${versionInfo.header} ${'0'.repeat(16)}\n`;
    }
    cursor = Buffer.byteLength(headerPlaceholder, 'utf8');
  }

  let totalDataBytes = 0;
  for (const file of files) {
    const markerOffset = useMarker ? cursor : null;
    if (useMarker) {
      cursor += markerLength;
    }

    const dataOffset = cursor;
    cursor += file.size;
    totalDataBytes += file.size;

    records.push({
      absolute: file.absolute,
      relative: file.relative,
      size: file.size,
      dataOffset,
      markerOffset,
    });

    indexEntries[file.relative] = [
      {
        offset: dataOffset,
        length: file.size,
        prefix: null,
      },
    ];
  }

  const indexOffset = versionInfo.separateIndex ? null : cursor;

  const encodedIndex = {};
  for (const [filePath, segments] of Object.entries(indexEntries)) {
    encodedIndex[filePath] = segments.map((segment) => {
      if (versionInfo.usesXor) {
        if (segment.offset > 0xFFFFFFFF || segment.length > 0xFFFFFFFF) {
          throw new Error('Archive is too large for 32-bit XOR obfuscation');
        }
        return {
          offset: (segment.offset ^ xorKey) >>> 0,
          length: (segment.length ^ xorKey) >>> 0,
          prefix: segment.prefix,
        };
      }

      return {
        offset: segment.offset,
        length: segment.length,
        prefix: segment.prefix,
      };
    });
  }

  const pickledIndex = await pickleIndexData(encodedIndex, { protocol, debug });
  const compressedIndex = zlib.deflateSync(pickledIndex);

  if (versionInfo.separateIndex) {
    const dataHandle = await fs.promises.open(resolvedOutput, 'w');
    try {
      for (const record of records) {
        const buffer = await fs.promises.readFile(record.absolute);
        await dataHandle.write(buffer, 0, buffer.length, record.dataOffset);
      }
      await dataHandle.truncate(cursor);
    } finally {
      await dataHandle.close();
    }

    const indexPath = resolvedOutput.toLowerCase().endsWith('.rpa')
      ? `${resolvedOutput.slice(0, -4)}.rpi`
      : `${resolvedOutput}.rpi`;
    if (!force && fs.existsSync(indexPath)) {
      throw new Error(`Index file already exists: ${indexPath}`);
    }
    await fs.promises.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.promises.writeFile(indexPath, compressedIndex);

    return {
      version: versionInfo.header,
      output: resolvedOutput,
      indexFile: indexPath,
      files: records.length,
      dataBytes: totalDataBytes,
      key: null,
      indexOffset: null,
    };
  }

  const dataHandle = await fs.promises.open(resolvedOutput, 'w');
  try {
    if (headerPlaceholder) {
      await dataHandle.write(headerPlaceholder, 0, Buffer.byteLength(headerPlaceholder, 'utf8'), 0);
    }

    for (const record of records) {
      if (record.markerOffset !== null) {
        await dataHandle.write(MARKER_BUFFER, 0, markerLength, record.markerOffset);
      }
      const buffer = await fs.promises.readFile(record.absolute);
      await dataHandle.write(buffer, 0, buffer.length, record.dataOffset);
    }

    await dataHandle.write(compressedIndex, 0, compressedIndex.length, indexOffset);
    await dataHandle.truncate(indexOffset + compressedIndex.length);
  } finally {
    await dataHandle.close();
  }

  if (headerPlaceholder) {
    const offsetHex = indexOffset.toString(16).toUpperCase().padStart(16, '0');
    let headerLine;
    if (versionInfo.usesXor) {
      const keyHex = (xorKey >>> 0).toString(16).toUpperCase().padStart(8, '0');
      headerLine = `${versionInfo.header} ${offsetHex} ${keyHex}\n`;
    } else {
      headerLine = `${versionInfo.header} ${offsetHex}\n`;
    }

    if (Buffer.byteLength(headerLine, 'utf8') !== Buffer.byteLength(headerPlaceholder, 'utf8')) {
      throw new Error('Header placeholder length mismatch while patching archive header');
    }

    const headerHandle = await fs.promises.open(resolvedOutput, 'r+');
    try {
      await headerHandle.write(headerLine, 0, Buffer.byteLength(headerLine, 'utf8'), 0);
    } finally {
      await headerHandle.close();
    }
  }

  return {
    version: versionInfo.header,
    output: resolvedOutput,
    files: records.length,
    dataBytes: totalDataBytes,
    key: versionInfo.usesXor ? (xorKey >>> 0) : null,
    indexOffset,
    indexFile: null,
  };
}

export {
  RPX,
  extract,
  list,
  createArchive,
};

export default RPX;
