/* eslint-disable no-console -- a command-line script; it talks. */
/* Retake the landing-page screenshots from the running wp-env site.
 *
 * The phone shots are 390x664 at device pixel ratio 2, which is the 780x1328 the page expects.
 * Run wp-env first, then: node scripts/screenshots.js [baseURL]
 */
const path = require( 'path' );
const { chromium } = require( '@playwright/test' );

const BASE = process.argv[ 2 ] || 'http://localhost:8893';
const OUT = path.join( __dirname, '..', 'site' );
const PHONE = { width: 390, height: 664 };

( async () => {
	const browser = await chromium.launch();

	const phone = async ( name, scheme, visit ) => {
		const ctx = await browser.newContext( {
			viewport: PHONE,
			deviceScaleFactor: 2,
			colorScheme: scheme,
			isMobile: true,
			hasTouch: true,
		} );
		const page = await ctx.newPage();
		await visit( page );
		await page.waitForTimeout( 1200 ); // let the entrance animations settle
		await page.screenshot( { path: path.join( OUT, name ) } );
		await ctx.close();
		console.log( `${ name }  ${ PHONE.width * 2 }x${ PHONE.height * 2 }  ${ scheme }` );
	};

	await phone( 'home-light.png', 'light', async ( p ) => {
		await p.goto( `${ BASE }/`, { waitUntil: 'networkidle' } );
	} );
	await phone( 'yours-1.png', 'dark', async ( p ) => {
		await p.goto( `${ BASE }/`, { waitUntil: 'networkidle' } );
	} );
	await phone( 'set-light.png', 'light', async ( p ) => {
		await p.goto( `${ BASE }/demo-set/`, { waitUntil: 'networkidle' } );
	} );
	await phone( 'set-dark.png', 'dark', async ( p ) => {
		await p.goto( `${ BASE }/demo-set/`, { waitUntil: 'networkidle' } );
		await p.locator( '.track' ).first().click(); // the deck only shows with a track loaded
		await p.waitForTimeout( 900 );
	} );

	// The admin shot: a call open in the editor, at the desktop size the page uses.
	const desk = await browser.newContext( {
		viewport: { width: 1280, height: 960 },
		deviceScaleFactor: 2,
	} );
	const page = await desk.newPage();
	await page.goto( `${ BASE }/wp-login.php`, { waitUntil: 'networkidle' } );
	await page.fill( '#user_login', 'admin' );
	await page.fill( '#user_pass', 'password' );
	await page.click( '#wp-submit' );
	await page.waitForLoadState( 'networkidle' );
	await page.goto( `${ BASE }/wp-admin/edit.php?post_type=callboard_call`, {
		waitUntil: 'networkidle',
	} );
	const row = page.locator( '.wp-list-table tbody a.row-title' ).first();
	if ( await row.count() ) {
		await row.click();
		await page.waitForLoadState( 'networkidle' );
		await page.waitForTimeout( 1500 );
		await page.screenshot( { path: path.join( OUT, 'admin-call.png' ) } );
		console.log( 'admin-call.png  2560x1920' );
	} else {
		console.log( 'admin-call.png  SKIPPED: no call posted' );
	}
	await desk.close();
	await browser.close();
} )();
