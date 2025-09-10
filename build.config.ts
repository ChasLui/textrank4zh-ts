import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig([
  // 主库构建 - 支持多种格式
  {
    entries: ['src/index'],
    declaration: true,
    clean: true,
    rollup: {
      emitCJS: true,
      inlineDependencies: true,
    },
    externals: [],
  },

  // IIFE 格式构建 - 用于浏览器直接引入
  {
    entries: [
      {
        input: 'src/index',
        outDir: 'dist',
        name: 'index.iife',
        format: 'iife',
      },
    ],
    declaration: false,
    clean: false,
    rollup: {
      inlineDependencies: true,
      external: [],
      output: {
        name: 'TextRank4ZH', // 全局变量名
        format: 'iife',
        exports: 'named', // 避免默认导出警告
        entryFileNames: '[name].js',
      },
    },
    externals: [],
  },

  // DedicatedWorker 构建 - 独立文件，便于复制使用
  {
    entries: ['src/worker/textrank.worker'],
    outDir: 'dist/',
    declaration: false,
    clean: false,
    rollup: {
      inlineDependencies: true,
      external: [],
      output: {
        format: 'esm',
        entryFileNames: 'index.worker.js',
        chunkFileNames: '[name].js', // 避免生成额外的 chunk 文件
      },
    },
    externals: [],
  },

  // SharedWorker 构建 - 独立文件，便于复制使用
  {
    entries: ['src/worker/textrank.sharedworker'],
    outDir: 'dist/',
    declaration: false,
    clean: false,
    rollup: {
      inlineDependencies: true,
      external: [],
      output: {
        format: 'esm',
        entryFileNames: 'index.sharedworker.js', // 输出为 textrank-sharedworker.js
        chunkFileNames: '[name].js', // 避免生成额外的 chunk 文件
      },
    },
    externals: [],
  },
]);
