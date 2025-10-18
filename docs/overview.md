# Project Overview

RPX is an end-to-end Ren'Py archive toolkit implemented in modern JavaScript. It exposes the same primitives that power the official CLI so you can embed archive manipulation in build pipelines, CI jobs, or bespoke tools without shelling out to the command line.

## Key Features

- **Archive creation** - generate `.rpa` archives targeting headers RPA-1.0 through RPA-4.0 (ALT-1.0 output supported; ZiX-12A/ZiX-12B extraction relies on loader metadata), including optional XOR obfuscation and Ren'Py marker padding.
- **Archive extraction** - unpack archives, list contents, automatically decompile `.rpyc` scripts via [`@dynamicaaa/unrpyc-js`](../unrpyc-js/README.md), and recover indexes that hide behind junk prefixes.
- **Runtime heuristics** - detect the originating Ren'Py/Python runtime to assist in forward/backward compatibility decisions.
- **Legacy support** - first-generation archives (`.rpa` + `.rpi`) are handled transparently by the same API.
- **Node friendly** - published as an ES module with zero native dependencies. Works from Node.js 16 onward.

## Architecture at a Glance

The package is organised around a handful of core building blocks:

| Component | Responsibility |
|-----------|----------------|
| `RPX` class | Lazily reads archive metadata, lists files, and streams file data to disk. |
| `createArchive()` | Packs files into a new archive with version-aware rules (markers, XOR, pickling). |
| `classifyRuntime()` | Translates runtime heuristics into human-friendly descriptors. |
| CLI (`bin/rpx.js`) | Thin wrapper around the library that handles user input, spinners, and reporting. |

Under the hood the library relies on:

- **PyRunner** ([`@dynamicaaa/pyrunner`](https://www.npmjs.com/package/@dynamicaaa/pyrunner)) for running Python snippets when pickling or decompiling.
- **UnrpycJS** ([`@dynamicaaa/unrpyc-js`](../unrpyc-js/README.md)) built on top of [CensoredUsername/unrpyc](https://github.com/CensoredUsername/unrpyc) to decompile `.rpyc` files.
- **RPickleX** ([`@dynamicaaa/rpicklex`](../rpicklex/README.md)) for loading Python pickle indexes without the CPython runtime.

## Compatibility

- Node.js >= 16 is recommended (tested up to the latest LTS).
- Archives produced using RPX are recognised by the Ren'Py SDK as well as community tools like `unrpa` and `rpatool`.
- When targeting Python 2 era games you can force `--header 2.0` (or `1.0`) to ensure downstream compatibility.

## Next Steps

- Familiarise yourself with the [CLI guide](cli.md) for day-to-day usage.
- Review the [API reference](api.md) if you plan to embed RPX in your own scripts.
- Browse the [examples](examples.md) for common automation patterns.
