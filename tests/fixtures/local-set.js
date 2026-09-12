/* eslint-disable no-console -- a command-line script; it talks. */
/* Build a set from audio you already have, for listening to the app on your own machine.

   The folder it writes is gitignored and never leaves this computer: not committed, not served from
   Pages, not in the Playground demo, not in the plugin zip. What you listen to locally is your business;
   what the repository ships has to be licensed for anyone to use and sell, which is why the committed
   fixtures are original.

   Usage:  node tests/fixtures/local-set.js <folder-of-audio> [--name="Whatever"] [--slug=mine]

   Then:   npx wp-env run tests-cli wp callboard import
*/
const fs = require( 'fs' );
const path = require( 'path' );
const { execFileSync } = require( 'child_process' );

const sh = ( cmd, args ) =>
	execFileSync( cmd, args, {
		stdio: [ 'ignore', 'pipe', 'ignore' ],
		maxBuffer: 1 << 28,
	} );

// The plugin measures this on import; matching it here means the waveform is right straight away.
function levels( file ) {
	const pcm = sh( 'ffmpeg', [
		'-v', 'error', '-i', file, '-ac', '1', '-ar', '1000', '-f', 'u8', '-',
	] );
	const n = Math.floor( pcm.length / 100 );
	const v = [];
	let peak = 1;
	for ( let k = 0; k < n; k++ ) {
		let sum = 0;
		for ( let j = 0; j < 100; j++ ) {
			sum += Math.abs( pcm[ k * 100 + j ] - 128 );
		}
		v[ k ] = sum / 100;
		peak = Math.max( peak, v[ k ] );
	}
	return v
		.map( ( x ) => Math.min( 9, Math.round( 9 * Math.sqrt( x / peak ) ) ) )
		.join( '' );
}
const probe = ( file, entry ) =>
	sh( 'ffprobe', [
		'-v', 'error', '-show_entries', entry, '-of', 'csv=p=0', file,
	] ).toString().trim();

const args = process.argv.slice( 2 );
const src = args.find( ( a ) => ! a.startsWith( '--' ) );
const flag = ( name, fallback ) => {
	const hit = args.find( ( a ) => a.startsWith( `--${ name }=` ) );
	return hit ? hit.slice( name.length + 3 ).replace( /^"|"$/g, '' ) : fallback;
};
if ( ! src || ! fs.existsSync( src ) ) {
	console.error(
		'Usage: node tests/fixtures/local-set.js <folder-of-audio> [--name="My Set"] [--slug=mine]'
	);
	process.exit( 1 );
}

const slug = flag( 'slug', 'mine' ).replace( /[^a-z0-9-]/gi, '-' ).toLowerCase();
const name = flag( 'name', 'On This Machine' );
const dir = path.join( __dirname, 'callboard', slug );
fs.mkdirSync( dir, { recursive: true } );
for ( const f of fs.readdirSync( dir ) ) {
	fs.unlinkSync( path.join( dir, f ) );
}

const audio = fs
	.readdirSync( src )
	.filter( ( f ) => /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test( f ) )
	.sort();
if ( ! audio.length ) {
	console.error( `No audio in ${ src }` );
	process.exit( 1 );
}

const tracks = [];
const lv = {};
audio.forEach( ( f, k ) => {
	const from = path.join( src, f );
	const to = path.join( dir, f );
	fs.copyFileSync( from, to );
	const id = `local${ String( k + 1 ).padStart( 2, '0' ) }`;
	// The tag if the file has one, otherwise the file name without its number or extension.
	const tagged = probe( to, 'format_tags=title' );
	const title =
		tagged ||
		path.basename( f, path.extname( f ) ).replace( /^\s*\d+[\s.\-_]*/, '' );
	lv[ id ] = levels( to );
	tracks.push( {
		index: k + 1,
		id,
		title,
		file: f,
		duration: Math.round( parseFloat( probe( to, 'format=duration' ) ) || 0 ),
		url: '',
		uploader: probe( to, 'format_tags=artist' ) || '',
		uploader_url: '',
	} );
	console.log( `${ String( k + 1 ).padStart( 2, '0' ) }  ${ title }` );
} );

const write = ( file, data, pretty ) =>
	fs.writeFileSync(
		file,
		( pretty ? JSON.stringify( data, null, '\t' ) : JSON.stringify( data ) ) + '\n'
	);
write(
	path.join( dir, 'manifest.json' ),
	{ name, slug, order: -5, playlist_url: '', curator: '', curator_url: '', tracks },
	true
);
write( path.join( dir, 'levels.json' ), lv );

console.log(
	`\n${ tracks.length } tracks into ${ path.relative( process.cwd(), dir ) } (gitignored)\n` +
		'Now: npx wp-env run tests-cli wp callboard import'
);
