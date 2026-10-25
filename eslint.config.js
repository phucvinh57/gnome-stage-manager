export default [{
    ignores: ['dist/**', 'node_modules/**'],
}, {
    files: ['**/*.js'],
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {global: 'readonly', console: 'readonly', log: 'readonly', logError: 'readonly'},
    },
    rules: {
        'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_'}],
        'no-undef': 'error',
        'no-unreachable': 'error',
        'no-constant-condition': 'error',
        'eqeqeq': ['error', 'always', {null: 'ignore'}],
    },
}];
