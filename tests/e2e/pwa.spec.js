/**
 * Installable app: manifest, service worker, head tags, link previews.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'PWA and previews', () => {
	test( 'manifest.json is written to the site root and names the site', async ( {
		request,
	} ) => {
		const res = await request.get( '/manifest.json' );
		expect( res.ok() ).toBeTruthy();
		const manifest = await res.json();
		expect( manifest.display ).toBe( 'standalone' );
		expect( manifest.start_url ).toBe( '/' );
		expect( manifest.icons.length ).toBeGreaterThanOrEqual( 2 );
		expect( manifest.id ).toBe( '/' );
		expect( manifest.shortcuts[ 0 ].name ).toBe( 'Demo Set' );
		expect( manifest.launch_handler.client_mode ).toBe(
			'navigate-existing'
		);
		expect( manifest.short_name.length ).toBeLessThanOrEqual( 12 );
	} );

	test( 'service worker is served from the root with push handlers', async ( {
		request,
	} ) => {
		const res = await request.get( '/sw.js' );
		expect( res.ok() ).toBeTruthy();
		const body = await res.text();
		expect( body ).toMatch( /addEventListener\(\s*'push'/ );
		expect( body ).toMatch( /addEventListener\(\s*'fetch'/ );
		expect( body ).toContain( 'navigationPreload' );
		expect( body ).toMatch( /const ASSETS = \[.*\/manifest\.json.*\]/ ); // shell precache, versioned
		expect( body ).toContain( 'd.notification' ); // declarative Web Push payloads
	} );

	test( 'head carries app meta and Open Graph tags per view', async ( {
		page,
	} ) => {
		await page.goto( '/demo-set/' );
		await expect( page.locator( 'link[rel=manifest]' ) ).toHaveAttribute(
			'href',
			/manifest\.json$/
		);
		await expect(
			page.locator( 'link[rel=apple-touch-icon]' )
		).toHaveCount( 1 );
		expect(
			await page.locator( 'link[rel=apple-touch-startup-image]' ).count()
		).toBeGreaterThanOrEqual( 10 );
		await expect(
			page.locator( 'meta[property="og:title"]' )
		).toHaveAttribute( 'content', 'Demo Set' );
		await expect(
			page.locator( 'meta[property="og:image"]' )
		).toHaveAttribute( 'content', /\.png/ );
		await expect( page.locator( 'meta[name=viewport]' ) ).toHaveAttribute(
			'content',
			/viewport-fit=cover/
		);
	} );
} );
