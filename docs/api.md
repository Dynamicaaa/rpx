# JavaScript API Reference

All exports are available from the package root. The module is published as an ES module – import it using `import { ... } from '@dynamicaaa/rpx';`.

```js
import { RPX, extract, list, createArchive, classifyRuntime } from '@dynamicaaa/rpx';
```

## `class RPX`

High-level reader for Ren'Py archives. Instances lazily parse metadata and cache results for repeated access.

### Constructor

```ts
new RPX(filePath: string, options?: {
  decompileRPYC?: boolean;
  overwriteRPY?: boolean;
  tryHarder?: boolean;
  keepRpycFiles?: boolean;
  debug?: boolean;
})
```

All options mirror the corresponding CLI flags and influence decompilation behaviour when calling `extract`/`extractAll`.

### Methods

| Method | Description |
| ------ | ----------- |
| `await readHeader()` | Parse the archive header and populate `instance.header` with `version`, `offset`, `key`, etc. |
| `await parseIndex()` | Decode the archive index (handles embedded indexes and legacy `.rpi` files). |
| `await extractFile(filePath, dest)` | Extract a single file. Returns `{ extracted, decompiled? }`. |
| `await extractAll(dest, { onProgress })` | Extract every file. Returns `{ extracted, decompiled?, failed? }`. |
| `await listFiles()` | Return an array of archive-relative paths. |
| `await resolveLegacyIndexPath()` | Locate the `.rpi` companion file (only relevant for `RPA-1.0`). |

### Properties

After calling `readHeader()` the following properties are available:

- `header.version`
- `header.offset`
- `header.key`
- `header.data` (raw header line)

Calling `parseIndex()` populates `index` with a `{ [archivePath]: { offset, size } }` mapping.

## Convenience Helpers

### `extract(filePath, outputDir, options?)`

Shorthand for `new RPX(filePath, options).extractAll(outputDir)`.

### `list(filePath, options?)`

Shorthand for `new RPX(filePath, options).listFiles()`.

### `createArchive(options: CreateArchiveOptions)`

Create a new archive. See [CreateArchiveOptions](#createarchiveoptions) for the complete shape. Returns a [`CreateArchiveResult`](#createarchiveresult).

Example:

```js
import { createArchive } from '@dynamicaaa/rpx';

await createArchive({
  input: 'dist/game',
  output: 'dist/game.rpa',
  version: '4.0',
  key: '0x42',
  includeHidden: false,
  marker: true,
});
```

### `classifyRuntime(info)`

Normalise runtime detection data into a friendly label. This is mainly useful when you keep data returned by `RPX.extractAll()` or `createArchive()` and want to surface the result in custom UIs.

## Typedefs

### `CreateArchiveOptions`

| Property | Type | Description |
| -------- | ---- | ----------- |
| `input` | `string` | Source directory or file. |
| `output` | `string` | Destination `.rpa` path. |
| `version` | `string` | Version header (`1.0`, `2.0`, `3.0`, `3.2`, `4.0`). Defaults to `3.0`. |
| `key` | `string \| number` | XOR key (hex string or decimal) for RPA-3.x/4.x archives. Optional. |
| `pickleProtocol` | `number` | Override pickle protocol (defaults to 2/4 depending on version). |
| `marker` | `boolean` | Force enabling/disabling the Ren'Py marker padding (where supported). |
| `includeHidden` | `boolean` | Include dotfiles when packing directories. Defaults to `false`. |
| `debug` | `boolean` | Emit verbose logging. |
| `force` | `boolean` | Overwrite existing output files. |

### `CreateArchiveResult`

| Property | Type | Description |
| -------- | ---- | ----------- |
| `version` | `string` | Header string written to the archive. |
| `output` | `string` | Absolute path to the archive. |
| `files` | `number` | Number of user files written. |
| `dataBytes` | `number` | Total bytes of raw payload data. |
| `key` | `number \| null` | XOR key used (if applicable). |
| `indexOffset` | `number \| null` | Byte offset of the embedded index (null for RPA-1.0). |
| `indexFile` | `string \| null` | Path to the generated `.rpi` (RPA-1.0 only). |

### `RuntimeClassification`

| Property | Type | Notes |
| -------- | ---- | ----- |
| `format` | `string` | Raw RPC format (`RPC1`, `RPC2`, etc.). |
| `pythonMajor` | `number` | 2, 3, or `0` when undetermined. |
| `renpyMajor` | `number \| string` | Friendly Ren'Py generation. |
| `pickleProtocol` | `number` | Pickle protocol used by the index. |
| `scriptVersion` | `number \| null` | Extracted `script_version`. |
| `hasInitOffset` | `boolean` | True when init offset statements were observed. |
| `confidence` | `string \| null` | Qualitative confidence (`high`, `medium`, `low`). |
| `build` | `string \| null` | Build identifier when present. |
| `notes` | `string[]` | Additional diagnostic notes. |
| `label` | `string` | Human-readable summary. |

## Error Handling

All asynchronous API calls reject with an `Error` object. When the underlying Python execution fails, the Python stderr/stdout streams are included in the error message when `debug: true` is supplied.

To ensure clean-up of the temporary Python runtime, call `await PyRunner.instance?.close()` yourself if you manually create a runner. The library handles lifecycle management automatically for the public helpers.
