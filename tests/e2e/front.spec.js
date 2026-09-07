/**
 * Front end: home, a set, the player, in-place navigation. Runs on desktop and an iPhone viewport.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'Front end', () => {
	test( 'home lists sets with counts and the footer note', async ( {
		page,
	} ) => {
		await page.goto( '/' );
		await expect( page ).toHaveTitle( /./ );
		await expect( page.locator( 'a.set' ) ).toHaveCount( 4 );
		const card = page.locator( 'a.set' ).first();
		await expect( card ).toBeVisible();
		await expect( card.locator( '.set-name' ) ).toHaveText( 'Demo Set' );
		await expect( card.locator( '.set-meta' ) ).toContainText(
			'10 tracks'
		);
		await expect( page.locator( 'footer.colophon' ) ).toContainText(
			'For rehearsal use only.'
		);
		await expect( page.locator( '#deck' ) ).toBeHidden();
		await expect( page.locator( '#wpadminbar' ) ).toHaveCount( 0 ); // even logged in, no admin bar on the app
	} );

	test( 'a long set scrolls and keeps the deck pinned', async ( {
		page,
	} ) => {
		await page.goto( '/long-set/' );
		await expect( page.locator( '.track' ) ).toHaveCount( 24 );
		await page.locator( '.track' ).nth( 20 ).click();
		await expect( page.locator( '#deck' ) ).toBeVisible();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Underscore A'
		);
		await page.locator( '.track' ).nth( 20 ).scrollIntoViewIfNeeded();
		const deckBox = await page.locator( '#deck' ).boundingBox();
		const viewport = page.viewportSize();
		expect( deckBox.y + deckBox.height ).toBeGreaterThanOrEqual(
			viewport.height - 130
		); // pinned to the bottom edge
	} );

	test( 'saving a set offline marks every track, including slashed titles', async ( {
		page,
	} ) => {
		await page.goto( '/long-set/' );
		await page.waitForTimeout( 900 );
		await page.locator( '#offline' ).click();
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			24,
			{
				timeout: 30000,
			}
		);
		await expect( page.locator( '#offline' ) ).toContainText(
			/Saved offline/
		);
		await page.reload();
		await page.waitForTimeout( 1200 );
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			24
		);
		await page.locator( '.back' ).click(); // home shows the same mark on the set
		await expect(
			page.locator( '.set-off[data-slug="long-set"]' )
		).toHaveAttribute( 'data-state', 'saved' );
		await page.goBack();
		await page.locator( '#offline' ).click(); // a plain tap does nothing
		await expect( page.locator( '#offline' ) ).toHaveText(
			'Saved offline'
		);
		await page.locator( '#offline' ).hover(); // press and hold asks; releasing is not the answer
		await page.mouse.down();
		await page.waitForTimeout( 900 );
		await page.mouse.up();
		await expect( page.locator( '#offline' ) ).toContainText( /Tap again/ );
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			24
		);
		await page.locator( '#offline' ).click();
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			0
		);
	} );

	test( 'a set shows its tracks, credits and no personal chrome', async ( {
		page,
	} ) => {
		await page.goto( '/demo-set/' );
		await expect( page.locator( 'h1' ) ).toHaveText( 'Demo Set' );
		await expect( page.locator( '.track' ) ).toHaveCount( 10 );
		await expect(
			page.locator( '.track' ).first().locator( '.title' )
		).toHaveText( 'Sawtooth, steady' ); // "1. … (Demo OBC)" cleaned on import
		await expect( page.locator( 'footer.colophon' ) ).toContainText(
			'Audio by Demo Uploader'
		);
		await expect(
			page.locator( 'footer.colophon a' ).first()
		).toHaveAttribute( 'rel', /noreferrer/ );
		await expect( page.locator( 'link[rel=stylesheet]' ) ).toHaveCount( 0 ); // styles are inlined, nothing leaks from the theme
	} );

	test( 'tapping a track loads it into the persistent player', async ( {
		page,
	} ) => {
		await page.goto( '/demo-set/' );
		await page.locator( '.track' ).nth( 1 ).click();
		const audio = page.locator( '#audio' );
		await expect( audio ).toHaveAttribute( 'src', /Tremolo/ );
		await expect( page.locator( '.track' ).nth( 1 ) ).toHaveClass(
			/active/
		);
		await expect( page.locator( '.track' ).nth( 1 ) ).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Tremolo, 4 Hz'
		);
		await expect( page.locator( '#deck' ) ).toBeVisible();
	} );

	test( "Play all becomes the set's transport once it is playing", async ( {
		page,
	} ) => {
		await page.goto( '/demo-set/' );
		const btn = page.locator( '#play-all' );
		await expect( btn ).toHaveText( 'Play all' );
		await btn.click();
		await expect( btn ).not.toHaveText( 'Play all' );
		await page.evaluate( () => document.getElementById( 'audio' ).pause() );
		await expect( btn ).toHaveText( 'Play' );
		await expect( page.locator( '.track' ).first() ).toHaveClass(
			/active/
		);
	} );

	test( 'ticks and note pins mark the seek line; a pin jumps there', async ( {
		page,
	} ) => {
		await page.goto( '/long-set/' );
		await page.locator( '.track' ).first().click();
		await expect( page.locator( '#seek-marks .tick' ) ).toHaveCount( 3 ); // one rest in the lyrics, two notes
		await expect( page.locator( '#seek-marks .pin' ) ).toHaveCount( 2 );
		await page.locator( '#seek-marks .pin' ).first().click();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Softer here'
		);
		await expect( page.locator( '#now-title' ) ).toContainText( 'Sep 1' );
		await page.locator( '#open-lyrics' ).click();
		await expect(
			page.locator( '#lyrics-lines li' ).first()
		).toContainText( 'Curtain up' );
	} );

	test( 'an A-B loop from the keyboard shows a chip and clears', async ( {
		page,
	} ) => {
		await page.goto( '/long-set/' );
		await page.locator( '.track' ).first().click();
		await page.evaluate( () => {
			document.getElementById( 'audio' ).currentTime = 2;
		} );
		await page.keyboard.press( '[' );
		await page.evaluate( () => {
			document.getElementById( 'audio' ).currentTime = 6;
		} );
		await page.keyboard.press( ']' );
		await expect( page.locator( '#loop' ) ).toHaveText( /Loop 0:02–0:06/ );
		await expect( page.locator( '#loop-band' ) ).toHaveClass( /on/ );
		await page.locator( '#loop' ).click();
		await expect( page.locator( '#loop' ) ).toHaveText( 'Loop' );
		// and from the control alone: start, end, clear
		await page.locator( '#loop' ).click();
		await expect( page.locator( '#loop' ) ).toHaveText( /Loop from 0:0\d/ );
		await page.evaluate( () => {
			document.getElementById( 'audio' ).currentTime = 8;
		} );
		await page.locator( '#loop' ).click();
		await expect( page.locator( '#loop' ) ).toHaveText( /Loop 0:0\d–0:08/ );
		await page.locator( '#loop' ).click();
		await expect( page.locator( '#loop' ) ).toHaveText( 'Loop' );
	} );

	test( 'a track with a tempo counts in before it plays', async ( {
		page,
	} ) => {
		await page.goto( '/long-set/' );
		await expect( page.locator( '.track .bpm' ) ).toHaveText( '♩ 120' );
		await page.locator( '.track' ).nth( 2 ).click(); // The Wish, 120 BPM
		await expect( page.locator( '#deck' ) ).toHaveClass( /counting/ );
		await expect( page.locator( '#now-title' ) ).toHaveText(
			/^1(\s+[2-4])*$/
		);
		await expect( page.locator( '#deck' ) ).not.toHaveClass( /counting/, {
			timeout: 4000,
		} );
		await expect( page.locator( '#now-title' ) ).toContainText(
			'The Wish'
		);
	} );

	test( 'a long title scrolls in the deck instead of truncating', async ( {
		page,
	}, testInfo ) => {
		test.skip( testInfo.project.name !== 'iphone', 'phone width only' );
		await page.goto( '/one-track/' );
		await page.locator( '.track' ).first().click();
		await expect( page.locator( '#now-title' ) ).toHaveClass( /marquee/ );
		await expect( page.locator( '#now-title .mq span' ) ).toHaveCount( 2 );
	} );

	test( 'Share hands the set link to the system sheet', async ( {
		page,
	} ) => {
		await page.addInitScript( () => {
			window.__shared = [];
			navigator.share = ( d ) => {
				window.__shared.push( d );
				return Promise.resolve();
			};
		} );
		await page.goto( '/demo-set/' );
		const btn = page.locator( '#share' );
		await expect( btn ).toBeVisible();
		await btn.click();
		const shared = await page.evaluate( () => window.__shared );
		expect( shared ).toHaveLength( 1 );
		expect( shared[ 0 ].url ).toMatch( /\/demo-set\/$/ );
		expect( shared[ 0 ].title ).toContain( 'Demo Set' );
		expect( shared[ 0 ].text ).toContain( '10 tracks' );
	} );

	test( 'without a share sheet, Share copies the link', async ( {
		page,
	} ) => {
		await page.addInitScript( () => {
			Object.defineProperty( navigator, 'share', {
				value: undefined,
				configurable: true,
			} );
			window.__copied = '';
			navigator.clipboard.writeText = ( t ) => {
				window.__copied = t;
				return Promise.resolve();
			};
		} );
		await page.goto( '/demo-set/' );
		const btn = page.locator( '#share' );
		await btn.click();
		await expect( btn ).toHaveText( 'Link copied' );
		expect( await page.evaluate( () => window.__copied ) ).toMatch(
			/\/demo-set\/$/
		);
		await expect( btn ).toHaveText( 'Share', { timeout: 3000 } );
	} );

	test( 'an empty set says so on home and on its page', async ( {
		page,
	} ) => {
		await page.goto( '/' );
		await expect(
			page
				.locator( 'a.set', { hasText: 'Empty Set' } )
				.locator( '.set-meta' )
		).toHaveText( 'No audio yet' );
		await page.goto( '/empty-set/' );
		await expect( page.locator( '.note' ) ).toContainText(
			'No audio in this set yet'
		);
		await expect( page.locator( '#play-all' ) ).toHaveCount( 0 );
	} );

	test( 'the server and client renderers produce the same markup', async ( {
		page,
	} ) => {
		// state the player paints after load is not part of the comparison
		const tidy = ( html ) =>
			html
				.replace( />\s+</g, '><' )
				.replace( /\s+/g, ' ' )
				.replace(
					/ (hidden|disabled|aria-current|aria-label|aria-pressed|data-state|style)(="[^"]*")?/g,
					''
				)
				.replace(
					/ class="([^"]*)"/g,
					( m, c ) =>
						` class="${ c
							.replace(
								/\b(active|playing|is-done|is-busy|is-playing)\b/g,
								''
							)
							.trim() }"`
				)
				.trim();
		for ( const path of [ '/long-set/', '/', '/empty-set/' ] ) {
			await page.goto( path );
			await page.waitForTimeout( 900 );
			const server = tidy(
				await page.locator( '#main' ).evaluate( ( el ) => el.outerHTML )
			);
			await page.locator( '.back, a.set' ).first().click(); // leave, then come back through the client renderer
			await page.goBack();
			await expect( page ).toHaveURL( new RegExp( `${ path }$` ) );
			await page.waitForTimeout( 900 );
			const client = tidy(
				await page.locator( '#main' ).evaluate( ( el ) => el.outerHTML )
			);
			expect( client ).toBe( server );
		}
	} );

	test( 'All sets swaps views in place and keeps the player', async ( {
		page,
	} ) => {
		await page.goto( '/demo-set/' );
		await page.locator( '.track' ).first().click();
		await page.locator( 'a.back' ).click();
		await expect( page ).toHaveURL( /\/$/ );
		await expect( page.locator( 'a.set' ).first() ).toBeVisible();
		await expect( page.locator( '#deck' ) ).toBeVisible();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Sawtooth, steady'
		);
		await page.goBack();
		await expect( page.locator( 'h1' ) ).toHaveText( 'Demo Set' );
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Sawtooth, steady'
		); // no reload
	} );

	test( 'unknown paths fall back to home with a note and a 404 status', async ( {
		page,
	} ) => {
		const response = await page.goto( '/nope/' );
		expect( response.status() ).toBe( 404 );
		await expect( page.locator( '.note-404' ) ).toContainText(
			"isn't here"
		);
	} );
} );
