# RPX Documentation

Welcome to the RPX documentation hub. These guides explain how to integrate the library in your own tooling, automate packaging pipelines, and take advantage of the bundled CLI.

## Table of Contents

- [Project Overview](overview.md)
- [Command Line Interface](cli.md)
- [JavaScript API Reference](api.md)
- [Recipes & Examples](examples.md)
- [Troubleshooting](troubleshooting.md)

RPX supports ALT-1.0's obfuscated header and can extract ZiX-12A/ZiX-12B archives by reading the accompanying loader module to recover their verification codes. ZiX archive creation is intentionally unsupported because it requires re-generating proprietary loader payloads.

## Runtime Dependencies

RPX bundles a small set of runtime dependencies:

- [`@dynamicaaa/pyrunner`](https://www.npmjs.com/package/@dynamicaaa/pyrunner) - manages the portable Python runtime.
- [`@dynamicaaa/unrpyc-js`](../unrpyc-js/README.md) - JavaScript wrapper around [CensoredUsername/unrpyc](https://github.com/CensoredUsername/unrpyc) for `.rpyc` decompilation.
- [`@dynamicaaa/rpicklex`](../rpicklex/README.md) - pure JavaScript pickle reader.
- CLI ergonomics: [`chalk`](https://www.npmjs.com/package/chalk), [`gradient-string`](https://www.npmjs.com/package/gradient-string), [`cli-progress`](https://www.npmjs.com/package/cli-progress), [`ora`](https://www.npmjs.com/package/ora), [`yargs`](https://www.npmjs.com/package/yargs).

These dependencies are installed automatically with the package. The Python runtime is cached in `~/.pyrunner` after the first run.

For quick installation instructions or release notes consult the main [README](../README.md).
