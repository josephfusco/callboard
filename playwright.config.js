/**
 * Playwright config: WordPress defaults, iPhone viewport for the front end.
 */
const { defineConfig, devices } = require( '@playwright/test' );
const base = require( '@wordpress/scripts/config/playwright.config.js' );

module.exports = defineConfig( {
	...base,
	testDir: './tests/e2e',
	reporter: process.env.CI ? [ [ 'github' ], [ 'list' ] ] : 'list',
	projects: [
		{ name: 'chromium', use: { ...base.use } },
		{
			name: 'iphone',
			use: {
				...base.use,
				...devices[ 'iPhone 14' ],
				defaultBrowserType: 'chromium',
			},
			testMatch: /front\.spec\.js/,
		},
	],
} );
