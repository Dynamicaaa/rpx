<div align="center">
  
  <img src="images/logo.png" alt="Sayonika" width="400" height="200">
  
  <h3>✨ A mutli-purpose Ren'Py tool ✨</h3>
  
  <br>
  
  <br>
  
  <p><strong>👨‍💻 Maintainer:</strong> <a href="https://github.com/Dynamicaaa">Dynamicaaa</a></p>
  
  <br>
  
</div>

RPX is a modern JavaScript implementation of the Ren'Py archive toolchain. It bundles a feature-rich CLI and a fully documented library so you can inspect, extract, or build `.rpa` archives directly from Node.js.

- Supports every official archive header (`RPA-1.0` through `RPA-4.0`).
- Understands legacy `.rpi` index files and modern embedded indexes.
- Automatically decompiles `.rpyc` scripts via bundled `unrpyc-js` helpers.
- Detects the originating Ren''Py/Python runtime using heuristics.
- Published as an ES module – integrate it with build tools, scripts, or other CLIs.

> Extensive guides live in the [`docs/`](docs/README.md) folder. This README highlights the essentials.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Command Line Usage](#command-line-usage)
- [Programmatic API](#programmatic-api)
- [Archive Creation Reference](#archive-creation-reference)
- [Runtime Detection](#runtime-detection)
- [Documentation & Support](#documentation--support)
- [Contributing](#contributing)
- [License](#license)

## Installation

Node.js 16 or later is recommended.

```bash
# Install locally
npm install @dynamicaaa/rpx

# Use the CLI via npx
npx @dynamicaaa/rpx --help
```

To install the CLI globally:

```bash
npm install -g @dynamicaaa/rpx
```

## Quick Start

### CLI

```bash
# Extract an archive
rpx extract -i game.rpa -o extracted

# Display archive metadata
rpx info -i game.rpa --verbose

# Package a build
rpx create -i dist/game -o dist/game.rpa --header 4.0
```

### Programmatic Usage

```js
import { RPX, extract, list, createArchive } from '@dynamicaaa/rpx';

// Inspect an archive
const archive = new RPX('game.rpa');
await archive.readHeader();
await archive.parseIndex();
console.log('Files:', await archive.listFiles());

// Convenience helpers
await extract('game.rpa', 'extracted');
const files = await list('game.rpa');

// Create an archive targeting RPA-4.0
await createArchive({
  input: 'build/game',
  output: 'dist/game.rpa',
  version: '4.0',
  key: '0x42',
});
```

## Command Line Usage

| Command | Description |
| ------- | ----------- |
| `rpx extract` | Extract an archive to disk (with optional `.rpyc` decompilation). |
| `rpx list` | List archive contents with optional sorting/filtering. |
| `rpx info` | Display header information, heuristics, and index statistics. |
| `rpx create` | Package files into a new `.rpa` archive (supports headers 1.0 – 4.0). |

Each command accepts the same flags documented in [docs/cli.md](docs/cli.md). Run `rpx <command> --help` for a concise reminder.

## Programmatic API

> Need a standalone `.rpyc` decompiler? Install [`@dynamicaaa/unrpyc-js`](unrpyc-js/README.md) which powers RPX under the hood.

The core exports are fully documented with JSDoc and summarised in [docs/api.md](docs/api.md). Highlights include:

- `new RPX(filePath, options)` – read metadata, list files, and extract payloads.
- `extract(filePath, outputDir, options?)` – convenience wrapper around `RPX.extractAll()`.
- `list(filePath, options?)` – list archive paths without instantiating the class manually.
- `createArchive(options)` – build archives (including legacy `.rpi` files, XOR keys, and markers).
- `classifyRuntime(info)` – normalise runtime detection details for display in custom tooling.

All functions return Promises and reject with descriptive `Error` objects when something fails. Debug logging (including Python stdout/stderr) can be enabled by passing `debug: true` in the relevant options.

## Archive Creation Reference

`createArchive` accepts a rich configuration object. The most important fields are:

| Option | Description |
| ------ | ----------- |
| `input` | Source directory or file. |
| `output` | Destination archive path. |
| `version` | Target header (`1.0`, `2.0`, `3.0`, `3.2`, `4.0`) – defaults to `3.0`. |
| `key` | XOR key (hex string or number) for RPA-3.x/4.x archives. |
| `marker` | Toggle the `Made with Ren'Py.` padding marker (where supported). |
| `includeHidden` | Include dotfiles when packaging directories. |
| `force` | Overwrite existing output files. |
| `pickleProtocol` | Override the pickle protocol (defaults automatically for each version). |

Return value:

```ts
interface CreateArchiveResult {
  version: string;
  output: string;
  files: number;
  dataBytes: number;
  key: number | null;
  indexOffset: number | null;
  indexFile: string | null; // present for RPA-1.0 archives
}
```

See [docs/examples.md](docs/examples.md) for automation recipes, including legacy archive creation, custom XOR obfuscation, and TypeScript integration.

## Runtime Detection

The library analyses the archive index and payload to infer the originating Ren'Py runtime:

- Detects whether the archive targets Ren'Py 6.x / 7.x (Python 2) or Ren'Py 8.x (Python 3).
- Surfaces pickle protocol versions and `script_version` metadata when available.
- Provides qualitative confidence levels and raw diagnostic notes.

CLI commands automatically print this information in the summary. Programmatic consumers can use `classifyRuntime()` to tailor the display for their own tools.

## Documentation & Support

- [Project overview](docs/overview.md)
- [CLI usage guide](docs/cli.md)
- [JavaScript API reference](docs/api.md)
- [Recipes & examples](docs/examples.md)
- [Troubleshooting](docs/troubleshooting.md)

If you encounter a bug or need an enhancement, [open an issue](https://github.com/Dynamicaaa/rpx/issues/new) with reproduction details.

## Contributing

Pull requests are welcome! Please:

1. Run linting/tests relevant to your changes.
2. Update documentation where applicable.
3. Describe the motivation and edge cases in your PR description.

## License

MIT © Dynamicaaa
