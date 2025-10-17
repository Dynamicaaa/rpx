import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
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
  async readHeader() {
    if (this.header) return this.header;

    const fileBuffer = await fs.promises.readFile(this.filePath);
    
    // Read first 50 bytes to get header information
    const headerBytes = fileBuffer.subarray(0, 50);
    const headerString = headerBytes.toString('utf8');
    
    // Find the end of header (newline character)
    const headerEnd = headerString.indexOf('\n');
    const actualHeaderString = headerEnd === -1 ? headerString : headerString.substring(0, headerEnd);
    
    // Check magic signature
    const magicHeader = actualHeaderString.substring(0, 7);
    if (!magicHeader.startsWith('RPA-')) {
      throw new Error(`Invalid RPA file: expected RPA magic header, got ${magicHeader}`);
    }
    
    this.version = magicHeader;
    this.header = {
      version: this.version,
      data: actualHeaderString
    };

    // Parse version-specific header information
    if (this.version === 'RPA-1' || this.version === 'RPA-1.0') {
      // RPA-1.0 format: binary after magic header
      this.header.offset = fileBuffer.readUInt32LE(8);
      this.header.key = 0;
    } else if (this.version === 'RPA-2' || this.version === 'RPA-2.0') {
      // RPA-2.0 format: binary after magic header
      this.header.offset = fileBuffer.readUInt32LE(8);
      this.header.key = 0;
    } else if (this.version === 'RPA-3' || this.version === 'RPA-3.0' || this.version === 'RPA-3.2') {
      // RPA-3.0 format: "RPA-3.0 " + 16 hex chars (index offset) + " " + 8 hex chars (key)
      const offset = 8; // Skip "RPA-3.0 "
      
      // Read 16 hex characters for index offset
      const indexOffsetHex = actualHeaderString.substring(offset, offset + 16);
      this.header.offset = parseInt(indexOffsetHex, 16);
      
      // Skip space and read 8 hex characters for key
      const keyHex = actualHeaderString.substring(offset + 17, offset + 25);
      this.header.key = parseInt(keyHex, 16);
    } else if (this.version === 'RPA-4' || this.version === 'RPA-4.0') {
      // RPA-4.0 format: "RPA-4.0 " + 16 hex chars (index offset) + " " + 8 hex chars (key)
      const offset = 8; // Skip "RPA-4.0 "
      
      // Read 16 hex characters for index offset
      const indexOffsetHex = actualHeaderString.substring(offset, offset + 16);
      this.header.offset = parseInt(indexOffsetHex, 16);
      
      // Skip space and read 8 hex characters for key
      const keyHex = actualHeaderString.substring(offset + 17, offset + 25);
      this.header.key = parseInt(keyHex, 16);
    } else {
      throw new Error(`Unsupported RPA version: ${this.version}`);
    }

    return this.header;
  }

  /**
   * Parse the index section of the RPA file
   * @returns {Promise<Object>} Parsed index data
   */
  async parseIndex() {
    if (this.index) return this.index;

    await this.readHeader();
    const fileBuffer = await fs.promises.readFile(this.filePath);

    let indexOffset = 0;
    if (this.version === 'RPA-1' || this.version === 'RPA-1.0') {
      indexOffset = 16; // Fixed offset for RPA-1
    } else if (this.version === 'RPA-2' || this.version === 'RPA-2.0' ||
               this.version === 'RPA-3' || this.version === 'RPA-3.0' || this.version === 'RPA-3.2' ||
               this.version === 'RPA-4' || this.version === 'RPA-4.0') {
      indexOffset = this.header.offset;
    }

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
async function list(filePath, options = {}) {
  const rpx = new RPX(filePath, { decompileRPYC: false, ...options });
  return await rpx.listFiles();
}

export {
  RPX,
  extract,
  list
};

export default RPX;
// Best-effort runtime detection by reading file bytes
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
    runtime.label = "Ren'Py ≤ 6.17 (legacy RPC1)";
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
