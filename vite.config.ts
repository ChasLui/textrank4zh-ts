import { defineConfig } from 'vite';
import dts from 'unplugin-dts/vite';

// 两个 Worker 必须各自独立构建：合并成多 entry 会因共享 src/core 被抽出 shared chunk，
// 而 Worker 产物要求单文件可直接复制使用
const WORKERS = {
  worker: { entry: 'src/worker/textrank.worker.ts', file: 'index.worker.js' },
  sharedworker: { entry: 'src/worker/textrank.sharedworker.ts', file: 'index.sharedworker.js' },
} as const;

export default defineConfig(({ mode }) => {
  const target = WORKERS[mode as keyof typeof WORKERS];

  if (target) {
    return {
      build: {
        emptyOutDir: false, // 主构建已清过 dist，这里再清会删掉前面的产物
        target: 'es2020',
        minify: false,
        lib: { entry: target.entry, formats: ['es'] as const },
        rolldownOptions: {
          output: {
            entryFileNames: target.file,
            codeSplitting: false, // 单文件输出，替代已废弃的 inlineDynamicImports
          },
        },
      },
    };
  }

  return {
    plugins: [
      dts({
        // TypeScript 7 的 lib/ 目录不含 lib.*.d.ts。不置空的话 unplugin-dts 会把
        // typescriptCompilerFolder 指向 typescript@7 的空壳 lib 目录，导致 api-extractor
        // 解析不到全局 Error/Promise，报 "Unable to follow symbol for Error"。
        // 置为 undefined 后回落到 api-extractor 自带的 typescript@5.9.3 lib。
        bundleTypes: { invokeOptions: { typescriptCompilerFolder: undefined } },
      }),
    ],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      // Vite 8 默认 target 已提升到 Chrome 111，显式锁回 es2020 以保持 README 承诺的浏览器兼容范围
      target: 'es2020',
      minify: false, // 对齐原 unbuild 行为：产物不压缩
      lib: {
        entry: 'src/index.ts',
        name: 'TextRank4ZH',
        formats: ['es', 'cjs', 'iife'] as const,
        // 函数形式的返回值被原样使用（含扩展名）；"type":"module" 下不写会得到 index.js 而非 index.mjs
        fileName: (format) =>
          format === 'es' ? 'index.mjs' : format === 'cjs' ? 'index.cjs' : 'index.iife.js',
      },
      rolldownOptions: {
        output: { exports: 'named' },
        // 不设 external：本库无运行时依赖，全部代码打进产物
      },
    },
  };
});
