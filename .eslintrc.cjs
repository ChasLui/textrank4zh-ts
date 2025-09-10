module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
  ],
  rules: {
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-vars': 'off', // 由于TypeScript会检查这个
  },
  env: {
    node: true,
    es6: true,
    jest: true,
    browser: true,
    worker: true,
  },
  globals: {
    Worker: 'readonly',
    SharedWorker: 'readonly',
    MessagePort: 'readonly',
    MessageChannel: 'readonly',
    MessageEvent: 'readonly',
    ErrorEvent: 'readonly',
    Event: 'readonly',
    EventListener: 'readonly',
    DedicatedWorkerGlobalScope: 'readonly',
    SharedWorkerGlobalScope: 'readonly',
    Transferable: 'readonly',
    ArrayBuffer: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    AbortController: 'readonly',
    AbortSignal: 'readonly',
    IdleDeadline: 'readonly',
    NodeJS: 'readonly'
  },
};