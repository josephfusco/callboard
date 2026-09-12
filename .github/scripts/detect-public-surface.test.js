'use strict';

const { test } = require( 'node:test' );
const assert = require( 'node:assert/strict' );

const findSurfaces = require( './detect-public-surface.js' );
const {
	newSurfaces,
	ownConstants,
	formatAudit,
	formatComment,
	isScanned,
	MARKER,
} = findSurfaces;

const ids = ( surfaces ) => surfaces.map( ( s ) => s.id );
const php = ( source ) =>
	ids( findSurfaces( source, 'includes/class-frontend.php' ) );
const js = ( source ) =>
	ids( findSurfaces( source, 'assets/app.js' ) );
const surface = ( id, documented = false ) => ( { id, documented } );

// ---------------------------------------------------------------------------
// PHP hooks
// ---------------------------------------------------------------------------

test( 'reads filters and actions apart', () => {
	assert.deepEqual(
		php( "apply_filters( 'callboard_app_data', 30 );" ),
		[ 'filter:callboard_app_data' ]
	);
	assert.deepEqual( php( "do_action( 'callboard_call_published' );" ), [
		'action:callboard_call_published',
	] );
} );

test( 'reads the _ref_array and _deprecated variants', () => {
	assert.deepEqual(
		php(
			"apply_filters_ref_array( 'a', $x ); do_action_deprecated( 'b', $y, '1.0' );"
		),
		[ 'filter:a', 'action:b' ]
	);
} );

test( 'keeps an interpolated hook name whole', () => {
	assert.deepEqual( php( 'do_action( "callboard_{$slug}_imported" );' ), [
		'action:callboard_{$slug}_imported',
	] );
} );

// ---------------------------------------------------------------------------
// Constants, REST, CLI
// ---------------------------------------------------------------------------

test( 'counts a guarded constant, ignores a bare define and core guards', () => {
	const source = `
    if ( ! defined( 'ABSPATH' ) ) {
      exit;
    }
    if ( ! defined( 'CALLBOARD_CACHE_TTL' ) ) {
      define( 'CALLBOARD_CACHE_TTL', 30 );
    }
    define( 'CALLBOARD_INTERNAL', 5 );
  `;
	assert.deepEqual( php( source ), [ 'constant:CALLBOARD_CACHE_TTL' ] );
} );

test( 'counts a constant the plugin only ever reads', () => {
	// Nothing here defines it: a site sets it in `wp-config.php` or it stays
	// undefined, which is what makes the name a promise in the first place.
	const source = `
    if ( defined( 'CALLBOARD_DISABLE_OFFLINE' ) && CALLBOARD_DISABLE_OFFLINE ) {
      return;
    }
  `;
	assert.deepEqual( php( source ), [ 'constant:CALLBOARD_DISABLE_OFFLINE' ] );
} );

test( "a name outside the plugin's prefix is still the plugin's promise", () => {
	assert.deepEqual( php( "if ( defined( 'CALLBOARD_DEBUG' ) ) {}" ), [
		'constant:CALLBOARD_DEBUG',
	] );
} );

test( "core constants are WordPress's promise, in either form", () => {
	const source = `
    if ( ! defined( 'ABSPATH' ) ) {
      exit;
    }
    if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
      exit;
    }
    if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {}
    if ( defined( 'WP_CLI' ) && WP_CLI ) {}
    if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {}
  `;
	assert.deepEqual( php( source ), [] );
} );

test( 'a constant defined outright stays internal, however often it is read', () => {
	const source = `
    define( 'CALLBOARD_MAX_SUBSCRIBERS', 191 );
    if ( defined( 'CALLBOARD_MAX_SUBSCRIBERS' ) ) {
      $max = CALLBOARD_MAX_SUBSCRIBERS;
    }
  `;
	assert.deepEqual( php( source ), [] );
} );

test( 'a guarded define and a read of it are the one surface', () => {
	const source = `
    if ( ! defined( 'CALLBOARD_CACHE_TTL' ) ) {
      define( 'CALLBOARD_CACHE_TTL', 150 );
    }
    if ( defined( 'CALLBOARD_CACHE_TTL' ) && CALLBOARD_CACHE_TTL ) {
      $ttl = CALLBOARD_CACHE_TTL;
    }
  `;
	assert.deepEqual(
		ids(
			newSurfaces( [], findSurfaces( source, 'includes/class-frontend.php' ) )
		),
		[ 'constant:CALLBOARD_CACHE_TTL' ]
	);
} );

test( 'a docblock above the read documents the constant', () => {
	const [ read ] = findSurfaces(
		`/**
 * Whether offline saving is switched off for the whole site.
 */
if ( defined( 'CALLBOARD_DISABLE_OFFLINE' ) && CALLBOARD_DISABLE_OFFLINE ) {}`,
		'includes/class-frontend.php'
	);
	assert.equal( read.id, 'constant:CALLBOARD_DISABLE_OFFLINE' );
	assert.equal( read.documented, true );
} );

test( '@access private withdraws a constant the same way', () => {
	const source = `/**
 * Internal kill switch.
 *
 * @since 0.1.0
 * @access private
 */
if ( defined( 'CALLBOARD_INTERNAL_OFF' ) && CALLBOARD_INTERNAL_OFF ) {}`;
	assert.deepEqual( php( source ), [] );
	assert.deepEqual( php( source.replace( ' * @access private\n', '' ) ), [
		'constant:CALLBOARD_INTERNAL_OFF',
	] );
} );

test( 'the core list covers the constants a plugin actually guards on', () => {
	const source = `
    if ( defined( 'SHORTINIT' ) && SHORTINIT ) {}
    if ( defined( 'WP_USE_THEMES' ) && WP_USE_THEMES ) {}
    if ( defined( 'WP_ALLOW_REPAIR' ) && WP_ALLOW_REPAIR ) {}
    if ( defined( 'WP_AUTO_UPDATE_CORE' ) ) {}
    if ( defined( 'DISALLOW_FILE_MODS' ) && DISALLOW_FILE_MODS ) {}
    if ( defined( 'DAY_IN_SECONDS' ) ) {}
    if ( defined( 'DB_HOST' ) ) {}
    if ( defined( 'COOKIEHASH' ) ) {}
    if ( defined( 'SUNRISE' ) && SUNRISE ) {}
  `;
	assert.deepEqual( php( source ), [] );
} );

test( "a constant defined in one file is the plugin's own in every other", () => {
	const bootstrap = "define( 'CALLBOARD_MAX_SUBSCRIBERS', 191 );";
	const reader = "if ( defined( 'CALLBOARD_MAX_SUBSCRIBERS' ) ) {}";

	// Alone, the reading file cannot tell an internal from a promise.
	assert.deepEqual( php( reader ), [
		'constant:CALLBOARD_MAX_SUBSCRIBERS',
	] );

	// Weighed with the file that defines it, the way the CLI weighs a whole ref.
	const own = ownConstants( [ bootstrap, reader ] );
	assert.deepEqual(
		ids( findSurfaces( reader, 'includes/class-frontend.php', own ) ),
		[]
	);
} );

test( 'a guard anywhere in the ref keeps the constant settable', () => {
	const bootstrap = `if ( ! defined( 'CALLBOARD_CACHE_TTL' ) ) {
      define( 'CALLBOARD_CACHE_TTL', 150 );
    }`;
	const reader = "if ( defined( 'CALLBOARD_CACHE_TTL' ) ) {}";
	const own = ownConstants( [ bootstrap, reader ] );

	assert.deepEqual(
		ids( findSurfaces( reader, 'includes/class-frontend.php', own ) ),
		[ 'constant:CALLBOARD_CACHE_TTL' ]
	);
} );

test( 'a private declaration stays private where the constant is read again', () => {
	const source = `/**
 * Internal kill switch.
 *
 * @since 0.1.0
 * @access private
 */
if ( ! defined( 'CALLBOARD_INTERNAL' ) ) {
	define( 'CALLBOARD_INTERNAL', 5 );
}

if ( defined( 'CALLBOARD_INTERNAL' ) && CALLBOARD_INTERNAL ) {
	return;
}`;
	assert.deepEqual( php( source ), [] );
} );

test( 'reads a route through a variable namespace', () => {
	assert.deepEqual(
		php( "register_rest_route( $this->namespace, '/board', array() );" ),
		[ 'rest:/board' ]
	);
} );

test( 'reads a concatenated route whole, not just its first literal', () => {
	const source = `register_rest_route(
    $this->namespace,
    '/' . $this->rest_base . '/rooms',
    array()
  );`;
	assert.deepEqual( php( source ), [ 'rest:/$this->rest_base/rooms' ] );
} );

test( 'reads a CLI command', () => {
	assert.deepEqual( php( "WP_CLI::add_command( 'callboard', $class );" ), [
		'cli:callboard',
	] );
} );

// ---------------------------------------------------------------------------
// JavaScript
// ---------------------------------------------------------------------------

test( 'reads a browser global the script assigns', () => {
	assert.deepEqual( js( 'window.CALLBOARD_createDeck = function () {};' ), [
		'js-global:window.CALLBOARD_createDeck',
	] );
} );

test( 'a comparison against a global is not a declaration', () => {
	assert.deepEqual(
		js( 'if ( window.CALLBOARD_thing === undefined ) {}' ),
		[]
	);
} );

test( 'reads wp.hooks calls', () => {
	assert.deepEqual( js( "wp.hooks.applyFilters( 'callboard.track', x );" ), [
		'js-filter:callboard.track',
	] );
} );

test( 'php rules do not run against a js file, or the reverse', () => {
	assert.deepEqual( js( "apply_filters( 'not_php', 1 );" ), [] );
	assert.deepEqual( php( 'window.CALLBOARD_thing = 1;' ), [] );
} );

// ---------------------------------------------------------------------------
// @private
// ---------------------------------------------------------------------------

test( 'a @private docblock keeps an internal seam out', () => {
	const source = `/**
 * Builds an avatar stack.
 *
 * @private
 */
window.CALLBOARD_buildWaveform = function ( users, max ) {};`;
	assert.deepEqual( js( source ), [] );
	assert.deepEqual( js( source.replace( ' * @private\n', '' ) ), [
		'js-global:window.CALLBOARD_buildWaveform',
	] );
} );

test( '@private applies to the statement it documents, not the next one', () => {
	const source = `/**
 * @private
 */
window.CALLBOARD_internal = function () {};
window.CALLBOARD_public = function () {};`;
	assert.deepEqual( js( source ), [ 'js-global:window.CALLBOARD_public' ] );
} );

test( '@access private withdraws a surface the same way', () => {
	const source = `/**
 * Fires internally.
 *
 * @since 0.1.0
 * @access private
 */
do_action( 'callboard_internal' );`;
	assert.deepEqual( php( source ), [] );
	assert.deepEqual( php( source.replace( ' * @access private\n', '' ) ), [
		'action:callboard_internal',
	] );
} );

test( '@private reads the same above a php hook', () => {
	const source = `/**
 * Fires internally.
 *
 * @private
 */
do_action( 'callboard_internal' );`;
	assert.deepEqual( php( source ), [] );
} );

// ---------------------------------------------------------------------------
// The documented bar
// ---------------------------------------------------------------------------

test( 'a docblock saying what the hook is for documents it, through the assignment', () => {
	const [ long ] = findSurfaces(
		`/**
 * Filters the default TTL.
 *
 * @since 0.1.0
 * @param int $ttl Seconds.
 */
$ttl = apply_filters( 'callboard_app_data', 30 );`,
		'includes/class-frontend.php'
	);
	const [ short ] = findSurfaces(
		"/** Filters the TTL. */\napply_filters( 'a', 1 );",
		'includes/class-frontend.php'
	);
	assert.equal( long.documented, true );
	assert.equal( short.documented, true );
} );

test( 'tags with no sentence are a signature, not a write-up', () => {
	const [ tagged ] = findSurfaces(
		"/**\n * @since 0.1.0\n */\napply_filters( 'a', 1 );",
		'includes/class-frontend.php'
	);
	const [ bare ] = findSurfaces(
		"apply_filters( 'a', 1 );",
		'includes/class-frontend.php'
	);
	assert.equal( tagged.documented, false );
	assert.equal( bare.documented, false );
} );

// ---------------------------------------------------------------------------
// newSurfaces
// ---------------------------------------------------------------------------

test( 'a hook moved to another file is not new', () => {
	// The identifier carries no path, so both sides collapse to the same entry.
	const base = findSurfaces( "apply_filters( 'a', 1 );", 'includes/one.php' );
	const head = findSurfaces( "apply_filters( 'a', 1 );", 'includes/two.php' );
	assert.deepEqual( newSurfaces( base, head ), [] );
} );

test( 'reports additions, ignores removals, and sorts', () => {
	const fresh = newSurfaces(
		[ surface( 'filter:a' ), surface( 'action:gone' ) ],
		[ surface( 'filter:a' ), surface( 'filter:c' ), surface( 'action:b' ) ]
	);
	assert.deepEqual( ids( fresh ), [ 'action:b', 'filter:c' ] );
} );

test( 'one write-up covers a hook fired from two places', () => {
	const [ only ] = newSurfaces(
		[],
		[ surface( 'filter:a' ), surface( 'filter:a', true ) ]
	);
	assert.equal( only.documented, true );
} );

// ---------------------------------------------------------------------------
// isScanned
// ---------------------------------------------------------------------------

test( 'scans shipped code only', () => {
	for ( const path of [
		'includes/class-frontend.php',
		'callboard.php',
		'assets/app.js',
	] ) {
		assert.equal( isScanned( path ), true, path );
	}
	// `tests/` is the loudest false-positive source: it calls hooks constantly
	// without publishing any.
	for ( const path of [
		'tests/e2e/player.spec.js',
		'assets/app.test.js',
		'.github/scripts/detect-public-surface.js',
	] ) {
		assert.equal( isScanned( path ), false, path );
	}
} );

// ---------------------------------------------------------------------------
// formatAudit
// ---------------------------------------------------------------------------

test( 'leads each entry with its kind and qualifies the undocumented ones', () => {
	const report = formatAudit( [
		surface( 'filter:callboard_new_hook' ),
		surface( 'action:b', true ),
	] );
	assert.equal(
		report,
		'- (filter) `callboard_new_hook` - *requires documentation*\n- (action) `b`'
	);
} );

test( 'splits on the first colon so a namespaced hook name survives', () => {
	assert.match(
		formatAudit( [ surface( 'js-filter:callboard.track', true ) ] ),
		/\(js-filter\) `callboard\.track`/
	);
} );

// ---------------------------------------------------------------------------
// formatComment
// ---------------------------------------------------------------------------

test( 'leads with the marker so the workflow can find its own comment', () => {
	assert.ok(
		formatComment( [ surface( 'filter:a' ) ] ).startsWith(
			`${ MARKER }\n### 🚩 New public surface\n`
		)
	);
} );

test( 'agrees in number', () => {
	const two = formatComment( [
		surface( 'filter:a', true ),
		surface( 'action:b', true ),
	] );
	assert.match( two, /^### 🚩 New public surfaces$/m );
} );
