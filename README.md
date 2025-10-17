<div align="center">

  <img src="images/logo.png" alt="Sayonika" width="400" height="200">

  <h3>✨ A multi-purpose Ren'Py tool ✨</h3>

  <br>

  <h4>🌟 Modern JavaScript RPA toolchain for developers and modders 🌟</h4>

  <br>

  <p><strong>👨‍💻 Maintainer:</strong> <a href="https://github.com/Dynamicaaa">Dynamicaaa</a></p>

  <br>

---

## 🌟 Features Overview

  <table style="margin: 0 auto; border-collapse: collapse; width: 90%; max-width: 800px;">
    <tr>
      <th style="text-align: center; padding: 12px; border: 1px solid #ddd; background-color: #f8f9fa;">🎯 <strong>Core Capabilities</strong></th>
      <th style="text-align: center; padding: 12px; border: 1px solid #ddd; background-color: #f8f9fa;">⚡ <strong>Advanced Functionality</strong></th>
    </tr>
    <tr>
      <td style="text-align: center; padding: 12px; border: 1px solid #ddd;">📦 <strong>Supports RPA-1.0 → RPA-4.0</strong><br/>Handles every Ren’Py archive format</td>
      <td style="text-align: center; padding: 12px; border: 1px solid #ddd;">🧠 <strong>Runtime Detection</strong><br/>Detects Ren’Py/Python version from archive data</td>
    </tr>
    <tr>
      <td style="text-align: center; padding: 12px; border: 1px solid #ddd;">🛠️ <strong>Dual Interface</strong><br/>CLI + Node.js API integration</td>
      <td style="text-align: center; padding: 12px; border: 1px solid #ddd;">🔍 <strong>`.rpyc` Auto-Decompiler</strong><br/>Uses bundled <code>unrpyc-js</code> helpers</td>
    </tr>
    <tr>
      <td style="text-align: center; padding: 12px; border: 1px solid #ddd;">🔐 <strong>Legacy & Modern Indexing</strong><br/>Understands `.rpi` and embedded index formats</td>
      <td style="text-align: center; padding: 12px; border: 1px solid #ddd;">🔑 <strong>XOR Key Encryption</strong><br/>Supports RPA-3.x & RPA-4.x encrypted archives</td>
    </tr>
    <tr>
      <td style="text-align: center; padding: 12px; border: 1px solid #ddd;">🌍 <strong>Cross-Platform</strong><br/>Works on Windows, macOS, and Linux</td>
      <td style="text-align: center; padding: 12px; border: 1px solid #ddd;">⚙️ <strong>Pickle Protocols</strong><br/>Automatic pickle version detection</td>
    </tr>
  </table>

---

## 🚀 Quick Start

### 📦 Installation

```bash
npm install @dynamicaaa/rpx
npx @dynamicaaa/rpx --help
npm install -g @dynamicaaa/rpx
```

### 💻 CLI Usage

```bash
rpx extract -i game.rpa -o extracted/
rpx list -i game.rpa
rpx info -i game.rpa --verbose
rpx create -i dist/game -o dist/game.rpa --header 4.0
```

### 🧠 Programmatic Usage

```javascript
import { RPX, extract, list, createArchive } from '@dynamicaaa/rpx';
const archive = new RPX('game.rpa');
await archive.readHeader();
await archive.parseIndex();
console.log('Files:', await archive.listFiles());
await extract('game.rpa', 'extracted');
await createArchive({ input: 'build/game', output: 'dist/game.rpa', version: '4.0', key: '0x42' });
```

---

## 🧩 Command Reference

  <table style="margin: 0 auto; border-collapse: collapse; width: 80%; max-width: 700px;">
    <tr><th>Command</th><th>Description</th></tr>
    <tr><td><code>rpx extract</code></td><td>Extract files from an RPA archive.</td></tr>
    <tr><td><code>rpx list</code></td><td>List archive contents.</td></tr>
    <tr><td><code>rpx info</code></td><td>Display archive header information.</td></tr>
    <tr><td><code>rpx create</code></td><td>Package files into .rpa archives (RPA-1.0 → RPA-4.0).</td></tr>
  </table>

---

## ⚙️ Archive Creation Reference

  <table style="margin: 0 auto; border-collapse: collapse; width: 90%; max-width: 800px;">
    <tr><th>Option</th><th>Description</th></tr>
    <tr><td><code>input</code></td><td>Source directory or file.</td></tr>
    <tr><td><code>output</code></td><td>Destination archive path.</td></tr>
    <tr><td><code>version</code></td><td>Target header (1.0–4.0, default 3.0).</td></tr>
    <tr><td><code>key</code></td><td>Optional XOR key for encryption.</td></tr>
    <tr><td><code>marker</code></td><td>Toggle “Made with Ren’Py” marker.</td></tr>
    <tr><td><code>includeHidden</code></td><td>Include hidden files.</td></tr>
    <tr><td><code>force</code></td><td>Overwrite existing archives.</td></tr>
    <tr><td><code>pickleProtocol</code></td><td>Override pickle version manually.</td></tr>
  </table>

---

## 🔍 Runtime Detection

RPX automatically infers Ren’Py runtime metadata:<br><br>
• Detects Ren’Py 6.x / 7.x (Python 2) and Ren’Py 8.x (Python 3).<br>
• Displays pickle protocol version and script metadata.<br>
• Reports confidence levels and diagnostic notes.<br>

---

## 📚 Documentation & Support

[Project Overview](docs/overview.md) · [CLI Guide](docs/cli.md) · [API Reference](docs/api.md) · [Examples](docs/examples.md) · [Troubleshooting](docs/troubleshooting.md)

---

## 🤝 Contributing

We welcome contributions! Run tests, update docs, and describe edge cases.
[Open an issue](https://github.com/Dynamicaaa/rpx/issues/new) for bugs or requests.

---

## 📜 License

MIT © [Dynamicaaa](https://github.com/Dynamicaaa)

---

Built with ❤️ for the Ren’Py developer community

</div>