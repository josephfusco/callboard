/* Demo set for tests and Playground: sawtooth-based tones, one modulation pattern per track, titled by what they do.
   Run: node tests/fixtures/synth.js (needs ffmpeg on PATH). Rewrites demo-set/*.mp3 and manifest.json. */
const fs = require( 'fs' );
const path = require( 'path' );
const { execFileSync } = require( 'child_process' );

const RATE = 22050;
const ROOT = path.join( __dirname, 'callboard' );
const saw = ( ph ) => 2 * ( ph - Math.floor( ph + 0.5 ) );
const sq = ( ph, duty = 0.5 ) => ( ph - Math.floor( ph ) < duty ? 1 : -1 );
const note = ( n ) => 110 * Math.pow( 2, n / 12 );

/* Each pattern is a function of time (seconds) returning a sample in [-1, 1]. State lives in closures. */
const TRACKS = [
	{
		id: 'saw01',
		title: 'Sawtooth, steady',
		secs: 8,
		gen: () => ( t ) => 0.5 * saw( t * 220 ),
	},
	{
		id: 'saw02',
		title: 'Tremolo, 4 Hz',
		secs: 8,
		gen: () => ( t ) =>
			0.5 *
			saw( t * 220 ) *
			( 0.55 + 0.45 * Math.sin( 2 * Math.PI * 4 * t ) ),
	},
	{
		id: 'saw03',
		title: 'Vibrato, 6 Hz',
		secs: 8,
		gen: () => {
			let ph = 0;
			return ( t ) => {
				ph +=
					( 220 * ( 1 + 0.03 * Math.sin( 2 * Math.PI * 6 * t ) ) ) /
					RATE;
				return 0.5 * saw( ph );
			};
		},
	},
	{
		id: 'saw04',
		title: 'Ring modulation, 30 Hz',
		secs: 8,
		gen: () => ( t ) =>
			0.5 * saw( t * 220 ) * Math.sin( 2 * Math.PI * 30 * t ),
	},
	{
		id: 'saw05',
		title: 'Low-pass sweep',
		secs: 8,
		gen: () => {
			let y = 0;
			return ( t ) => {
				const cut =
					200 +
					3000 * ( 0.5 - 0.5 * Math.cos( ( 2 * Math.PI * t ) / 4 ) );
				const a = 1 - Math.exp( ( -2 * Math.PI * cut ) / RATE );
				y += a * ( 0.6 * saw( t * 110 ) - y );
				return y;
			};
		},
	},
	{
		id: 'saw06',
		title: 'Pulse width modulation',
		secs: 8,
		gen: () => ( t ) =>
			0.4 * sq( t * 165, 0.5 + 0.45 * Math.sin( 2 * Math.PI * 0.5 * t ) ),
	},
	{
		id: 'saw07',
		title: 'FM, two to one',
		secs: 8,
		gen: () => ( t ) => {
			const depth =
				2 * ( 0.5 - 0.5 * Math.cos( ( 2 * Math.PI * t ) / 8 ) );
			return (
				0.5 * saw( t * 220 + depth * Math.sin( 2 * Math.PI * 440 * t ) )
			);
		},
	},
	{
		id: 'saw08',
		title: 'Arpeggio, eight steps',
		secs: 8,
		gen: () => {
			const steps = [ 0, 4, 7, 12, 7, 4, 0, -5 ];
			let ph = 0;
			return ( t ) => {
				const n = steps[ Math.floor( t * 4 ) % 8 ];
				ph += note( n ) / RATE;
				const env = 1 - ( ( t * 4 ) % 1 ) * 0.6;
				return 0.5 * env * saw( ph );
			};
		},
	},
	{
		id: 'saw09',
		title: 'Plucked, decay envelope',
		secs: 8,
		gen: () => ( t ) => {
			const k = ( t * 2 ) % 1;
			return (
				0.6 *
				Math.exp( -6 * k ) *
				saw( t * note( [ 0, 3, 7, 10 ][ Math.floor( t * 2 ) % 4 ] ) )
			);
		},
	},
	{
		id: 'saw10',
		title: 'Bitcrush, four bits',
		secs: 6,
		gen: () => ( t ) => Math.round( 0.5 * saw( t * 220 ) * 8 ) / 8,
	},
];

function wav( samples ) {
	const buf = Buffer.alloc( 44 + samples.length * 2 );
	buf.write( 'RIFF', 0 );
	buf.writeUInt32LE( 36 + samples.length * 2, 4 );
	buf.write( 'WAVE', 8 );
	buf.write( 'fmt ', 12 );
	buf.writeUInt32LE( 16, 16 );
	buf.writeUInt16LE( 1, 20 );
	buf.writeUInt16LE( 1, 22 );
	buf.writeUInt32LE( RATE, 24 );
	buf.writeUInt32LE( RATE * 2, 28 );
	buf.writeUInt16LE( 2, 32 );
	buf.writeUInt16LE( 16, 34 );
	buf.write( 'data', 36 );
	buf.writeUInt32LE( samples.length * 2, 40 );
	samples.forEach( ( s, i ) =>
		buf.writeInt16LE( Math.max( -1, Math.min( 1, s ) ) * 32767, 44 + i * 2 )
	);
	return buf;
}

/* A second set with one long track that has lyrics, notes and a tempo; a third with nothing in it. */
const SOLO = [
	{
		id: 'solo01',
		title: 'Vibrato over tremolo, long form',
		secs: 24,
		gen: () => {
			let ph = 0;
			return ( t ) => {
				ph +=
					( 165 * ( 1 + 0.02 * Math.sin( 2 * Math.PI * 5 * t ) ) ) /
					RATE;
				const trem =
					0.6 + 0.4 * Math.sin( 2 * Math.PI * ( 0.5 + t / 8 ) * t );
				const rest = t > 8 && t < 11 ? 0 : 1;
				return 0.5 * saw( ph ) * trem * rest;
			};
		},
	},
];
const SETS = [
	{ slug: 'demo-set', tracks: TRACKS },
	{ slug: 'one-track', tracks: SOLO },
	{ slug: 'empty-set', tracks: [] },
];
for ( const set of SETS ) {
	render( path.join( ROOT, set.slug ), set.tracks );
}
function render( OUT, LIST ) {
	fs.mkdirSync( OUT, { recursive: true } );
	for ( const f of fs.readdirSync( OUT ) ) {
		if ( f.endsWith( '.mp3' ) ) {
			fs.unlinkSync( path.join( OUT, f ) );
		}
	}
	const tracks = LIST.map( ( tr, i ) => {
		const n = tr.secs * RATE,
			f = tr.gen(),
			s = new Float32Array( n );
		for ( let k = 0; k < n; k++ ) {
			const t = k / RATE,
				fade = Math.min( 1, t / 0.02, ( tr.secs - t ) / 0.05 ); // no clicks at the ends
			s[ k ] = f( t ) * fade;
		}
		const index = String( i + 1 ).padStart( 2, '0' );
		const file = `${ index } - ${ tr.title } [${ tr.id }].mp3`;
		const tmp = path.join( OUT, `${ tr.id }.wav` );
		fs.writeFileSync( tmp, wav( s ) );
		execFileSync( 'ffmpeg', [
			'-v',
			'error',
			'-y',
			'-i',
			tmp,
			'-codec:a',
			'libmp3lame',
			'-b:a',
			'48k',
			path.join( OUT, file ),
		] );
		fs.unlinkSync( tmp );
		return {
			index: i + 1,
			id: tr.id,
			title: `${ i + 1 }. ${ tr.title } (Demo OBC)`,
			file,
			duration: tr.secs,
			url: `https://www.youtube.com/watch?v=${ tr.id }`,
			uploader: 'Demo Uploader',
			uploader_url: 'https://www.youtube.com/@uploader',
		};
	} );
	const manifest = JSON.parse(
		fs.readFileSync( path.join( OUT, 'manifest.json' ), 'utf8' )
	);
	manifest.tracks = tracks;
	fs.writeFileSync(
		path.join( OUT, 'manifest.json' ),
		JSON.stringify( manifest, null, '\t' ) + '\n'
	);
	process.stdout.write( `${ tracks.length } tracks written to ${ OUT }\n` );
}
