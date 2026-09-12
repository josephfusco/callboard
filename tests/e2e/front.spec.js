/**
 * Front end: home, a set, the player, in-place navigation. Runs on desktop and an iPhone viewport.
 */
const fs = require( 'node:fs' );
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

// The deck opens compact by default (title, artist, play/pause) and remembers the last view; a few tests
// here reach into the wave/times/chips row, which compact hides, so they ask for the expanded view first.
const expandDeck = ( page ) =>
	page.addInitScript( () =>
		localStorage.setItem(
			'callboard:deck-view',
			JSON.stringify( 'expanded' )
		)
	);

test.describe( 'Front end', () => {
	test( 'home lists sets with counts and the footer note', async ( {
		page,
	} ) => {
		await page.goto( '/' );
		await expect( page ).toHaveTitle( /./ );
		// Not a total count: a machine can have its own local-only sets alongside the fixtures.
		await expect(
			page.locator( 'a.set', { hasText: 'Shakespeare' } )
		).toHaveCount( 1 );
		await expect(
			page.locator( 'a.set', { hasText: 'Empty Set' } )
		).toHaveCount( 1 );
		const card = page.locator( 'a.set', { hasText: 'Shakespeare' } );
		await expect( card ).toBeVisible();
		await expect( card.locator( '.set-name' ) ).toHaveText(
			'Shakespeare’s Sonnets'
		);
		await expect( card.locator( '.set-meta' ) ).toContainText(
			'10 tracks'
		);
		await expect( page.locator( 'footer.colophon' ) ).toContainText(
			'For rehearsal use only.'
		);
		await expect( page.locator( '#deck' ) ).toBeHidden();
		await expect( page.locator( '#wpadminbar' ) ).toHaveCount( 0 ); // even logged in, no admin bar on the app
	} );

	test( 'a set scrolls and keeps the deck pinned', async ( { page } ) => {
		await page.goto( '/demo-set/' );
		await expect( page.locator( '.track' ) ).toHaveCount( 10 );
		await page.locator( '.track' ).nth( 9 ).click();
		await expect( page.locator( '#deck' ) ).toBeVisible();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Sonnets 91–100'
		);
		await page.locator( '.track' ).nth( 9 ).scrollIntoViewIfNeeded();
		const deckBox = await page.locator( '#deck' ).boundingBox();
		const viewport = page.viewportSize();
		expect( deckBox.y + deckBox.height ).toBeGreaterThanOrEqual(
			viewport.height - 130
		); // pinned to the bottom edge
	} );

	test( 'loading a set from files fills the offline copies without the network', async ( {
		page,
	} ) => {
		const audio = fs.readFileSync(
			'tests/fixtures/callboard/demo-set/01 - Sonnets 1–10 [son01].mp3'
		);
		const file = ( name ) => ( {
			name,
			mimeType: 'audio/mpeg',
			buffer: audio,
		} );

		await page.goto( '/demo-set/' );
		await page.waitForTimeout( 900 );
		// The control appears only once the script knows there is a cache to fill.
		await expect( page.locator( '#load-label' ) ).toBeVisible();

		// One file per matching rule: the track's own name, a car export's leading number, the title.
		await page
			.locator( '#load-files' )
			.setInputFiles( [
				file( '01 - Sonnets 1–10 [son01].mp3' ),
				file( '02 Anything At All.mp3' ),
				file( 'Sonnets 21–30.mp3' ),
				file( 'nothing-in-this-set.mp3' ),
			] );
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			3,
			{ timeout: 15000 }
		);
		await expect( page.locator( '#toast' ) ).toContainText(
			/Loaded 3 of 4/
		);

		// A copy off a stick is a different size from the server's and must not count as stale.
		await page.reload();
		await page.waitForTimeout( 1200 );
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			3
		);

		// A file matching nothing is said so, not guessed at.
		await page
			.locator( '#load-files' )
			.setInputFiles( [ file( 'still-not-in-this-set.mp3' ) ] );
		await expect( page.locator( '#toast' ) ).toContainText(
			/Nothing matched/
		);
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			3
		);
	} );

	test( 'saving a set offline marks every track, including slashed titles', async ( {
		page,
	} ) => {
		await page.goto( '/demo-set/' );
		await page.waitForTimeout( 900 );
		await page.locator( '#offline' ).click();
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			10,
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
			10
		);
		await page.locator( '.back' ).click(); // home shows the same mark on the set
		await expect(
			page.locator( '.set-off[data-slug="demo-set"]' )
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
			10
		);
		await page.locator( '#offline' ).click();
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			0
		);
	} );

	test( 'saving stops with a message when the browser has no room', async ( {
		page,
	} ) => {
		await page.addInitScript( () => {
			navigator.storage.estimate = () =>
				Promise.resolve( { quota: 1024 * 1024, usage: 1024 * 1000 } ); // 24 KB free
		} );
		await page.goto( '/demo-set/' );
		await page.waitForTimeout( 900 );
		await page.locator( '#offline' ).click();
		await expect( page.locator( '#offline' ) ).toHaveText(
			/Not enough space, 24 KB free/
		);
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			0
		);
		await expect( page.locator( '#offline' ) ).toContainText(
			/Save offline/,
			{ timeout: 5000 }
		); // the button comes back
	} );

	test( 'a saved copy whose size no longer matches is not counted as saved', async ( {
		page,
	} ) => {
		await page.goto( '/demo-set/' );
		await page.waitForTimeout( 900 );
		await page.locator( '#offline' ).click(); // per-track controls are hidden until hover on touch, so save the set
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			10,
			{ timeout: 30000 }
		);
		await page.evaluate( async () => {
			// stand in for a track replaced on the server: same URL, a different file
			const url = document.getElementById( 'audio' ).src;
			const c = await caches.open( 'callboard-audio-v1' );
			const keys = await c.keys();
			await c.put(
				keys[ 0 ],
				new Response( 'x', {
					headers: {
						'Content-Type': 'audio/mpeg',
						'Content-Length': '1',
					},
				} )
			);
			return url;
		} );
		await page.reload();
		await page.waitForTimeout( 1200 );
		await expect( page.locator( '.dl[data-state="saved"]' ) ).toHaveCount(
			9
		); // the replaced one is offered again
		await expect( page.locator( '#offline' ) ).toContainText( /9 of 10/ );
		await page.evaluate( async () => {
			for ( const k of await (
				await caches.open( 'callboard-audio-v1' )
			).keys() ) {
				await ( await caches.open( 'callboard-audio-v1' ) ).delete( k );
			}
		} );
	} );

	test( 'a set shows its tracks, credits and no personal chrome', async ( {
		page,
	} ) => {
		await page.goto( '/demo-set/' );
		await expect( page.locator( 'h1' ) ).toHaveText(
			'Shakespeare’s Sonnets'
		);
		await expect( page.locator( '.track' ) ).toHaveCount( 10 );
		await expect(
			page.locator( '.track' ).first().locator( '.title' )
		).toHaveText( 'Sonnets 1–10' ); // the first section of the fixture recording
		await expect( page.locator( 'footer.colophon' ) ).toContainText(
			'Audio by LibriVox volunteers'
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
		await expect( audio ).toHaveAttribute( 'src', /son02/ );
		await expect( page.locator( '.track' ).nth( 1 ) ).toHaveClass(
			/active/
		);
		await expect( page.locator( '.track' ).nth( 1 ) ).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Sonnets 11–20'
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
		await expandDeck( page ); // the seek line and its marks are expanded-only now
		await page.goto( '/demo-set/' );
		await page.locator( '.track' ).nth( 2 ).click(); // the annotated track
		await expect( page.locator( '#seek-marks .pin' ) ).toHaveCount( 2 ); // one per director's note
		await page.locator( '#seek-marks .pin' ).first().click();
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Softer here'
		);
		await expect( page.locator( '#now-title' ) ).toContainText( 'Sep 1' );
	} );

	test( 'an A-B loop from the keyboard shows the band and clears', async ( {
		page,
	} ) => {
		await expandDeck( page );
		await page.goto( '/demo-set/' );
		await page.locator( '.track' ).first().click();
		await page.evaluate( () => {
			document.getElementById( 'audio' ).currentTime = 2;
		} );
		await page.keyboard.press( '[' );
		await page.evaluate( () => {
			document.getElementById( 'audio' ).currentTime = 6;
		} );
		await page.keyboard.press( ']' );
		await expect( page.locator( '#loop-band' ) ).toHaveClass( /on/ );
		await page.keyboard.press( '\\' );
		await expect( page.locator( '#loop-band' ) ).not.toHaveClass( /on/ );
	} );

	test( 'the deck draws the waveform and keeps one height with or without lyrics', async ( {
		page,
	} ) => {
		await expandDeck( page ); // the wave only draws in the expanded view
		await page.goto( '/demo-set/' );
		await page.locator( '.track' ).first().click(); // levels and a note
		await expect( page.locator( '#deck' ) ).toHaveClass( /has-wave/ );
		expect(
			await page.locator( '#wave-base' ).evaluate( ( c ) => c.width )
		).toBeGreaterThan( 0 );
		const withLyrics = ( await page.locator( '#deck' ).boundingBox() )
			.height;
		await page.locator( '#seek' ).evaluate( ( el ) => {
			// drag to the middle: headless Chromium cannot decode the mp3, so drive the control, not the media
			el.value = 500;
			el.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		} );
		await expect( page.locator( '#wave-reveal' ) ).toHaveAttribute(
			'style',
			/translateX\(-50(\.0+)?%\)/
		); // the reveal window slides to the middle; the canvas inside slides back the same amount
		await expect( page.locator( '#wave-played' ) ).toHaveAttribute(
			'style',
			/translateX\(50(\.0+)?%\)/
		);
		await page.goto( '/demo-set/' );
		await page.locator( '.track' ).first().click(); // levels, no lyrics or notes
		const without = ( await page.locator( '#deck' ).boundingBox() ).height;
		expect( Math.abs( withLyrics - without ) ).toBeLessThan( 1 );
	} );

	test( 'a track with a tempo counts in before it plays, once the setting is on', async ( {
		page,
		admin,
	} ) => {
		const settings = async ( on ) => {
			await admin.visitAdminPage(
				'edit.php',
				'post_type=callboard_set&page=callboard-settings'
			);
			if ( on ) {
				await page.check( '#callboard-count_in' );
			} else {
				await page.uncheck( '#callboard-count_in' );
			}
			await page.click( '#submit' );
			await expect(
				page
					.locator(
						'#setting-error-settings_updated, .notice-success'
					)
					.first()
			).toBeVisible();
		};
		await page.goto( '/demo-set/' );
		await expect( page.locator( '.track .bpm' ) ).toHaveText( '♩ 96' );
		await page.locator( '.track' ).nth( 2 ).click(); // 96 BPM: off by default, it just plays
		await expect( page.locator( '#deck' ) ).not.toHaveClass( /counting/ );
		await settings( true );
		await page.goto( '/demo-set/' );
		await page.evaluate( () => localStorage.clear() ); // forget the position, or the same row just toggles play
		await page.reload();
		await page.locator( '.track' ).nth( 2 ).click();
		await expect( page.locator( '#deck' ) ).toHaveClass( /counting/ );
		await expect( page.locator( '#now-title' ) ).toHaveText(
			/^1(\s+[2-4])*$/
		);
		await expect( page.locator( '#deck' ) ).not.toHaveClass( /counting/, {
			timeout: 4000,
		} );
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Sonnets 21–30'
		);
		await settings( false ); // back off for the other tests
	} );

	test( 'the deck offers AirPlay or Cast only while a device is in reach', async ( {
		page,
	} ) => {
		await page.addInitScript( () => {
			// stand in for a speaker on the network: Chromium's own remote never finds one in CI
			if ( ! ( 'remote' in HTMLMediaElement.prototype ) ) {
				return;
			}
			window.__remote = { prompted: 0 };
			Object.defineProperty( HTMLMediaElement.prototype, 'remote', {
				get() {
					return {
						state: 'disconnected',
						watchAvailability: ( cb ) => {
							cb( true );
							return Promise.resolve( 1 );
						},
						cancelWatchAvailability: () => Promise.resolve(),
						prompt: () => {
							window.__remote.prompted++;
							return Promise.resolve();
						},
						addEventListener: () => {},
					};
				},
			} );
		} );
		await expandDeck( page ); // the cast chip lives on the (now expanded-only) time row
		await page.goto( '/demo-set/' );
		test.skip(
			! ( await page.evaluate(
				() => 'remote' in HTMLMediaElement.prototype
			) ),
			'no Remote Playback API in this browser'
		);
		await page.locator( '.track' ).first().click();
		const chip = page.locator( '#remote' );
		await expect( chip ).toBeVisible();
		await expect( chip ).toHaveAttribute(
			'aria-label',
			'Play on another device'
		);
		await chip.click();
		expect( await page.evaluate( () => window.__remote.prompted ) ).toBe(
			1
		);
	} );

	test( 'the deck sends the playing track itself, named so it can be matched back', async ( {
		page,
	} ) => {
		await page.addInitScript( () => {
			window.__sharedFiles = [];
			navigator.canShare = () => true;
			navigator.share = ( d ) => {
				window.__sharedFiles.push( {
					title: d.title,
					names: ( d.files || [] ).map( ( f ) => f.name ),
					sizes: ( d.files || [] ).map( ( f ) => f.size ),
					types: ( d.files || [] ).map( ( f ) => f.type ),
				} );
				return Promise.resolve();
			};
		} );
		await expandDeck( page ); // the share-track chip lives on the (now expanded-only) time row
		await page.goto( '/demo-set/' );
		await page.locator( '.track[data-i="0"]' ).click();
		const chip = page.locator( '#share-track' );
		await expect( chip ).toBeVisible();
		await chip.click();

		await expect
			.poll( () => page.evaluate( () => window.__sharedFiles.length ) )
			.toBe( 1 );
		const sent = await page.evaluate( () => window.__sharedFiles[ 0 ] );
		expect( sent.title ).toBe( 'Sonnets 1–10' );
		// The number and the title are both what the receiving end matches on.
		expect( sent.names[ 0 ] ).toBe( '01 Sonnets 1–10.mp3' );
		expect( sent.types[ 0 ] ).toMatch( /^audio\// );
		expect( sent.sizes[ 0 ] ).toBeGreaterThan( 0 );
	} );

	test( 'without file sharing the deck does not offer to send a track', async ( {
		page,
	} ) => {
		await page.addInitScript( () => {
			navigator.canShare = () => false; // shares links, not files
		} );
		await expandDeck( page ); // so this stays hidden for lack of file sharing, not because it is compact
		await page.goto( '/demo-set/' );
		await page.locator( '.track[data-i="0"]' ).click();
		await expect( page.locator( '#share-track' ) ).toBeHidden();
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
		expect( shared[ 0 ].title ).toContain( 'Shakespeare’s Sonnets' );
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
		await expect( btn ).toHaveAttribute( 'aria-label', /Share a link/ );
		await btn.click();
		await expect( btn ).toHaveText( 'Link copied' );
		expect( await page.evaluate( () => window.__copied ) ).toMatch(
			/\/demo-set\/$/
		);
		await expect( btn.locator( 'svg' ) ).toHaveCount( 1, {
			timeout: 3000,
		} ); // the icon is back
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

	test( 'navigation swaps in the fragment the server renders', async ( {
		page,
		request,
	} ) => {
		const frag = await request.get( '/demo-set/?fragment=1' );
		expect( frag.ok() ).toBeTruthy();
		const body = await frag.text();
		expect( body.trim().startsWith( '<main' ) ).toBeTruthy();
		expect( body ).not.toContain( '<html' );
		expect( body ).toContain( 'class="tracks"' );
		expect(
			await ( await request.get( '/?fragment=1' ) ).text()
		).toContain( 'class="sets"' );
		expect( ( await request.get( '/nope/?fragment=1' ) ).status() ).toBe(
			404
		);
		await page.goto( '/' );
		const [ res ] = await Promise.all( [
			page.waitForResponse( ( r ) => r.url().includes( 'fragment=1' ) ),
			page.locator( 'a.set', { hasText: 'Shakespeare' } ).click(),
		] );
		expect( res.ok() ).toBeTruthy();
		await expect( page ).toHaveURL( /\/demo-set\/$/ );
		await expect( page.locator( 'h1' ) ).toHaveText(
			'Shakespeare’s Sonnets'
		);
		await expect( page.locator( '.track' ) ).toHaveCount( 10 );
		await expect( page.locator( '.colophon' ) ).toContainText( 'Audio by' ); // the footer came with it
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
			'Sonnets 1–10'
		);
		await page.goBack();
		await expect( page.locator( 'h1' ) ).toHaveText(
			'Shakespeare’s Sonnets'
		);
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Sonnets 1–10'
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
