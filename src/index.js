const fs = require('fs');
const path = require('path');
const { Parser } = require('pickleparser');

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
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.header = null;
    this.index = null;
    this.version = null;
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
    
    // Decompress the index data
    const zlib = require('zlib');
    const { promisify } = require('util');
    const inflate = promisify(zlib.inflate);
    const inflateRaw = promisify(zlib.inflateRaw);
    
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
      
      // Parse pickle data using pickleparser
      const parser = new Parser();
      const rawIndex = parser.parse(decompressedIndex);
      
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
   * @returns {Promise<void>}
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
  }

  /**
   * Extract all files from the RPA archive
   * @param {string} outputDir - Directory to extract files to
   * @returns {Promise<void>}
   */
  async extractAll(outputDir) {
    if (!this.index) {
      await this.parseIndex();
    }

    // Ensure output directory exists
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Extract all files
    const files = Object.keys(this.index);
    for (const fileName of files) {
      const outputPath = path.join(outputDir, fileName);
      await this.extractFile(fileName, outputPath);
    }
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
 * @returns {Promise<void>}
 */
async function extract(filePath, outputDir) {
  const rpx = new RPX(filePath);
  await rpx.extractAll(outputDir);
}

/**
 * List files in an RPA archive
 * @param {string} filePath - Path to the RPA file
 * @returns {Promise<Array<string>>} List of file names
 */
async function list(filePath) {
  const rpx = new RPX(filePath);
  return await rpx.listFiles();
}

module.exports = {
  RPX,
  extract,
  list
};