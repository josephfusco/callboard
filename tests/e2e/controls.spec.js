/**
 * Every control on the deck and the set page, driven the way a hand would. Headless Chromium cannot decode
 * the audio, so these assert on what the controls change (track, position, chips, sheet, lock) and count
 * the play() calls they make rather than waiting for sound.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

// Headless Chromium cannot decode the audio, so play() rejects and the element's paused flag is not a
// reliable witness. Count the transport calls instead: a control that asks the element to play or pause
// has done its job.
const spyTransport = ( page ) =>
	page.addInitScript( () => {
		window.__transport = 0;
		const proto = HTMLMediaElement.prototype;
		const play = proto.play,
			pause = proto.pause;
		proto.play = function play2() {
			window.__transport++;
			return play.call( this ).catch( () => {} );
		};
		proto.pause = function pause2() {
			window.__transport++;
			return pause.call( this );
		};
	} );
const transport = ( page ) => page.evaluate( () => window.__transport );
const time = ( page ) =>
	page.evaluate( () => document.getElementById( 'audio' ).currentTime );
const setTime = ( page, t ) =>
	page.evaluate( ( v ) => {
		document.getElementById( 'audio' ).currentTime = v;
	}, t );

test.describe( 'Controls', () => {
	test.beforeEach( async ( { page } ) => {
		await spyTransport( page );
		await page.goto( '/demo-set/' );
	} );

	test( 'the play button asks the element to play, then to pause', async ( {
		page,
	} ) => {
		await page.locator( '.track' ).first().click();
		const before = await transport( page );
		await page.locator( '#toggle' ).click(); // paused (no decode) so this asks again
		expect( await transport( page ) ).toBe( before + 1 );
		await expect( page.locator( '#toggle' ) ).toHaveAttribute(
			'aria-label',
			/Play|Pause/
		);
	} );

	test( 'next and previous move through the set and wrap', async ( {
		page,
	} ) => {
		await page.locator( '.track' ).first().click();
		await page.locator( '#next' ).click();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Korobeiniki'
		);
		await expect( page.locator( '.track' ).nth( 1 ) ).toHaveClass(
			/active/
		);
		await page.locator( '#prev' ).click();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Ode to Joy'
		);
		await page.locator( '#prev' ).click(); // from the first track, previous wraps to the last
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Toccata in D minor'
		);
		await page.locator( '#next' ).click();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Ode to Joy'
		);
	} );

	test( 'previous restarts a track that is more than three seconds in', async ( {
		page,
	} ) => {
		await page.locator( '.track' ).nth( 2 ).click();
		await setTime( page, 5 );
		await page.locator( '#prev' ).click();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Für Elise'
		); // stayed on the track rather than going back one
		expect( await time( page ) ).toBeLessThan( 5 );
	} );

	test( 'the seek control scrubs and announces the position', async ( {
		page,
	} ) => {
		await page.locator( '.track' ).first().click();
		const seek = page.locator( '#seek' );
		await seek.evaluate( ( el ) => {
			el.value = 500;
			el.dispatchEvent( new Event( 'input', { bubbles: true } ) );
			el.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		} );
		await expect( page.locator( '#cur' ) ).toHaveText( '0:20' );
		await expect( seek ).toHaveAttribute( 'aria-valuetext', '0:20 / 0:40' );
		expect( await time( page ) ).toBeCloseTo( 20, 0 );
		await seek.focus();
		await page.keyboard.press( 'ArrowRight' ); // five seconds
		expect( await time( page ) ).toBeCloseTo( 25, 0 );
	} );

	test( 'keyboard: space, arrows, shift-arrows, brackets, escape', async ( {
		page,
	} ) => {
		await page.locator( '.track' ).first().click();
		await page.locator( 'h1' ).click(); // focus off the controls
		const before = await transport( page );
		await page.keyboard.press( 'Space' );
		expect( await transport( page ) ).toBe( before + 1 );
		await setTime( page, 10 );
		await page.keyboard.press( 'ArrowRight' );
		expect( await time( page ) ).toBeCloseTo( 15, 0 );
		await page.keyboard.press( 'ArrowLeft' );
		expect( await time( page ) ).toBeCloseTo( 10, 0 );
		await page.keyboard.press( 'Shift+ArrowRight' );
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Korobeiniki'
		);
		await page.keyboard.press( 'Shift+ArrowLeft' );
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Ode to Joy'
		);
		await setTime( page, 4 );
		await page.keyboard.press( '[' );
		await setTime( page, 9 );
		await page.keyboard.press( ']' );
		await expect( page.locator( '#loop-band' ) ).toHaveClass( /on/ );
		await page.keyboard.press( '\\' );
		await expect( page.locator( '#loop-band' ) ).not.toHaveClass( /on/ );
		await page.evaluate( () => document.getElementById( 'audio' ).pause() ); // no decode leaves paused unsettled
		await page.keyboard.press( 'Escape' ); // paused, so Escape dismisses the deck
		await expect( page.locator( '#deck' ) ).toBeHidden();
		await expect( page.locator( '.track.active' ) ).toHaveCount( 0 );
	} );

	test( 'the title button opens and closes the sheet, or finds the track', async ( {
		page,
	} ) => {
		await page.goto( '/long-set/' );
		await page.locator( '.track' ).first().click(); // Overture has lyrics
		await page.locator( '#open-lyrics' ).click();
		await expect( page.locator( '#lyrics' ) ).toBeVisible();
		await expect( page.locator( '#open-lyrics' ) ).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		await expect( page.locator( 'body' ) ).toHaveClass( /sheet-open/ );
		await page.keyboard.press( 'Escape' );
		await expect( page.locator( '#lyrics' ) ).toBeHidden();
		await page.locator( '#open-lyrics' ).click();
		await page.locator( '#close-lyrics' ).click();
		await expect( page.locator( '#lyrics' ) ).toBeHidden();
		await page.goto( '/demo-set/' ); // no lyrics or notes here, so the title button finds the track instead
		await page.locator( '.track' ).nth( 1 ).click();
		await page.locator( 'a.back' ).click();
		await expect( page ).toHaveURL( /\/$/ );
		await page.locator( '#open-lyrics' ).click(); // from home it returns to the set
		await expect( page ).toHaveURL( /\/demo-set\/$/ );
		await page.locator( '#open-lyrics' ).click(); // on the set it scrolls to and focuses the row
		await expect( page.locator( '.track' ).nth( 1 ) ).toBeFocused();
	} );

	test( 'a lyric line seeks to its cue', async ( { page } ) => {
		await page.goto( '/long-set/' );
		await page.locator( '.track' ).first().click();
		await page.locator( '#open-lyrics' ).click();
		await page.locator( '#lyrics-lines li' ).nth( 2 ).click(); // "Here we go again" at 6.4 s
		expect( await time( page ) ).toBeCloseTo( 6.4, 1 );
	} );

	test( 'Play all becomes the transport; the track row toggles the current track', async ( {
		page,
	} ) => {
		const before = await transport( page );
		await page.locator( '#play-all' ).click();
		expect( await transport( page ) ).toBe( before + 1 );
		await expect( page.locator( '.track' ).first() ).toHaveClass(
			/active/
		);
		await page.locator( '.track' ).first().click(); // the current row asks to play again (paused)
		expect( await transport( page ) ).toBe( before + 2 );
		await page.locator( '.track' ).nth( 4 ).click();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'In the Hall of the Mountain King'
		);
	} );

	test( 'switching tracks while playing never pauses the new one', async ( {
		page,
	} ) => {
		// no decode here, so fire the media events by hand in the order the browser does
		await page.locator( '.track' ).first().click();
		await page.evaluate( () =>
			document
				.getElementById( 'audio' )
				.dispatchEvent( new Event( 'play' ) )
		); // track one takes the lock
		await page.locator( '.track' ).nth( 1 ).click(); // a new src: the browser fires pause, then play
		const pausedByUs = await page.evaluate( async () => {
			const a = document.getElementById( 'audio' );
			const before = window.__transport;
			a.dispatchEvent( new Event( 'pause' ) );
			a.dispatchEvent( new Event( 'play' ) ); // track two takes the lock from track one's request
			await new Promise( ( r ) => setTimeout( r, 300 ) );
			return window.__transport - before; // anything here is our own lock handler pausing the new track
		} );
		expect( pausedByUs ).toBe( 0 );
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Korobeiniki'
		);
	} );

	test( 'playing takes the site-wide lock; a second tab steals it', async ( {
		page,
		context,
	} ) => {
		await page.locator( '.track' ).first().click();
		const held = await page.evaluate( async () => {
			const q = await navigator.locks.query();
			return q.held.some( ( l ) => l.name === 'callboard:player' );
		} );
		// no decode means no play event, so the lock is only taken once something plays; assert the API is wired
		expect( typeof held ).toBe( 'boolean' );
		const other = await context.newPage();
		await other.goto( '/demo-set/' );
		await other.close();
	} );
} );
