#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { RPX, extract, list, createArchive, RPX_VERSION } from '../src/index.js';
import gradient from 'gradient-string';

// Determine package version for banner/help
const pkgVersion = RPX_VERSION ?? '0.0.0';

/**
 * RPX CLI - Modern Command Line Interface for RenPy RPA Extractor
 */
const asciiArt = `
88bd88b?88,.d88b,?88,  88P
  88P'  \`\`?88'  ?88 \`?8bd8P'
 d88       88b  d8P d8P?8b, 
d88'       888888P'd8P' \`?8b
           88P'             
          d88               
          ?8P
`;

const banner = gradient(['#ff00cc', '#3333ff', '#00ffff'])(asciiArt);

// Auto-detect TTY to adjust UI behavior
const isTTY = Boolean(process.stdout?.isTTY && process.stderr?.isTTY) && process.env.TERM !== 'dumb' && !process.env.CI;

// Print banner only in interactive terminals
if (isTTY) {
  console.log(banner + "\n" + chalk.gray(`v${pkgVersion}`) + "\n");
}

const argv = yargs(hideBin(process.argv))
  .scriptName('rpx')
  .usage(`${chalk.bold('Usage:')} rpx <command> [options]`)
  .command('extract', chalk.green('Extract files from an RPA archive'), (yargs) => {
    return yargs
      .option('input', { alias: 'i', describe: chalk.cyan('Path to the RPA file'), demandOption: true, type: 'string' })
      .option('output', { alias: 'o', describe: chalk.cyan('Output directory for extracted files'), demandOption: true, type: 'string' })
      .option('file', { alias: 'f', describe: chalk.cyan('Extract only a specific file within the archive'), type: 'string' })
      .option('decompile', { describe: chalk.cyan('Decompile .rpyc files (use --no-decompile to skip)'), type: 'boolean', default: true })
      .option('progress', { describe: chalk.cyan('Show progress bar (use --no-progress to disable)'), type: 'boolean', default: true })
      .option('overwrite', { describe: chalk.cyan('Overwrite existing .rpy files after decompile'), type: 'boolean', default: false })
      .option('try-harder', { describe: chalk.cyan('Use try-harder mode for decompilation'), type: 'boolean', default: false })
      .option('keep-rpyc', { describe: chalk.cyan('Keep original .rpyc files after decompilation'), type: 'boolean', default: false })
      .option('debug', { describe: chalk.cyan('Enable verbose debug logging'), type: 'boolean', default: false });
  })
  .command(
    'list',
    chalk.green('List files in an RPA archive'),
    (yargs) =>
      yargs
        .option('input', {
          alias: 'i',
          describe: chalk.cyan('Path to the RPA file'),
          demandOption: true,
          type: 'string',
        })
        .option('filter', {
          alias: 'f',
          describe: chalk.cyan('Only include files ending with this (e.g., .rpyc, .png)'),
          type: 'string',
        })
        .option('sort', {
          alias: 's',
          describe: chalk.cyan('Sort by'),
          choices: ['name', 'size', 'ext'],
          default: 'name',
          type: 'string',
        })
        .option('size', {
          alias: 'S',
          describe: chalk.cyan('Show file sizes in listing'),
          type: 'boolean',
          default: false,
        })
  )
  .command(
    'info',
    chalk.green('Show information about an RPA archive'),
    (yargs) =>
      yargs
        .option('input', {
          alias: 'i',
          describe: chalk.cyan('Path to the RPA file'),
          demandOption: true,
          type: 'string',
        })
        .option('verbose', {
          alias: 'v',
          describe: chalk.cyan('Show detailed content breakdown'),
          type: 'boolean',
          default: false,
        })
  )
  .command(
    'create',
    chalk.green('Create an RPA archive'),
    (yargs) =>
      yargs
        .option('input', {
          alias: 'i',
          describe: chalk.cyan('Path to the file or directory to pack'),
          demandOption: true,
          type: 'string',
        })
        .option('output', {
          alias: 'o',
          describe: chalk.cyan('Output RPA file path'),
          demandOption: true,
          type: 'string',
        })
        .option('header', {
          alias: 'v',
          describe: chalk.cyan('RPA version header (e.g., 1.0, 2.0, 3.0, 3.2, 4.0)'),
          type: 'string',
          default: '3.0',
        })
        .option('key', {
          alias: 'k',
          describe: chalk.cyan('XOR key in hex for RPA-3.x/4.x archives'),
          type: 'string',
        })
        .option('protocol', {
          describe: chalk.cyan('Pickle protocol (defaults based on version)'),
          type: 'number',
        })
        .option('marker', {
          describe: chalk.cyan('Include "Made with Ren\'Py." markers (use --no-marker to disable when available)'),
          type: 'boolean',
        })
        .option('include-hidden', {
          describe: chalk.cyan('Include dotfiles when packaging directories'),
          type: 'boolean',
          default: false,
        })
        .option('force', {
          describe: chalk.cyan('Overwrite existing output files'),
          type: 'boolean',
          default: false,
        })
        .option('debug', {
          describe: chalk.cyan('Enable verbose debug logging'),
          type: 'boolean',
          default: false,
        })
  )
  .demandCommand(1, chalk.red('⚠  You need at least one command before moving on'))
  .help()
  .alias('help', 'h')
  .strict()
  .version(pkgVersion)
  .alias('version', 'V')
  .epilogue(chalk.gray('For more information, visit: https://github.com/Dynamicaaa/rpx'))
  .wrap(isTTY ? Math.min(120, process.stdout.columns || 120) : null)
  .argv;

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Handle the extract command with enhanced UI
 * @param {Object} argv - Command line arguments
 */
async function handleExtractCommand(argv) {
  const { input, output, file, debug } = argv;
  const decompileRPYC = argv.decompile !== false;
  const showProgress = argv.progress !== false;

  console.log(chalk.bold.blue('🚀 Starting extraction...\n'));
  // Check if input file exists
  if (!fs.existsSync(input)) {
    console.error(chalk.red('✖ ') + chalk.bold(`Input file not found: ${input}`));
    process.exit(1);
  }

  // Check if output directory exists, create if not
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true });
    console.log(chalk.green('✓ ') + `Created output directory: ${chalk.cyan(output)}`);
  }

  const spinner = ora({
    text: 'Initializing RPX...',
    color: 'cyan',
    spinner: 'dots',
    isEnabled: isTTY
  }).start();

  try {
    const rpx = new RPX(input, {
      decompileRPYC,
      overwriteRPY: argv.overwrite,
      tryHarder: argv.tryHarder,
      keepRpycFiles: argv.keepRpyc,
      debug
    });

    spinner.text = 'Reading archive header...';
    const header = await rpx.readHeader();
    const headerLabel = header.isAlias && header.canonicalVersion
      ? `${header.version} (alias of ${header.canonicalVersion})`
      : header.version;
    spinner.succeed(`Archive version: ${chalk.yellow(headerLabel)}`);

    if (file) {
      // Extract specific file
      spinner.start('Extracting file...');
      const outputPath = path.join(output, file);
      const result = await rpx.extractFile(file, outputPath);
      
      spinner.succeed(`Extracted: ${chalk.cyan(file)}`);
      
      if (result.decompiled) {
        console.log(chalk.green('  ✓ ') + `Decompiled RPYC to RPY`);
      }
      
      console.log(chalk.bold.green('\n✨ Extraction complete!'));
    } else {
      // Extract all files
      spinner.text = 'Parsing archive index...';
      await rpx.parseIndex();
      const files = await rpx.listFiles();
      spinner.succeed(`Found ${chalk.yellow(files.length)} files`);

      let progressBar = null;
      if (showProgress && isTTY) {
        progressBar = new cliProgress.SingleBar({
          format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} | {message}',
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true
        });
      }

      const result = await rpx.extractAll(output, {
        onProgress: (progress) => {
          if (progressBar) {
            if (progress.stage === 'extract' && progress.current === 0) {
              progressBar.start(progress.total, 0, { message: 'Extracting...' });
            } else if (progress.stage === 'extract') {
              progressBar.update(progress.current, { 
                message: `Extracting ${path.basename(progress.message.replace('Extracted ', ''))}` 
              });
            } else if (progress.stage === 'decompile' && progress.current === 0) {
              if (progressBar) {
                progressBar.stop();
                progressBar.start(progress.total, 0, { message: 'Decompiling...' });
              } else if (progress.message) {
                // If no progress bar, print a one-time detection note
                console.log(chalk.gray(progress.message));
              }
            } else if (progress.stage === 'decompile') {
              progressBar.update(progress.current, {
                message: `Decompiling ${path.basename(progress.message.replace('Decompiling ', ''))}`
              });
            } else if (progress.stage === 'complete') {
              progressBar.stop();
            }
          }
        }
      });

      if (progressBar) {
        progressBar.stop();
      }

      console.log(chalk.bold.green('\n✨ Extraction complete!\n'));
      console.log(chalk.gray('═══════════════════════════════════════════════════════════'));
      console.log(chalk.bold('  📦 Summary:'));
      console.log(chalk.gray('  ───────────────────────────────────────────────────────────'));
      console.log(`  ${chalk.cyan('Extracted:')}      ${chalk.yellow(result.extracted)} files`);
      
      if (decompileRPYC) {
        console.log(`  ${chalk.cyan('Decompiled:')}     ${chalk.yellow(result.decompiled || 0)} RPYC files`);
        if (result.failed && result.failed > 0) {
          console.log(`  ${chalk.red('Failed:')}        ${chalk.yellow(result.failed)} files`);
        }
        if (result.replaced && result.replaced > 0) {
          console.log(`  ${chalk.cyan('Replaced:')}      ${chalk.yellow(result.replaced)} RPYC with RPY`);
        }
        if (result.runtime) {
          const runtimeLabel = result.runtime.label
            ? result.runtime.label
            : (result.runtime.renpyMajor === 'unknown' || result.runtime.renpyMajor == null
              ? "Unknown Ren'Py"
              : `Ren'Py ${result.runtime.renpyMajor}`);
          const fmt = result.runtime.format ? ` - ${chalk.gray(result.runtime.format)}` : '';
          const proto = typeof result.runtime.pickleProtocol === 'number' && result.runtime.pickleProtocol >= 0
            ? ` ${chalk.gray(`(pickle v${result.runtime.pickleProtocol})`)}`
            : '';
          console.log(`  ${chalk.cyan('Runtime:')}        ${chalk.yellow(runtimeLabel)}${fmt}${proto}`);
          if (result.runtime.scriptVersion != null) {
            console.log(`  ${chalk.cyan('Script ver:')}     ${chalk.yellow(result.runtime.scriptVersion)}`);
          }
          if (result.runtime.confidence) {
            console.log(`  ${chalk.cyan('Confidence:')}     ${chalk.yellow(result.runtime.confidence)}`);
          }
          if (Array.isArray(result.runtime.notes) && result.runtime.notes.length > 0) {
            console.log(`  ${chalk.cyan('Detection:')}      ${chalk.gray(result.runtime.notes.join('; '))}`);
          }
        }
      }
      
      console.log(`  ${chalk.cyan('Output:')}        ${chalk.gray(path.resolve(output))}`);
      console.log(chalk.gray('═══════════════════════════════════════════════════════════\n'));
    }
  } catch (error) {
    spinner.fail(`Extraction failed`);
    console.error(chalk.red('\nError: ') + error.message);
    if (debug) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Handle the list command with enhanced formatting
 * @param {Object} argv - Command line arguments
 */
async function handleListCommand(argv) {
  const { input, filter, size, sort } = argv;

  console.log(chalk.bold.blue('📋 Listing archive contents...\n'));
  // Check if input file exists
  if (!fs.existsSync(input)) {
    console.error(chalk.red('✖ ') + chalk.bold(`Input file not found: ${input}`));
    process.exit(1);
  }

  const spinner = ora({
    text: 'Reading archive...',
    color: 'cyan',
    spinner: 'dots',
    isEnabled: isTTY
  }).start();

  try {
    const rpx = new RPX(input, { decompileRPYC: false });
    await rpx.parseIndex();
    let files = Object.entries(rpx.index);

    spinner.succeed(`Found ${chalk.yellow(files.length)} files`);

    // Apply filter
    if (filter) {
      files = files.filter(([name]) => name.toLowerCase().endsWith(filter.toLowerCase()));
      console.log(chalk.cyan('  Filtered: ') + `${files.length} files match ${chalk.yellow(filter)}`);
    }

    // Sort files
    if (sort === 'size') {
      files.sort((a, b) => b[1].size - a[1].size);
    } else if (sort === 'ext') {
      files.sort((a, b) => {
        const extA = path.extname(a[0]);
        const extB = path.extname(b[0]);
        return extA.localeCompare(extB) || a[0].localeCompare(b[0]);
      });
    } else {
      files.sort((a, b) => a[0].localeCompare(b[0]));
    }

    console.log(chalk.gray('\n═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold('  📁 Files:'));
    console.log(chalk.gray('  ───────────────────────────────────────────────────────────\n'));

    files.forEach(([name, info]) => {
      const ext = path.extname(name);
      let icon = '  📄';
      
      if (ext === '.png' || ext === '.jpg' || ext === '.webp') icon = '  🖼️ ';
      else if (ext === '.rpyc' || ext === '.rpy') icon = '  📜';
      else if (ext === '.mp3' || ext === '.ogg' || ext === '.wav') icon = '  🎵';
      else if (ext === '.mp4' || ext === '.webm') icon = '  🎬';
      else if (ext === '.ttf' || ext === '.otf') icon = '  🔤';

      if (size) {
        console.log(`${icon} ${chalk.cyan(name.padEnd(50))} ${chalk.gray(formatSize(info.size).padStart(12))}`);
      } else {
        console.log(`${icon} ${chalk.cyan(name)}`);
      }
    });

    // Calculate statistics
    const totalSize = files.reduce((sum, [, info]) => sum + info.size, 0);
    const extensions = {};
    files.forEach(([name]) => {
      const ext = path.extname(name) || 'no extension';
      extensions[ext] = (extensions[ext] || 0) + 1;
    });

    console.log(chalk.gray('\n  ───────────────────────────────────────────────────────────'));
    console.log(chalk.bold('  📊 Statistics:'));
    console.log(chalk.gray('  ───────────────────────────────────────────────────────────\n'));
    console.log(`  ${chalk.cyan('Total files:')}    ${chalk.yellow(files.length)}`);
    console.log(`  ${chalk.cyan('Total size:')}     ${chalk.yellow(formatSize(totalSize))}`);
    console.log(`  ${chalk.cyan('File types:')}     ${chalk.yellow(Object.keys(extensions).length)}`);
    
    console.log(chalk.gray('\n  Top file types:'));
    Object.entries(extensions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([ext, count]) => {
        console.log(`    ${chalk.gray('•')} ${chalk.cyan(ext.padEnd(15))} ${chalk.yellow(count)} files`);
      });

    console.log(chalk.gray('═══════════════════════════════════════════════════════════\n'));
  } catch (error) {
    spinner.fail(`Failed to list files`);
    console.error(chalk.red('\nError: ') + error.message);
    process.exit(1);
  }
}

/**
 * Handle the info command with detailed output
 * @param {Object} argv - Command line arguments
 */
async function handleInfoCommand(argv) {
  const { input, verbose } = argv;

  console.log(chalk.bold.blue('ℹ️  Archive Information\n'));
  // Check if input file exists
  if (!fs.existsSync(input)) {
    console.error(chalk.red('✖ ') + chalk.bold(`Input file not found: ${input}`));
    process.exit(1);
  }

  const spinner = ora({
    text: 'Analyzing archive...',
    color: 'cyan',
    spinner: 'dots',
    isEnabled: isTTY
  }).start();

  try {
    const stats = fs.statSync(input);
    const rpx = new RPX(input, { decompileRPYC: false });
    const header = await rpx.readHeader();
    
    spinner.text = 'Parsing index...';
    await rpx.parseIndex();
    const files = await rpx.listFiles();
    
    spinner.succeed('Analysis complete');

    console.log(chalk.gray('\n═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold('  📦 Archive Details:'));
    console.log(chalk.gray('  ───────────────────────────────────────────────────────────\n'));
    console.log(`  ${chalk.cyan('File:')}           ${chalk.yellow(path.basename(input))}`);
    console.log(`  ${chalk.cyan('Path:')}           ${chalk.gray(path.resolve(input))}`);
    console.log(`  ${chalk.cyan('Size:')}           ${chalk.yellow(formatSize(stats.size))}`);
    const headerLabel = header.isAlias && header.canonicalVersion
      ? `${header.version} (alias of ${header.canonicalVersion})`
      : header.version;
    console.log(`  ${chalk.cyan('Version:')}        ${chalk.yellow(headerLabel)}`);
    console.log(`  ${chalk.cyan('Files:')}          ${chalk.yellow(files.length)}`);
    
    if (header.key) {
      console.log(`  ${chalk.cyan('XOR Key:')}       ${chalk.yellow('0x' + header.key.toString(16).toUpperCase())}`);
    }
    
    if (header.offset) {
      console.log(`  ${chalk.cyan('Index Offset:')}  ${chalk.yellow(header.offset)} bytes`);
    }
    if (typeof header.indexJunkPrefix === 'number' && header.indexJunkPrefix > 0) {
      console.log(`  ${chalk.cyan('Index Junk:')}    ${chalk.yellow(header.indexJunkPrefix)} byte prefix skipped`);
    }

    if (verbose) {
      console.log(chalk.gray('\n  ───────────────────────────────────────────────────────────'));
      console.log(chalk.bold('  📊 Content Analysis:'));
      console.log(chalk.gray('  ───────────────────────────────────────────────────────────\n'));

      const extensions = {};
      const sizes = {};
      let totalContentSize = 0;

      Object.entries(rpx.index).forEach(([name, info]) => {
        const ext = path.extname(name) || 'no extension';
        extensions[ext] = (extensions[ext] || 0) + 1;
        sizes[ext] = (sizes[ext] || 0) + info.size;
        totalContentSize += info.size;
      });

      console.log(`  ${chalk.cyan('Content Size:')}  ${chalk.yellow(formatSize(totalContentSize))}`);
      console.log(`  ${chalk.cyan('Compression:')}   ${chalk.yellow(((1 - totalContentSize / stats.size) * 100).toFixed(2) + '%')} ratio`);

      console.log(chalk.gray('\n  File type breakdown:'));
      Object.entries(extensions)
        .sort((a, b) => b[1] - a[1])
        .forEach(([ext, count]) => {
          const size = sizes[ext];
          const percent = ((count / files.length) * 100).toFixed(1);
          console.log(`    ${chalk.gray('•')} ${chalk.cyan(ext.padEnd(15))} ${chalk.yellow(count.toString().padStart(5))} files (${percent}%) - ${chalk.gray(formatSize(size))}`);
        });
    }

    console.log(chalk.gray('═══════════════════════════════════════════════════════════\n'));
  } catch (error) {
    spinner.fail(`Failed to get info`);
    console.error(chalk.red('\nError: ') + error.message);
    process.exit(1);
  }
}

async function handleCreateCommand(argv) {
  const { input, output, header, key, protocol, marker, includeHidden, force, debug } = argv;

  if (!fs.existsSync(input)) {
    console.error(chalk.red('✖ ') + chalk.bold(`Input path not found: ${input}`));
    process.exit(1);
  }

  const resolvedOutput = path.resolve(output);
  if (!force && fs.existsSync(resolvedOutput)) {
    console.error(chalk.red('✖ ') + chalk.bold(`Output file already exists: ${resolvedOutput} (use --force to overwrite)`));
    process.exit(1);
  }

  const spinner = ora({
    text: 'Building archive...',
    color: 'cyan',
    spinner: 'dots',
    isEnabled: isTTY
  }).start();

  try {
    const result = await createArchive({
      input,
      output: resolvedOutput,
      version: header,
      key,
      pickleProtocol: protocol,
      marker,
      includeHidden,
      debug,
      force,
    });

    spinner.succeed(chalk.green('Archive created'));

    console.log(`${chalk.cyan('Output:')}        ${chalk.yellow(resolvedOutput)}`);
    if (result.indexFile && result.indexFile !== resolvedOutput) {
      console.log(`${chalk.cyan('Index:')}         ${chalk.yellow(result.indexFile)}`);
    }
    const versionLabel = result.canonicalVersion && result.canonicalVersion !== result.version
      ? `${result.version} (alias of ${result.canonicalVersion})`
      : result.version;
    console.log(`${chalk.cyan('Version:')}       ${chalk.yellow(versionLabel)}`);
    if (result.key !== null && result.key !== undefined) {
      const keyHex = (result.key >>> 0).toString(16).toUpperCase().padStart(8, '0');
      console.log(`${chalk.cyan('XOR Key:')}       ${chalk.yellow('0x' + keyHex)}`);
    }
    if (typeof result.indexOffset === 'number') {
      const offsetHex = result.indexOffset.toString(16).toUpperCase();
      console.log(`${chalk.cyan('Index Offset:')}  ${chalk.yellow(`${result.indexOffset} (${offsetHex})`)}`);
    }
    console.log(`${chalk.cyan('Files:')}         ${chalk.yellow(result.files)}`);
    if (typeof result.dataBytes === 'number') {
      console.log(`${chalk.cyan('Data Size:')}     ${chalk.yellow(formatSize(result.dataBytes))}`);
    }
  } catch (error) {
    spinner.fail(chalk.red('✖ Failed to create archive'));
    console.error(chalk.red('\nError: ') + error.message);
    if (debug && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

// Main CLI function
async function main() {
  try {
    const command = argv._[0];

    switch (command) {
      case 'extract':
        await handleExtractCommand(argv);
        break;
      case 'list':
        await handleListCommand(argv);
        break;
      case 'info':
        await handleInfoCommand(argv);
        break;
      case 'create':
        await handleCreateCommand(argv);
        break;
      default:
        console.error(chalk.red('✖ ') + `Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('\n✖ Fatal Error: ') + error.message);
    process.exit(1);
  }
}

// Run the CLI
main();

export {
  handleExtractCommand,
  handleListCommand,
  handleInfoCommand,
  handleCreateCommand
};


