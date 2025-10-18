# Troubleshooting

## Python runtime downloads every run
RPX relies on `@dynamicaaa/pyrunner` which caches a portable Python runtime per project. Ensure the process can write to the PyRunner cache directory (`~/.pyrunner` by default). Use the `PYRUNNER_HOME` environment variable to override the location.

## `Unsupported RPA version` when reading an archive
Double-check the archive header. RPX recognises `RPA-1.0`, `RPA-2.0`, `RPA-3.0`, `RPA-3.2`, `RPA-4.0`, and proprietary variants like `ZiX-12A`, `ZiX-12B`, and `ALT-1.0`. ZiX archives require the accompanying `loader.py`/`.pyc` file to recover their verification code.

## `Failed to decompress index` on ZiX variants
RPX automatically scans ahead for the start of the zlib stream when handling ZiX-12A/ZiX-12B archives. Ensure the matching loader file is present and rerun with `--debug` to confirm the detected junk prefix. For other custom headers you can override detection with `--header` to force the expected format.

## `Index offset ... is beyond file end`
The header offset did not match the actual index location. This usually happens when the archive was truncated or when the index was stripped. For RPA-1.0 ensure the companion `.rpi` file is present next to the `.rpa` file.

## Unicode errors on Windows
Always run Node with UTF-8 support. In PowerShell you can run `chcp 65001` or set `$OutputEncoding = [System.Text.UTF8Encoding]::UTF8`. The CLI emits UTF-8 characters for headers and status messages.

## Decompilation errors
The decompiler (`unrpyc`) does not guarantee success for heavily obfuscated scripts. Use the `--try-harder` flag or set `debug: true` to inspect Python stack traces. If you only need raw `.rpyc` files pass `--no-decompile`.

## PyRunner cannot download Python
Corporate proxies or offline environments can block automatic downloads. Pre-install Python by running `npx @dynamicaaa/pyrunner doctor --python 3.9.0` or configure `PYRUNNER_PYTHON` to point at an existing interpreter.

Still stuck? [Open an issue](https://github.com/Dynamicaaa/rpx/issues/new) with repro steps and the debug output.
