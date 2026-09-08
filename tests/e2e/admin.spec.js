/**
 * Admin: settings, set editing, import queue, notices.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'Admin', () => {
	test( 'settings save and show on the front end', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage(
			'edit.php',
			'post_type=callboard_set&page=callboard-settings'
		);
		await page.fill( '#callboard-tagline', 'Practice tracks' );
		await page.fill( '#callboard-footer_note', 'For rehearsal use only.' );
		await page.fill( '#callboard-badge', '★' );
		await page.fill( '#callboard-confetti', '22' );
		await page.check( '#callboard-hearts' );
		await page.click( '#submit' );
		await expect(
			page
				.locator( '#setting-error-settings_updated, .notice-success' )
				.first()
		).toBeVisible();
		await page.goto( '/demo-set/' );
		await expect( page.locator( '.track .hh' ).first() ).toHaveText( '★' );
		await page.goto( '/' );
		await expect(
			page.locator( 'meta[property="og:description"]' )
		).toHaveAttribute( 'content', /Practice tracks/ );
	} );

	test( 'a set has a tracks meta box with reorderable, retitlable rows', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		// Find the demo set's ID through the list table (REST is closed to anonymous but we're logged in here).
		await admin.visitAdminPage( 'edit.php', 'post_type=callboard_set' );
		const row = page
			.locator( '.wp-list-table tbody tr', { hasText: 'Demo Set' } )
			.first();
		await expect( row ).toContainText( 'Demo Set' );
		await expect( row.locator( 'td.tracks' ) ).toHaveText( '10' );
		await row.locator( 'a.row-title' ).click();
		const tracks = page.locator( '#callboard-tracks li' );
		await expect( tracks ).toHaveCount( 10 );
		await tracks
			.first()
			.locator( 'input[type=text]' )
			.fill( 'Renamed Tone' );
		await page.click( '#publish' );
		await expect( page.locator( '#message' ) ).toContainText( /updated/i );
		await page.goto( '/demo-set/' );
		await expect(
			page.locator( '.track' ).first().locator( '.title' )
		).toContainText( 'Renamed Tone' );
		// put it back for the other tests
		await page.goBack();
		await page
			.locator( '#callboard-tracks li' )
			.first()
			.locator( 'input[type=text]' )
			.fill( 'Ode to Joy' );
		await page.click( '#publish' );
		void requestUtils;
	} );

	test( 'a track keeps its tempo and dated director notes', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage( 'edit.php', 'post_type=callboard_set' );
		await page
			.locator( '.wp-list-table tbody tr', { hasText: 'Demo Set' } )
			.first()
			.locator( 'a.row-title' )
			.click();
		const first = page.locator( '#callboard-tracks li' ).first();
		await first.locator( 'summary' ).click();
		await first.locator( 'input[type=number]' ).fill( '100' );
		await first.locator( 'textarea' ).fill( '0:03 Softer here' );
		await page.click( '#publish' );
		await expect( page.locator( '#message' ) ).toContainText( /updated/i );
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
		// put it back for the other tests
		await page.goBack();
		const back = page.locator( '#callboard-tracks li' ).first();
		await back.locator( 'input[type=number]' ).fill( '' );
		await back.locator( 'textarea' ).fill( '' );
		await page.click( '#publish' );
		await expect( page.locator( '#message' ) ).toContainText( /updated/i );
	} );

	test( 'the import page queues a YouTube request', async ( {
		admin,
		page,
	} ) => {
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
			hasText: 'Demo Set',
		} );
		await demo.locator( 'summary' ).click();
		await demo.locator( 'input[type=checkbox]' ).nth( 2 ).check(); // Für Elise
		await page.click( '#publish' );
		await page.waitForURL( /post\.php\?post=\d+&action=edit&message=/ );
		await expect( page.locator( '#callboard-where' ) ).toHaveValue( 'Pit' );

		await page.goto( '/' );
		const call = page.locator( '.call', { hasText: 'Act II sitzprobe' } );
		await expect( call ).toBeVisible();
		await expect( call.locator( '.call-rel' ) ).toContainText( /in|days/ );
		await expect( call.locator( '.call-where' ) ).toHaveText( 'Pit' );
		await expect( call.locator( '.call-numbers a' ) ).toHaveText(
			'Für Elise'
		);
		await call.locator( '.call-numbers a' ).click();
		await expect( page ).toHaveURL( /\/demo-set\/$/ );
		await expect( page.locator( '#now-title' ) ).toContainText(
			'Für Elise'
		);

		// leave the board as it was
		await admin.visitAdminPage( 'edit.php', 'post_type=callboard_call' );
		const rows = page.locator( '#the-list tr', {
			hasText: 'Act II sitzprobe',
		} );
		await expect(
			rows.first().locator( '.column-callboard_when' )
		).toContainText( /\(in / );
		while ( ( await rows.count() ) > 0 ) {
			const n = await rows.count();
			await rows.first().hover();
			await rows.first().locator( 'a.submitdelete' ).click();
			await expect( rows ).toHaveCount( n - 1 );
		}
	} );
} );
