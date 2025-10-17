import path from 'path';
import fs from 'fs/promises';
import { PyRunner } from '@dynamicaaa/pyrunner';

function escapePyString(value) {
  return value.replace(/\\/g, '/').replace(/'/g, "\\'");
}

async function listRpycFiles(root, recursive = true) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        const nested = await listRpycFiles(fullPath, recursive);
        result.push(...nested);
      }
    } else if (
      entry.isFile() &&
      (entry.name.toLowerCase().endsWith('.rpyc') || entry.name.toLowerCase().endsWith('.rpymc'))
    ) {
      result.push(fullPath);
    }
  }
  return result;
}

class UnrpycJS {
  constructor(options = {}) {
    this.debug = Boolean(options.debug);
    this.outputDir = options.outputDir ? path.resolve(options.outputDir) : path.resolve('./decompiled');
    this.overwrite = Boolean(options.overwrite);
    this.tryHarder = Boolean(options.tryHarder);
    this.processes = options.processes ?? 1;

    this.pyRunner = new PyRunner({ debug: this.debug });
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    await this.pyRunner.init();
    try {
      await this.pyRunner.installPackage('unrpyc');
    } catch (error) {
      if (this.debug) {
        console.warn('[UnrpycJS] pip install unrpyc failed:', error.message);
      }
    }

    const check = await this.pyRunner.runCode("import importlib.util; print(importlib.util.find_spec('unrpyc') is not None)");
    if (!/True/.test(check.stdout || '')) {
      await this.pyRunner.installPackage('git+https://github.com/CensoredUsername/unrpyc.git');
    }

    this.initialized = true;
  }

  async detectRpycRuntime(filePath) {
    await this.init();
    const resolved = path.resolve(filePath);

    const pythonScript = `
import sys, os, zlib, struct, json
from pathlib import Path
import unrpyc
from unrpyc import pickle_safe_loads

p = Path('${escapePyString(resolved)}')
raw = p.read_bytes()

fmt = 'UNKNOWN'
py_major = 0
renpy_major = 'unknown'
proto = -1
confidence = 'low'
chunks = 0
script_version = None
has_init_offset = False
stmts_count = 0
build_info = None

def inspect_ast(data):
    global has_init_offset, script_version, stmts_count
    try:
        meta, stmts = pickle_safe_loads(data)
        stmts_count = len(stmts) if hasattr(stmts, '__len__') else 0
        if isinstance(meta, dict):
            script_version = meta.get('version')
            global build_info
            meta_build = meta.get('build')
            if isinstance(meta_build, bytes):
                try:
                    build_info = meta_build.decode()
                except Exception:
                    build_info = repr(meta_build)
            elif isinstance(meta_build, str):
                build_info = meta_build
        for stmt in stmts[:128]:
            offset = getattr(stmt, 'init_offset', None)
            if offset not in (None, 0):
                has_init_offset = True
                break
    except Exception:
        pass

if raw.startswith(b'RENPY RPC2'):
    fmt = 'RPC2'
    pos = 10
    blob = None
    try:
        while pos + 12 <= len(raw):
            slot, start, length = struct.unpack('<III', raw[pos:pos+12])
            pos += 12
            if slot == 0:
                break
            chunks += 1
            if slot == 1:
                blob = raw[start:start+length]
                break
    except Exception:
        blob = None
    if blob is not None:
        try:
            data = zlib.decompress(blob)
            if len(data) >= 2 and data[0] == 0x80:
                proto = data[1]
            if hasattr(unrpyc, 'pickle_detect_python2'):
                py2 = unrpyc.pickle_detect_python2(data)
            else:
                py2 = proto <= 2 and proto >= 0
            inspect_ast(data)
            if py2 is True:
                py_major = 2
                renpy_major = 7
                confidence = 'high'
            elif py2 is False:
                py_major = 3
                renpy_major = 8
                confidence = 'high'
            else:
                if proto >= 3:
                    py_major = 3
                    renpy_major = 8
                    confidence = 'medium'
                else:
                    py_major = 2
                    renpy_major = 7
                    confidence = 'medium'
        except Exception:
            py_major = 2
            renpy_major = 7
            confidence = 'low'
    else:
        py_major = 2
        renpy_major = 7
        confidence = 'low'
else:
    try:
        data = zlib.decompress(raw)
        inspect_ast(data)
        fmt = 'RPC1'
        py_major = 2
        renpy_major = 6
        confidence = 'high'
        if len(data) >= 2 and data[0] == 0x80:
            proto = data[1]
    except Exception:
        if raw.startswith(b'RENPY'):
            fmt = 'RPC2'
            py_major = 2
            renpy_major = 7
            confidence = 'low'

print(json.dumps({
    'FMT': fmt,
    'PY': py_major,
    'RENPY': renpy_major,
    'PROTO': proto,
    'CONF': confidence,
    'CHUNKS': chunks,
    'SV': script_version,
    'IOFF': has_init_offset,
    'STMT': stmts_count,
    'BUILD': build_info,
}))
`;

    const result = await this.pyRunner.runCode(pythonScript);

    if (this.debug) {
      const stdout = (result.stdout || '').trim();
      const stderr = (result.stderr || '').trim();
      console.log('[detectRpycRuntime] stdout:', stdout);
      if (stderr) console.warn('[detectRpycRuntime] stderr:', stderr);
    }

    let info;
    try {
      info = JSON.parse(result.stdout || '{}');
    } catch {
      info = null;
    }

    if (!info) {
      return {
        format: 'UNKNOWN',
        pythonMajor: 0,
        renpyMajor: 'unknown',
        pickleProtocol: -1,
        confidence: 'low',
        chunks: 0,
        scriptVersion: null,
        hasInitOffset: false,
        stmtsCount: 0,
      };
    }

    const format = info.FMT === 'RPC1' || info.FMT === 'RPC2' ? info.FMT : (info.FMT || 'UNKNOWN');
    const pythonMajor = Number(info.PY) || 0;

    let renpyMajor = 'unknown';
    if (typeof info.RENPY === 'number' && Number.isFinite(info.RENPY)) {
      renpyMajor = info.RENPY;
    } else if (typeof info.RENPY === 'string' && info.RENPY !== 'unknown') {
      const parsed = Number(info.RENPY);
      if (!Number.isNaN(parsed)) renpyMajor = parsed;
    }

    const pickleProtocol = Number(info.PROTO);
    const chunks = Number(info.CHUNKS) || 0;
    const scriptVersion = typeof info.SV === 'number'
      ? info.SV
      : (typeof info.SV === 'string' && info.SV && !Number.isNaN(Number(info.SV))
        ? Number(info.SV)
        : null);
    const hasInitOffset = info.IOFF === true || info.IOFF === 'True';
    const stmtsCount = Number(info.STMT) || 0;
    const build = typeof info.BUILD === 'string' && info.BUILD.length > 0 ? info.BUILD : null;

    return {
      format,
      pythonMajor,
      renpyMajor,
      pickleProtocol: Number.isFinite(pickleProtocol) ? pickleProtocol : -1,
      confidence: info.CONF || 'low',
      chunks,
      scriptVersion,
      hasInitOffset,
      stmtsCount,
      build,
    };
  }

  async decompileFile(inputPath, options = {}) {
    await this.init();
    const resolvedInput = path.resolve(inputPath);
    const outputDir = path.resolve(options.outputDir ?? this.outputDir);
    await fs.mkdir(outputDir, { recursive: true });

    const overwrite = options.overwrite ?? this.overwrite;
    const tryHarder = options.tryHarder ?? this.tryHarder;
    const dump = Boolean(options.dump);
    const noPyExpr = Boolean(options.noPyExpr);
    const comparable = Boolean(options.comparable);

    const pythonScript = `
import json, shutil
from pathlib import Path
from unrpyc import decompile_rpyc, Context

input_path = Path('${escapePyString(resolvedInput)}')
output_dir = Path('${escapePyString(outputDir)}')
output_dir.mkdir(parents=True, exist_ok=True)

working_input = input_path
copied = False
if input_path.parent != output_dir:
    working_input = output_dir / input_path.name
    shutil.copy2(input_path, working_input)
    copied = True

ctx = Context()
status = 'ok'
error = None
output_path = ''
try:
    decompile_rpyc(
        working_input,
        ctx,
        overwrite=${overwrite ? 'True' : 'False'},
        try_harder=${tryHarder ? 'True' : 'False'},
        dump=${dump ? 'True' : 'False'},
        comparable=${comparable ? 'True' : 'False'},
        no_pyexpr=${noPyExpr ? 'True' : 'False'}
    )
    status = ctx.state
    candidate = working_input.with_suffix('.rpy' if working_input.suffix in ('.rpyc', '.rpymc') else working_input.suffix)
    if candidate.exists():
        output_path = str(candidate.resolve())
    elif working_input.with_suffix('.rpy').exists():
        output_path = str(working_input.with_suffix('.rpy').resolve())
except Exception as exc:
    status = 'error'
    error = str(exc)
    if ctx.error:
        error = str(ctx.error)

print(json.dumps({
    'status': status,
    'state': ctx.state,
    'log': ctx.log_contents,
    'error': error,
    'output': output_path,
    'working': str(working_input.resolve()),
    'copied': copied,
}))
`;

    const result = await this.pyRunner.runCode(pythonScript);

    if (this.debug || options.debug) {
      const stdout = (result.stdout || '').trim();
      const stderr = (result.stderr || '').trim();
      console.log('[decompileFile] stdout:', stdout);
      if (stderr) console.warn('[decompileFile] stderr:', stderr);
    }

    let info;
    try {
      info = JSON.parse(result.stdout || '{}');
    } catch {
      info = null;
    }

    if (!info) {
      return { success: false, error: result.stderr || 'unrpyc did not return JSON' };
    }

    const success = info.state === 'ok' || info.state === 'skip';
    return {
      success,
      state: info.state,
      log: info.log || [],
      error: info.error || null,
      outputPath: info.output || null,
      workingInput: info.working,
      copied: Boolean(info.copied),
    };
  }

  async decompileDirectory(inputDir, options = {}) {
    const recursive = options.recursive ?? true;
    const outputDir = path.resolve(options.outputDir ?? this.outputDir);
    await fs.mkdir(outputDir, { recursive: true });

    const files = await listRpycFiles(path.resolve(inputDir), recursive);
    const results = [];
    for (const file of files) {
      const res = await this.decompileFile(file, { ...options, outputDir });
      results.push({ file, ...res });
    }

    const summary = {
      success: results.filter((r) => r.success && r.state !== 'skip').length,
      failed: results.filter((r) => !r.success && r.state !== 'skip').length,
      skipped: results.filter((r) => r.state === 'skip').length,
      errors: results.filter((r) => !r.success).map((r) => ({ file: r.file, error: r.error })),
      results,
    };

    return summary;
  }

  async isValidRpycFile(filePath) {
    const info = await this.detectRpycRuntime(filePath);
    return info.format === 'RPC1' || info.format === 'RPC2';
  }

  async getVersion() {
    await this.init();
    const result = await this.pyRunner.runCode('import unrpyc; print(getattr(unrpyc, "__version__", "unknown"))');
    return (result.stdout || '').trim();
  }
}

export default UnrpycJS;
export { UnrpycJS };
