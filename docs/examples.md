# Recipes & Examples

## 1. Automating Releases with NPM Scripts

```json
{
  "scripts": {
    "build:assets": "node tools/build-assets.js",
    "package:rpa": "rpx create -i dist/game -o dist/game.rpa --header 4.0",
    "release": "npm run build:assets && npm run package:rpa"
  }
}
```

## 2. Custom Build Pipeline in JavaScript

```js
import { createArchive, extract } from '@dynamicaaa/rpx';

async function rebuildArchive() {
  await createArchive({
    input: 'build/game',
    output: 'artifacts/game.rpa',
    version: '3.0',
    key: '0x42424242',
    includeHidden: true,
  });
}

async function extractToTemp(rpaPath) {
  await extract(rpaPath, 'tmp/extracted', { debug: process.env.DEBUG });
}
```

## 3. Inspecting Archives Programmatically

```js
import { RPX, classifyRuntime } from '@dynamicaaa/rpx';

const archive = new RPX('game.rpa', { debug: true });
await archive.readHeader();
await archive.parseIndex();

console.log('Files:', await archive.listFiles());
console.log('Runtime:', classifyRuntime(archive.runtime));
```

## 4. Creating a Legacy Archive (RPA-1.0)

```js
await createArchive({
  input: 'content',
  output: 'legacy/game.rpa',
  version: '1.0',
  force: true,
});
// Companion index will be emitted at legacy/game.rpi
```

## 5. Custom XOR Obfuscation

```js
await createArchive({
  input: 'dist/game',
  output: 'dist/obfuscated.rpa',
  version: '3.0',
  key: 0x12345678,
  marker: true,
});
```

## 6. Integrating with TypeScript

```ts
import type { CreateArchiveResult } from '@dynamicaaa/rpx';
import { createArchive } from '@dynamicaaa/rpx';

type ReleaseConfig = {
  contentDir: string;
  output: string;
};

async function packageRelease(config: ReleaseConfig): Promise<CreateArchiveResult> {
  return createArchive({
    input: config.contentDir,
    output: config.output,
    version: '4.0',
    marker: true,
  });
}
```

More real-world usage patterns are welcome – feel free to open a PR with additional recipes.
