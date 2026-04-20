// Replacement for zlibjs/bin/gunzip.min.js used by kuromoji's BrowserDictionaryLoader.
// zlibjs is a 2012-era IIFE that assigns to `this.Zlib` — when bundled by Vite/esbuild
// `this` is no longer window, so Zlib is never exported and kuromoji crashes on iOS.
// pako is a modern, correctly-packaged gzip implementation that works everywhere.
import { ungzip } from 'pako';

class Gunzip {
  constructor(data) {
    this._data = data;
  }
  decompress() {
    return ungzip(this._data);
  }
}

export const Zlib = { Gunzip };
