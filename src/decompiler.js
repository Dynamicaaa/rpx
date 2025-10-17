import fs from 'fs';
import path from 'path';

/**
 * RPYC Decompiler - Wrapper for unrpyc-js functionality
 * Integrates RPYC decompilation into the RPX extraction workflow
 */
class RPYCDecompiler {
  /**
   * Create an RPYC Decompiler instance
   * @param {Object} options - Decompiler options
   * @param {boolean} options.autoDecompile - Whether to automatically decompile extracted RPYC files (default: true)
   * @param {boolean} options.overwrite - Whether to overwrite existing RPY files (default: false)
   * @param {boolean} options.tryHarder - Whether to use try-harder mode for decompilation (default: false)
   * @param {boolean} options.debug - Whether to enable debug logging (default: false)
   * @param {boolean} options.keepRpycFiles - Whether to keep original RPYC files after decompilation (default: false)
   * @param {string} options.outputDir - Output directory for decompiled files
   */
  constructor(options = {}) {
    this.autoDecompile = options.autoDecompile !== false;
    this.overwrite = options.overwrite || false;
    this.tryHarder = options.tryHarder || false;
    this.debug = options.debug || false;
    this.keepRpycFiles = options.keepRpycFiles || false;
    this.outputDir = options.outputDir || './decompiled';
    this.unrpyc = null;
    this.initialized = false;
  }

  /**
   * Initialize the decompiler by setting up unrpyc-js
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) return;

    try {
      // Use the bundled UnrpycJS wrapper which depends on the npm PyRunner package
      const mod = await import('../unrpyc-js/index.js');
      const UnrpycJS = mod?.default || mod?.UnrpycJS;
      if (!UnrpycJS) throw new Error('UnrpycJS export not found');

      // Initialize the unrpyc-js instance
      this.unrpyc = new UnrpycJS({
        debug: this.debug,
        outputDir: this.outputDir,
        overwrite: this.overwrite,
        tryHarder: this.tryHarder
      });

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize RPYC decompiler: ${error.message}`);
    }
  }

  /**
   * Decompile a single RPYC file
   * @param {string} inputPath - Path to the RPYC file to decompile
   * @returns {Promise<{success: boolean, outputPath?: string, error?: string}>}
   */
  async decompileFile(inputPath) {
    if (!this.autoDecompile) {
      return { success: false, error: 'Auto decompilation is disabled' };
    }

    await this.init();

    try {
      const result = await this.unrpyc.decompileFile(inputPath, {
        overwrite: this.overwrite,
        tryHarder: this.tryHarder,
        // Write the decompiled file next to the original compiled file
        outputDir: path.dirname(inputPath)
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Decompilation failed: ${error.message}`
      };
    }
  }

  /**
   * Process extracted files in a directory and decompile any RPYC files found
   * @param {string} outputDir - Directory containing extracted files
   * @returns {Promise<{decompiled: number, failed: number, replaced?: number}>}
   */
  async processExtractedFiles(outputDir, options = {}) {
    const onProgress = options.onProgress;
    if (!this.autoDecompile) {
      return { decompiled: 0, failed: 0, replaced: 0 };
    }

    await this.init();

    try {
      // Find all RPYC files in the output directory
      const rpycFiles = await this._findRpycFiles(outputDir);

      if (rpycFiles.length === 0) {
        return { decompiled: 0, failed: 0, replaced: 0 };
      }

      let decompiled = 0;
      let failed = 0;
      let replaced = 0;

      // Decompile each RPYC file found
      let processed = 0;
      for (const rpycFile of rpycFiles) {
        const result = await this.decompileFile(rpycFile);

        if (result.success) {
          decompiled++;

          // Replace RPYC file with decompiled RPY file if keepRpycFiles is false
          if (!this.keepRpycFiles) {
            try {
              const rpycPath = rpycFile;
              const rpyPath = rpycFile.replace(/\.rpyc?$/, '.rpy');

              // Ensure final .rpy exists; if not, try to find/rename a temp output
              let rpyExists = false;
              try { await fs.promises.access(rpyPath); rpyExists = true; } catch {}
              if (!rpyExists) {
                const dir = path.dirname(rpycPath);
                const base = path.basename(rpycPath).replace(/\.rpyc?$/, '');
                const candidates = [
                  path.join(dir, `.temp_${base}.rpy`),
                  path.join(dir, `.temp_${base}.rpyc`)
                ];
                for (const cand of candidates) {
                  try {
                    await fs.promises.access(cand);
                    await fs.promises.rename(cand, rpyPath);
                    rpyExists = true;
                    break;
                  } catch {}
                }
              }

              // Remove the original RPYC file if it still exists
              try { await fs.promises.unlink(rpycPath); } catch {}

              if (rpyExists) replaced++;
            } catch (replaceError) {
              if (this.debug) {
                console.warn(`Failed to replace ${rpycFile}: ${replaceError.message}`);
              }
            }
          }
        } else {
          failed++;
          if (this.debug) {
            console.warn(`Failed to decompile ${rpycFile}: ${result.error}`);
          }
        }

        processed++;
        if (onProgress) {
          onProgress({
            stage: 'decompile',
            current: processed,
            total: rpycFiles.length,
            message: `Decompiling ${path.basename(rpycFile)}`
          });
        }
      }

      return { decompiled, failed, replaced };
    } catch (error) {
      if (this.debug) {
        console.error(`Error processing extracted files: ${error.message}`);
      }
      return { decompiled: 0, failed: 1, replaced: 0 };
    }
  }

  /**
   * Find all RPYC files in a directory recursively
   * @private
   * @param {string} searchDir - Directory to search in
   * @returns {Promise<string[]>} Array of RPYC file paths
   */
  async _findRpycFiles(searchDir) {
    const rpycFiles = [];

    const search = async (dir) => {
      try {
        const items = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            await search(fullPath);
          } else if (item.isFile() && (fullPath.endsWith('.rpyc') || fullPath.endsWith('.rpymc'))) {
            rpycFiles.push(fullPath);
          }
        }
      } catch (error) {
        if (this.debug) {
          console.warn(`Failed to read directory ${dir}: ${error.message}`);
        }
      }
    };

    await search(searchDir);
    return rpycFiles;
  }

  /**
   * Decompile all RPYC files in a directory
   * @param {string} inputDir - Directory containing RPYC files
   * @param {string} outputDir - Directory to output decompiled files
   * @returns {Promise<{success: number, failed: number, skipped: number, errors: Array<{file: string, error: string}>}>}
   */
  async decompileDirectory(inputDir, outputDir = null) {
    await this.init();

    const result = await this.unrpyc.decompileDirectory(inputDir, {
      overwrite: this.overwrite,
      tryHarder: this.tryHarder,
      outputDir: outputDir || this.outputDir,
      recursive: true
    });

    return result;
  }

  /**
   * Check if a file is a valid RPYC file
   * @param {string} filePath - Path to the file to check
   * @returns {Promise<boolean>}
   */
  async isValidRpycFile(filePath) {
    await this.init();

    try {
      const result = await this.unrpyc.isValidRpycFile(filePath);
      return result;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get version information about the unrpyc library
   * @returns {Promise<string>}
   */
  async getVersion() {
    await this.init();

    try {
      const result = await this.unrpyc.getVersion();
      return result;
    } catch (error) {
      return 'Unknown version';
    }
  }
}

export { RPYCDecompiler };
export default RPYCDecompiler;
