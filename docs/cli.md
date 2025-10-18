# Command Line Interface

Install the CLI globally or run it via `npx`:

```bash
npm install -g @dynamicaaa/rpx
# or
npx @dynamicaaa/rpx --help
```

All commands share a consistent structure: `rpx <command> [options]`.

## Commands

### `rpx extract`

Extract files from an archive to a destination directory.

| Option | Description |
| ------ | ----------- |
| `-i, --input <path>` | Path to the source `.rpa` file. *(required)* |
| `-o, --output <dir>` | Extraction target directory. *(required)* |
| `-f, --file <path>` | Extract a single file inside the archive. |
| `--no-decompile` | Skip `.rpyc` decompilation even when available. |
| `--progress / --no-progress` | Toggle progress bar output. |
| `--overwrite` | Overwrite existing `.rpy` files during decompilation. |
| `--try-harder` | Enable unrpyc "try harder" mode. |
| `--keep-rpyc` | Keep `.rpyc` files alongside `.rpy`. |
| `--debug` | Verbose logging (also prints Python stderr/stdout). |

```bash
rpx extract -i game.rpa -o extracted
rpx extract -i game.rpa -o extracted -f "game/script.rpyc"
```

### `rpx list`

List archive contents with optional filtering.

| Option | Description |
| ------ | ----------- |
| `-i, --input <path>` | Source archive. *(required)* |
| `-f, --filter <suffix>` | Restrict output to files ending with the suffix. |
| `-s, --sort <field>` | Sort by `name` (default), `size`, or `ext`. |
| `-S, --size` | Include file sizes in the listing. |
| `--debug` | Verbose logging. |

```bash
rpx list -i game.rpa -s size --size
```

### `rpx info`

Display metadata about an archive, including inferred runtime information.

| Option | Description |
| ------ | ----------- |
| `-i, --input <path>` | Source archive. *(required)* |
| `-v, --verbose` | Show detailed index statistics. |
| `--debug` | Verbose logging. |

```bash
rpx info -i game.rpa --verbose
```

### `rpx create`

Create a new archive from files or directories.

| Option | Description |
| ------ | ----------- |
| `-i, --input <path>` | Directory or file to pack. *(required)* |
| `-o, --output <file>` | Destination archive. *(required)* |
| `-v, --header <header>` | Version header (`1.0`, `2.0`, `3.0`, `3.2`, `4.0`, `ZiX-12A`, `ZiX-12B`, `ALT-1.0`). |
| `-k, --key <hex>` | XOR key for RPA-3.x/4.x archives (`0x` prefix optional). |
| `--protocol <n>` | Pickle protocol override (defaults per version). |
| `--marker / --no-marker` | Control insertion of "Made with Ren'Py." markers (where supported). |
| `--include-hidden` | Include dotfiles when packaging directories. |
| `--force` | Overwrite existing output files. |
| `--debug` | Verbose logging (shows Python stdout/stderr). |

```bash
rpx create -i build/game -o dist/game.rpa --header 4.0 --key 0x42
```

ALT-1.0 archives store an obfuscated XOR key in the header; supply the real key via `--key` and RPX will emit the correct format. ZiX-12A/ZiX-12B extraction requires the accompanying `loader.py`/`.pyc` file next to the archive so the verification code can be recovered. Creating ZiX archives is not supported.

## Exit Codes

- **0** – command executed successfully.
- **1** – unrecoverable error (invalid path, parse failure, etc.).

## Environment Variables

- `PYRUNNER_HOME` – override PyRunner cache path (used for Python runtime downloads).
- `RPX_DEBUG` – when set to a truthy value, enables debug logging globally.

For programmatic usage consult the [API reference](api.md).
