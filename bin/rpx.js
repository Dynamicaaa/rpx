#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const { RPX, extract, list } = require('../src/index.js');

/**
 * RPX CLI - Command Line Interface for RenPy RPA Extractor
 */

// CLI setup
const argv = yargs
  .usage('Usage: rpx <command> [options]')
  .command('extract', 'Extract files from an RPA archive', (yargs) => {
    return yargs
      .option('input', {
        alias: 'i',
        describe: 'Path to the RPA file',
        demandOption: true,
        type: 'string'
      })
      .option('output', {
        alias: 'o',
        describe: 'Output directory for extracted files',
        demandOption: true,
        type: 'string'
      })
      .option('file', {
        alias: 'f',
        describe: 'Specific file to extract (optional)',
        type: 'string'
      });
  })
  .command('list', 'List files in an RPA archive', (yargs) => {
    return yargs
      .option('input', {
        alias: 'i',
        describe: 'Path to the RPA file',
        demandOption: true,
        type: 'string'
      });
  })
  .command('info', 'Show information about an RPA archive', (yargs) => {
    return yargs
      .option('input', {
        alias: 'i',
        describe: 'Path to the RPA file',
        demandOption: true,
        type: 'string'
      });
  })
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .alias('help', 'h')
  .argv;

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
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Handle the extract command
 * @param {Object} argv - Command line arguments
 */
async function handleExtractCommand(argv) {
  const { input, output, file } = argv;

  // Check if input file exists
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  // Check if output directory exists, create if not
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true });
  }

  const rpx = new RPX(input);

  if (file) {
    // Extract specific file
    const outputPath = path.join(output, file);
    await rpx.extractFile(file, outputPath);
    console.log(`Extracted ${file} to ${outputPath}`);
  } else {
    // Extract all files
    await rpx.extractAll(output);
    const files = await rpx.listFiles();
    console.log(`Extracted ${files.length} files to ${output}`);
  }
}

/**
 * Handle the list command
 * @param {Object} argv - Command line arguments
 */
async function handleListCommand(argv) {
  const { input } = argv;

  // Check if input file exists
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const files = await list(input);
  console.log(`Files in ${input}:`);
  files.forEach(file => console.log(`  ${file}`));
  console.log(`\nTotal: ${files.length} files`);
}

/**
 * Handle the info command
 * @param {Object} argv - Command line arguments
 */
async function handleInfoCommand(argv) {
  const { input } = argv;

  // Check if input file exists
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const rpx = new RPX(input);
  const header = await rpx.readHeader();
  
  console.log(`RPA Archive Information:`);
  console.log(`  File: ${input}`);
  console.log(`  Version: ${header.version}`);
  console.log(`  Header: ${header.data}`);
  
  if (header.key) {
    console.log(`  Key: 0x${header.key.toString(16)}`);
  }
  
  if (header.iv) {
    console.log(`  IV: ${header.iv.toString('hex')}`);
  }
  
  if (header.offset) {
    console.log(`  Index Offset: ${header.offset}`);
  }
  
  const files = await rpx.listFiles();
  console.log(`  Files: ${files.length}`);
}

// Run the CLI
if (require.main === module) {
  main();
}

module.exports = {
  handleExtractCommand,
  handleListCommand,
  handleInfoCommand
};