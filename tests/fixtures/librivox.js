/* eslint-disable no-console -- a command-line script; it talks. */
/* Fixture audio for the demo set: Shakespeare's sonnets, read by people.

   LibriVox recordings are public domain in the USA — sellable, broadcastable, remixable, with no
   attribution required. That is a cleaner footing than any Creative Commons licence, which always
   carries an obligation that travels with the file. We credit the readers anyway, in the same
   manifest fields the app already renders in a set's footer, because they earned it.

   The text is Shakespeare, published 1609. The recordings are volunteers reading it aloud. Nothing
   here needs clearing, which matters: this audio is committed to a public repository, served from
   the Pages site, and loaded into the Playground demo.

   A clip starts after the reader's introduction rather than at zero, so the first thing you hear is
   the verse. Titles are the section's own — "Sonnets 1-10" — because that is what the recording is;
   guessing which sonnet a window lands on would put a wrong number under a real reading.

   Run: node tests/fixtures/librivox.js (needs ffmpeg, ffprobe and a network connection). */
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );
const { execFileSync } = require( 'child_process' );

const BOOK = 229; // Shakespeare's Sonnets
const ITEM = 'sonnets_librivox';
const WANT = 10; // sections, one track each
const CLIP = 40; // seconds
const ROOT = path.join( __dirname, 'callboard' );
const SOURCE = 'https://librivox.org/sonnets-by-william-shakespeare/';

const sh = ( cmd, args ) =>
	execFileSync( cmd, args, { stdio: [ 'ignore', 'pipe', 'ignore' ], maxBuffer: 1 << 28 } );

/* Where the reader stops introducing and starts reading: the first real pause after the opening.
   silencedetect reports on stderr at info level, so this reads both streams. */
function introEnds( file ) {
	// silencedetect reports on stderr, which execFileSync does not return, so fold it into stdout.
	const out = execFileSync(
		'/bin/sh',
		[
			'-c',
			`ffmpeg -i "${ file }" -af silencedetect=noise=-38dB:d=1.2 -f null - 2>&1`,
		],
		{ maxBuffer: 1 << 28 }
	).toString();
	const ends = [ ...out.matchAll( /silence_end: ([0-9.]+)/g ) ].map( ( m ) => Number( m[ 1 ] ) );
	return ends.find( ( t ) => t > 12 && t < 90 ) ?? 25;
}

/* Same envelope the plugin measures on import, so the waveform is right without a second pass. */
function levels( file ) {
	const pcm = sh( 'ffmpeg', [ '-v', 'error', '-i', file, '-ac', '1', '-ar', '1000', '-f', 'u8', '-' ] );
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
	return v.map( ( x ) => Math.min( 9, Math.round( 9 * Math.sqrt( x / peak ) ) ) ).join( '' );
}

const api = JSON.parse(
	sh( 'curl', [ '-sL', `https://librivox.org/api/feed/audiobooks/?id=${ BOOK }&format=json&extended=1` ] ).toString()
);
const sections = ( api.books[ 0 ].sections || [] ).slice( 0, WANT );
console.log( `${ api.books[ 0 ].title }: taking ${ sections.length } sections\n` );

const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'callboard-lv-' ) );
const dir = path.join( ROOT, 'demo-set' );
fs.mkdirSync( dir, { recursive: true } );
for ( const f of fs.readdirSync( dir ) ) {
	if ( /\.(mp3|json)$/.test( f ) ) {
		fs.unlinkSync( path.join( dir, f ) );
	}
}

const tracks = [];
const lv = {};
sections.forEach( ( s, k ) => {
	const n = String( k + 1 ).padStart( 2, '0' );
	const src = path.join( tmp, `${ n }.mp3` );
	sh( 'curl', [ '-sL', `https://archive.org/download/${ ITEM }/sonnets_${ n }_shakespeare_64kb.mp3`, '-o', src ] );

	const from = introEnds( src );
	const id = `son${ n }`;
	const title = String( s.title ).replace( /-/g, '–' ); // "Sonnets 1-10" reads better with a range dash
	const file = `${ n } - ${ title } [${ id }].mp3`;
	const out = path.join( dir, file );
	const readers = ( s.readers || [] ).map( ( r ) => r.display_name ).filter( Boolean );

	sh( 'ffmpeg', [
		'-v', 'error', '-y',
		'-ss', String( from ),
		'-t', String( CLIP ),
		'-i', src,
		'-af', `afade=t=in:d=0.4,afade=t=out:st=${ CLIP - 1.2 }:d=1.2,loudnorm=I=-18:TP=-1.5:LRA=11`,
		'-ac', '1', '-ar', '32000', '-b:a', '64k',
		'-id3v2_version', '3',
		'-metadata', `title=${ title }`,
		'-metadata', `artist=${ readers.join( ', ' ) || 'LibriVox' }`,
		'-metadata', 'album=Shakespeare’s Sonnets',
		out,
	] );
	const duration = Math.round(
		parseFloat( sh( 'ffprobe', [ '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out ] ).toString() )
	);
	lv[ id ] = levels( out );
	tracks.push( {
		index: k + 1,
		id,
		title,
		file,
		duration,
		url: SOURCE,
		// The footer aggregates uploaders across a set, so ten names would be a comma soup and one
		// of these sections is read by six people. One credit, linking to the page that names them all.
		uploader: 'LibriVox volunteers',
		uploader_url: SOURCE,
	} );
	console.log( `${ n }  ${ title.padEnd( 16 ) } from ${ String( Math.round( from ) ).padStart( 3 ) }s  ${ duration }s  ${ readers.join( ', ' ) }` );
} );

const write = ( f, d, pretty ) =>
	fs.writeFileSync( f, ( pretty ? JSON.stringify( d, null, '\t' ) : JSON.stringify( d ) ) + '\n' );
write(
	path.join( dir, 'manifest.json' ),
	{
		name: 'Shakespeare’s Sonnets',
		slug: 'demo-set',
		order: -1,
		playlist_url: SOURCE,
		curator: '',
		curator_url: SOURCE,
		tracks,
	},
	true
);
write( path.join( dir, 'levels.json' ), lv );
fs.rmSync( tmp, { recursive: true, force: true } );
console.log( `\n${ tracks.length } tracks into ${ path.relative( process.cwd(), dir ) }` );
