/**@type {import('eslint').Linter.Config} */
// eslint-disable-next-line no-undef
module.exports = {
    root: true,
    // parser: '@typescript-eslint/parser',
    parser: 'vue-eslint-parser',
    plugins: [
        '@typescript-eslint',
        'vue'
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:vue/vue3-recommended'
    ],
    rules: {
        'semi': [2, "always"],
        '@typescript-eslint/no-unused-vars': 0,
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0,
        '@typescript-eslint/no-non-null-assertion': 0,
    },
    globals: {
        window: true,
        document: true,
        Vue: true,
        console: true
    }
};
