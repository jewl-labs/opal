import next from 'eslint-config-next';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import typescriptEslint from '@typescript-eslint/eslint-plugin';

const eslintConfig = [
  ...next,
  {
    name: 'next/core-web-vitals',
    rules: nextPlugin.configs['core-web-vitals'].rules,
  },
  prettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
];

export default eslintConfig;
