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
} );
