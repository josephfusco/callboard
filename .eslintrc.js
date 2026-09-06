module.exports = {
	extends: [ 'plugin:@wordpress/eslint-plugin/recommended-with-formatting' ],
	env: { browser: true, serviceworker: true },
	globals: { CALLBOARD: 'readonly' },
	rules: {
		'no-empty': [ 'error', { allowEmptyCatch: true } ],
		'@wordpress/no-global-active-element': 'off',
		'@wordpress/no-unused-vars-before-return': 'off', // a group of element lookups at the top of a function reads better together
		'no-mixed-operators': 'off', // arithmetic in the animations is clearer without a forest of parentheses
		'no-mixed-spaces-and-tabs': 'off', // Prettier's continuation-line alignment
		indent: 'off', // Prettier (wp-scripts format) owns indentation; the indent rule disagrees with it on continuation lines
		'no-nested-ternary': 'off',
		'no-bitwise': 'off',
		'no-unused-expressions': [ 'error', { allowTernary: true } ],
	},
};
