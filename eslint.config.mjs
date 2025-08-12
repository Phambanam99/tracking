// eslint.config.js (flat config)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
// (tuỳ chọn) tắt các rule xung đột với Prettier
// import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // Bỏ qua thư mục build, vendor
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  // Khuyến nghị cho JS và TS
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // eslintConfigPrettier, // bật nếu muốn tắt toàn bộ rule xung đột với Prettier

  // Quy tắc áp cho TS (bạn có thể đổi files thành `**/*.{ts,js}` nếu muốn áp cả JS)
  {
    files: ['**/*.ts'],
    plugins: { prettier },
    rules: {
      // Truyền options Prettier ở đây, gồm endOfLine: 'lf'
      'prettier/prettier': ['error', { endOfLine: 'lf' }],

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
];
