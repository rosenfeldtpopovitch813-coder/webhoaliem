import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

function lucideDirectImports() {
  const iconMap = new Map<string, string>();
  try {
    const entry = path.resolve(__dirname, '../node_modules/lucide-react/dist/esm/lucide-react.js');
    const src = fs.readFileSync(entry, 'utf8');
    const lineRe = /^export\s+\{([^}]+)\}\s+from\s+'(\.\/icons\/[^']+)';/gm;
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(src))) {
      const rel = m[2].slice(2);
      for (const spec of m[1].split(',')) {
        const asM = /default\s+as\s+([A-Za-z0-9_]+)/.exec(spec);
        if (asM) iconMap.set(asM[1], `lucide-react/dist/esm/${rel}`);
      }
    }
  } catch {
    /* fallback to default barrel */
  }
  return {
    name: 'lucide-direct-imports',
    transform(code: string, id: string) {
      if (!iconMap.size || !/\.[jt]sx?$/.test(id) || id.includes('node_modules') || !code.includes('lucide-react')) {
        return null;
      }
      let changed = false;
      const out = code.replace(
        /import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"]\s*;?/g,
        (full, specBlock) => {
          const lines: string[] = [];
          const fallback: string[] = [];
          for (const raw of String(specBlock).split(',')) {
            const s = raw.trim();
            if (!s) continue;
            const parts = s.split(/\s+as\s+/);
            const imported = parts[0].trim();
            const local = (parts[1] || imported).trim();
            const target = iconMap.get(imported);
            if (target) lines.push(`import ${local} from '${target}';`);
            else fallback.push(s);
          }
          if (!lines.length) return full;
          changed = true;
          if (fallback.length) lines.push(`import { ${fallback.join(', ')} } from 'lucide-react';`);
          return lines.join('\n');
        }
      );
      return changed ? { code: out, map: null } : null;
    },
  };
}

// Build the full Lớp học Mực renderer as a same-origin sub-application.
// Keep the existing HTVVM dist output; this config writes only to dist/focus-notes.
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  plugins: [lucideDirectImports()],
  publicDir: 'public',
  build: {
    outDir: '../dist/focus-notes',
    emptyOutDir: false,
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: { maxParallelFileOps: 2 }
  },
});
