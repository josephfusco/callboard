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
		// Not shortcuts[ 0 ]: a local-only set can sort ahead of the fixtures on this machine.
		expect( manifest.shortcuts.map( ( s ) => s.name ) ).toContain(
			'Shakespeare’s Sonnets'
		);
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
		expect( body ).toMatch(
			/addEventListener\(\s*'pushsubscriptionchange'/
		);
		expect( body ).toMatch(
			/const PUSH_API = '[^']*callboard\/v1\/push\/'/
		); // the worker knows where to re-register
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
		).toHaveAttribute( 'content', 'Shakespeare’s Sonnets' );
		await expect(
			page.locator( 'meta[property="og:image"]' )
		).toHaveAttribute( 'content', /\.png/ );
		await expect( page.locator( 'meta[name=viewport]' ) ).toHaveAttribute(
			'content',
			/viewport-fit=cover/
		);
	} );

	test( 'a saved set opens and plays with the network off', async ( {
		page,
		context,
	} ) => {
		await page.goto( '/demo-set/' );
		// the worker registers at idle and controls the page after a reload
		await page
			.waitForFunction( () => navigator.serviceWorker?.controller, null, {
				timeout: 15000,
			} )
			.catch( async () => {
				await page.reload();
				await page.waitForFunction(
					() => navigator.serviceWorker?.controller,
					null,
					{ timeout: 15000 }
				);
			} );
		// The save controls bind a beat after the view does and only then read the cache; the button
		// wears data-some once it has, which is the first moment a tap on it means anything.
		await expect( page.locator( '#offline[data-some]' ) ).toBeAttached( {
			timeout: 15000,
		} );
		await page.locator( '#offline' ).click();
		await expect( page.locator( '#offline' ) ).toContainText(
			/Saved offline/,
			{ timeout: 30000 }
		);
		// A saved set warms its own page into the worker's cache, and nothing waits for that write:
		// the page fires the fetch without awaiting it and the worker stores the answer outside
		// waitUntil. Wait for the copy to exist, because going dark without it leaves nothing to open.
		// Polled through evaluate, which awaits: waitForFunction takes the returned promise itself as
		// truthy and would move on at once.
		await expect
			.poll(
				() =>
					page.evaluate( async () =>
						Boolean( await caches.match( '/demo-set/?fragment=1' ) )
					),
				{ timeout: 30000 }
			)
			.toBe( true );

		await context.setOffline( true );
		await page.goto( '/' ); // home, from the precached shell
		const set = page.locator( 'a.set', {
			hasText: 'Shakespeare’s Sonnets',
		} );
		await expect( set ).toBeVisible();
		await set.click(); // the set, from its cached fragment
		await expect( page ).toHaveURL( /\/demo-set\/$/ );
		await expect( page.locator( '.track' ) ).toHaveCount( 10 );
		await page.locator( '.track' ).first().click();
		await page.waitForFunction(
			() => {
				const a = document.getElementById( 'audio' );
				return a.error || a.readyState >= 1;
			},
			null,
			{ timeout: 15000 }
		);
		const audio = await page.evaluate( () => {
			const a = document.getElementById( 'audio' );
			return {
				error: a.error ? a.error.code : null,
				readyState: a.readyState,
			};
		} );
		expect( audio.error ).toBeNull();
		expect( audio.readyState ).toBeGreaterThanOrEqual( 1 ); // metadata arrived from the cache
		await context.setOffline( false );

		// Leave no copies behind: press and hold asks, the next tap removes. The view arrived as a
		// swapped-in fragment, so this button and every row control are new elements waiting to be
		// bound; a hold on an unbound button asks nothing, and the tap after it reads as a plain tap
		// on a set that is already saved, which is meant to do nothing at all.
		await expect( page.locator( '#offline' ) ).toHaveAttribute(
			'data-some',
			'1',
			{ timeout: 15000 }
		);
		await page.locator( '#offline' ).hover();
		await page.mouse.down();
		// Hold until the button has asked rather than for a moment that is usually long enough.
		await expect( page.locator( '#offline' ) ).toHaveAttribute(
			'data-confirm',
			'1',
			{ timeout: 15000 }
		);
		await page.mouse.up();
		await expect( page.locator( '#offline' ) ).toContainText( /Tap again/ );
		await page.locator( '#offline' ).click();
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			0
		);
	} );
} );
