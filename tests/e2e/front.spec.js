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
		await expect( page.locator( 'a.set' ) ).toHaveCount( 2 );
		const card = page.locator( 'a.set' ).first();
		await expect( card ).toBeVisible();
		await expect( card.locator( '.set-name' ) ).toHaveText( 'Demo Set' );
		await expect( card.locator( '.set-meta' ) ).toContainText( '2 tracks' );
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
		await page.locator( '#offline' ).click(); // a plain tap does nothing
		await expect( page.locator( '#offline' ) ).toHaveText(
			'Saved offline'
		);
		await page.locator( '#offline' ).focus();
		await page.keyboard.press( 'Delete' ); // asks first (a press-and-hold does the same)
		await expect( page.locator( '#offline' ) ).toContainText( /Tap again/ );
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
		await expect( page.locator( '.track' ) ).toHaveCount( 2 );
		await expect(
			page.locator( '.track' ).first().locator( '.title' )
		).toHaveText( 'Tone One' ); // "1. … (Demo OBC)" cleaned on import
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
		await expect( audio ).toHaveAttribute( 'src', /Tone%202/ );
		await expect( page.locator( '.track' ).nth( 1 ) ).toHaveClass(
			/active/
		);
		await expect( page.locator( '.track' ).nth( 1 ) ).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Tone Two'
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
		await expect( page.locator( '#loop' ) ).toBeHidden();
	} );

	test( 'a track with a tempo counts in before it plays', async ( {
		page,
	} ) => {
		await page.goto( '/long-set/' );
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
			'Tone One'
		);
		await page.goBack();
		await expect( page.locator( 'h1' ) ).toHaveText( 'Demo Set' );
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Tone One'
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
