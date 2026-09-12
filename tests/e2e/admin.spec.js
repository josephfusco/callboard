/**
 * Admin: settings, set editing, import queue, notices.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

// Several tests here change shared data (the settings, the demo set's first track, the board) and put it
// back at the end. A restore that runs only when the test passes leaves the change behind when it fails:
// one failure left track 1 at 100 BPM with a note, and both count-in tests after it failed too. So every
// restore sits in a finally and starts from a fresh admin page, since a failure can leave the editor with
// unsaved changes and core asks before leaving those.
const leaveFreely = ( page ) =>
	page.on( 'dialog', ( dialog ) => dialog.accept().catch( () => {} ) );
const openDemoSet = async ( admin, page ) => {
	await admin.visitAdminPage( 'edit.php', 'post_type=callboard_set' );
	await page
		.locator( '.wp-list-table tbody tr', {
			hasText: 'Shakespeare’s Sonnets',
		} )
		.first()
		.locator( 'a.row-title' )
		.click();
	return page.locator( '#callboard-tracks li' ).first();
};
// The panel renders open when the track already carries a tempo or a note, so opening it blindly would
// close it. Ask before clicking.
const openTrackDetails = async ( track ) => {
	if (
		! ( await track.locator( 'details' ).evaluate( ( el ) => el.open ) )
	) {
		await track.locator( 'summary' ).click();
	}
};
const saveSet = async ( page ) => {
	await page.click( '#publish' );
	await expect( page.locator( '#message' ) ).toContainText( /updated/i );
};

test.describe( 'Admin', () => {
	test( 'settings save and show on the front end', async ( {
		admin,
		page,
	} ) => {
		try {
			await admin.visitAdminPage(
				'edit.php',
				'post_type=callboard_set&page=callboard-settings'
			);
			await page.fill( '#callboard-tagline', 'Practice tracks' );
			await page.fill(
				'#callboard-footer_note',
				'For rehearsal use only.'
			);
			await page.fill( '#callboard-badge', '★' );
			await page.fill( '#callboard-confetti', '22' );
			await page.check( '#callboard-hearts' );
			await page.fill( '#callboard-accent', '#3b82f6' );
			await page.click( '#submit' );
			await expect(
				page
					.locator(
						'#setting-error-settings_updated, .notice-success'
					)
					.first()
			).toBeVisible();
			await page.goto( '/demo-set/' );
			await expect( page.locator( '.track .hh' ).first() ).toHaveText(
				'★'
			);
			await page.goto( '/' );
			await expect(
				page.locator( 'meta[property="og:description"]' )
			).toHaveAttribute( 'content', /Practice tracks/ );
			expect(
				await page.evaluate( () =>
					getComputedStyle( document.documentElement )
						.getPropertyValue( '--accent' )
						.trim()
				)
			).toBe( '#3b82f6' );
		} finally {
			// back to the house colour, so the other tests and the screenshots see it
			leaveFreely( page );
			await admin.visitAdminPage(
				'edit.php',
				'post_type=callboard_set&page=callboard-settings'
			);
			await page.fill( '#callboard-accent', '' );
			await page.click( '#submit' );
			await page.goto( '/' );
			await expect( page.locator( '#callboard-accent' ) ).toHaveCount(
				0
			);
		}
	} );

	test( 'a set has a tracks meta box with reorderable, retitlable rows', async ( {
		admin,
		page,
	} ) => {
		try {
			// Find the demo set through the list table (REST is closed to anonymous but we're logged in here).
			await admin.visitAdminPage( 'edit.php', 'post_type=callboard_set' );
			const row = page
				.locator( '.wp-list-table tbody tr', {
					hasText: 'Shakespeare’s Sonnets',
				} )
				.first();
			await expect( row ).toContainText( 'Shakespeare’s Sonnets' );
			await expect( row.locator( 'td.tracks' ) ).toHaveText( '10' );
			await row.locator( 'a.row-title' ).click();
			const tracks = page.locator( '#callboard-tracks li' );
			await expect( tracks ).toHaveCount( 10 );
			await tracks
				.first()
				.locator( 'input[type=text]' )
				.fill( 'Renamed Tone' );
			await saveSet( page );
			await page.goto( '/demo-set/' );
			await expect(
				page.locator( '.track' ).first().locator( '.title' )
			).toContainText( 'Renamed Tone' );
		} finally {
			// put it back for the other tests
			leaveFreely( page );
			const first = await openDemoSet( admin, page );
			await first.locator( 'input[type=text]' ).fill( 'Sonnets 1–10' );
			await saveSet( page );
		}
	} );

	test( 'a track keeps its tempo and dated director notes', async ( {
		admin,
		page,
	} ) => {
		try {
			const first = await openDemoSet( admin, page );
			await openTrackDetails( first );
			await first.locator( 'input[type=number]' ).fill( '100' );
			await first.locator( 'textarea' ).fill( '0:03 Softer here' );
			await saveSet( page );
			const again = page.locator( '#callboard-tracks li' ).first();
			await expect( again.locator( 'input[type=number]' ) ).toHaveValue(
				'100'
			);
			await expect( again.locator( 'textarea' ) ).toHaveValue(
				'0:03 Softer here'
			);
			await page.goto( '/demo-set/' );
			await page.locator( '.track' ).first().click();
			await expect( page.locator( '#seek-marks .pin' ) ).toHaveCount( 1 );
		} finally {
			// put it back for the other tests
			leaveFreely( page );
			const back = await openDemoSet( admin, page );
			await openTrackDetails( back );
			await back.locator( 'input[type=number]' ).fill( '' );
			await back.locator( 'textarea' ).fill( '' );
			await saveSet( page );
		}
	} );

	test( 'the import page queues a YouTube request', async ( {
		admin,
		page,
	} ) => {
		try {
			await admin.visitAdminPage(
				'edit.php',
				'post_type=callboard_set&page=callboard-import'
			);
			await page.fill(
				'#callboard-url',
				'https://www.youtube.com/playlist?list=PLtest'
			);
			await page.fill( '#callboard-name', 'Queued Show' );
			await page.click( 'form.callboard-request #submit' );
			await expect( page.locator( '.notice-success' ) ).toContainText(
				'Queued'
			);
			const table = page.locator( 'table.widefat' );
			await expect( table ).toContainText( 'Queued Show' );
			await expect(
				table.locator( '.callboard-status-queued' ).first()
			).toBeVisible();
			await page.locator( 'a.submitdelete' ).first().click();
			await expect( page.locator( 'table.widefat' ) ).toHaveCount( 0 );
		} finally {
			leaveFreely( page );
			await admin.visitAdminPage(
				'edit.php',
				'post_type=callboard_set&page=callboard-import'
			);
			const queued = page.locator( 'table.widefat tbody tr', {
				hasText: 'Queued Show',
			} );
			while ( ( await queued.count() ) > 0 ) {
				const n = await queued.count();
				await queued.first().locator( 'a.submitdelete' ).click();
				await expect( queued ).toHaveCount( n - 1 );
			}
		}
	} );

	test( 'the notices page shows subscriber count and a send form', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage(
			'edit.php',
			'post_type=callboard_set&page=callboard-notices'
		);
		const count = page.locator( '.wrap p' ).first();
		await expect( count ).toContainText( /subscribed/ );
		await expect( page.locator( '#callboard-nbody' ) ).toBeVisible();
		// Send is enabled exactly when someone is subscribed. A developer's own browser may well be, so
		// the test reads the count rather than assuming zero.
		const n = parseInt(
			( await count.textContent() ).match( /\d+/ )[ 0 ],
			10
		);
		if ( n ) {
			await expect( page.locator( '#submit' ) ).toBeEnabled();
		} else {
			await expect( page.locator( '#submit' ) ).toBeDisabled();
		}
	} );

	test( 'a posted call opens the board, and its number starts the track', async ( {
		admin,
		page,
	} ) => {
		try {
			await admin.visitAdminPage(
				'post-new.php',
				'post_type=callboard_call'
			);
			await page.fill( '#title', 'Act II sitzprobe' );
			await page.click( '#content-html' ); // the code tab: the visual editor hides the textarea
			await page.fill( '#content', 'Orchestra joins us. Be warmed up.' );
			const when = new Date( Date.now() + 3 * 86400 * 1000 );
			when.setHours( 19, 0, 0, 0 );
			const pad = ( n ) => String( n ).padStart( 2, '0' );
			await page.fill(
				'#callboard-when',
				`${ when.getFullYear() }-${ pad( when.getMonth() + 1 ) }-${ pad(
					when.getDate()
				) }T19:00`
			);
			await page.fill( '#callboard-where', 'Pit' );
			const demo = page.locator( '.callboard-numbers details', {
				hasText: 'Shakespeare’s Sonnets',
			} );
			await demo.locator( 'summary' ).click();
			await demo.locator( 'input[type=checkbox]' ).nth( 2 ).check(); // Sonnets 21–30
			// Leaving the title of a new post queues an autosave 200ms later, and core drops a click on
			// Publish while that save is out. The button can still read enabled a few milliseconds before
			// the save starts, so wait for the save itself to come back (#131).
			await expect( page.locator( '.autosave-message' ) ).toHaveText(
				/Draft saved/
			);
			await expect( page.locator( '#publish' ) ).not.toHaveClass(
				/disabled/
			);
			await page.click( '#publish' );
			await page.waitForURL( /post\.php\?post=\d+&action=edit&message=/ );
			await expect( page.locator( '#callboard-where' ) ).toHaveValue(
				'Pit'
			);

			await page.goto( '/' );
			const call = page.locator( '.call', {
				hasText: 'Act II sitzprobe',
			} );
			await expect( call ).toBeVisible();
			await expect( call.locator( '.call-rel' ) ).toContainText(
				/in|days/
			);
			await expect( call.locator( '.call-where' ) ).toHaveText( 'Pit' );
			await expect( call.locator( '.call-numbers a' ) ).toHaveText(
				'Sonnets 21–30'
			);
			await call.locator( '.call-numbers a' ).click();
			await expect( page ).toHaveURL( /\/demo-set\/$/ );
			await expect( page.locator( '#now-title' ) ).toContainText(
				'Sonnets 21–30'
			);

			await admin.visitAdminPage(
				'edit.php',
				'post_type=callboard_call'
			);
			await expect(
				page
					.locator( '#the-list tr', { hasText: 'Act II sitzprobe' } )
					.first()
					.locator( '.column-callboard_when' )
			).toContainText( /\(in / );
		} finally {
			// leave the board as it was, including a draft left by a publish that did not go through
			leaveFreely( page );
			await admin.visitAdminPage(
				'edit.php',
				'post_type=callboard_call'
			);
			const rows = page.locator( '#the-list tr', {
				hasText: 'Act II sitzprobe',
			} );
			while ( ( await rows.count() ) > 0 ) {
				const n = await rows.count();
				await rows.first().hover();
				await rows.first().locator( 'a.submitdelete' ).click();
				await expect( rows ).toHaveCount( n - 1 );
			}
		}
	} );
} );
