/* eslint-disable no-console -- a command-line script; it talks. */
/* Fixture audio for the tests and the Playground demo: rehearsal tracks for a show that does not exist.

   Every note here is original and rendered by the synth below, so the repository owns the audio outright and
   nothing in it needs a licence, an attribution, or a clearance. That matters more than it sounds: this audio
   is committed to a public repository, served from the Pages site, and loaded into the Playground demo.

   It is a piano, because that is what a rehearsal track is. A pianist plays the number, a guide line carries
   the tune the cast is learning, and on the ones with a tempo there is a click. No drum machine, no preset
   brass: a room with an upright in it.

   The piano is additive — a harmonic series per note, upper partials quieter and dying sooner than lower ones,
   the whole series stretched slightly the way real strings are, and a hammer thump at the front. Oscillators
   advance by rotation rather than calling Math.sin per sample, which is what makes ten songs render in seconds.

   demo-set gets one 40-second take per number. long-set (24 tracks) and one-track keep their own titles, ids
   and sidecars — lyrics, notes and tempo are keyed by id — and take windows from the same ten takes.

   Run: node tests/fixtures/rehearsal.js (needs ffmpeg and ffprobe on PATH). */
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );
const { execFileSync } = require( 'child_process' );

const ROOT = path.join( __dirname, 'callboard' );
const SR = 32000;
const LENGTH = 40;

/* ---------------------------------------------------------------- the show

   Act I of The Lantern. Melody and chords are written as `NOTE/BEATS` runs, so a number is a few lines
   rather than a few hundred; `-` is a rest. A run loops until it has filled the take.

   `click` marks the numbers a rehearsal pianist would count in — those are the ones whose manifest carries a
   tempo, so the count-in setting has something to demonstrate. */
const SHOW = [
	{
		id: 'lan01',
		title: 'Small Town, Big Sky',
		bpm: 112,
		click: true,
		melody: 'G4/1 A4/1 C5/2 B4/1 A4/1 G4/2 E4/1 G4/1 A4/2 G4/2 -/2',
		chords: 'Csus2/4 G/4 Am7/4 Fadd9/4',
		voicing: 'open',
	},
	{
		id: 'lan02',
		title: "What I Didn't Say",
		bpm: 88,
		melody: 'E4/2 G4/1 A4/1 G4/2 E4/2 D4/2 E4/2 A4/2 -/2',
		chords: 'Am7/4 Fmaj7/4 C/4 G/4',
		voicing: 'close',
	},
	{
		id: 'lan03',
		title: 'The Letter',
		bpm: 76,
		melody: 'D4/1 F4/1 A4/2 G4/1 F4/1 E4/2 D4/1 C4/1 D4/4 -/2',
		chords: 'Dm/4 Bbmaj7/4 F/4 Csus4/2 C/2',
		voicing: 'close',
	},
	{
		id: 'lan04',
		title: 'Something in the Water',
		bpm: 124,
		click: true,
		melody: 'E4/1 G4/1 B4/1 A4/1 G4/2 E4/2 D4/1 E4/1 G4/2 E4/2 -/2',
		chords: 'Em/4 C/4 G/4 D/4',
		voicing: 'open',
	},
	{
		id: 'lan05',
		title: 'Keeping Time',
		bpm: 132,
		click: true,
		melody: 'F4/1 A4/1 C5/1 A4/1 G4/2 F4/2 A4/1 G4/1 F4/2 D4/2 -/2',
		chords: 'F/4 C/4 Dm7/4 Bbadd9/4',
		voicing: 'open',
	},
	{
		id: 'lan06',
		title: 'Half a Mile from Home',
		bpm: 84,
		melody: 'D4/2 G4/2 A4/1 B4/1 A4/2 G4/2 E4/2 D4/2 -/2',
		chords: 'G/4 D/4 Em7/4 Cadd9/4',
		voicing: 'close',
	},
	{
		id: 'lan07',
		title: 'The Argument',
		bpm: 146,
		click: true,
		melody: 'A4/1 A4/1 C5/1 B4/1 A4/1 G4/1 A4/2 E4/1 F4/1 G4/1 A4/1 -/4',
		chords: 'Am/2 E/2 Am/2 G/2 F/4 E/4',
		voicing: 'open',
	},
	{
		id: 'lan08',
		title: 'Lantern Light',
		bpm: 68,
		melody: 'C4/2 F4/2 E4/1 D4/1 C4/2 A3/2 C4/2 E4/2 F4/2',
		chords: 'Fmaj7/4 Am7/4 Bbmaj7/4 C/4',
		voicing: 'close',
	},
	{
		id: 'lan09',
		title: 'Everyone Knows',
		bpm: 126,
		click: true,
		melody: 'D5/1 A4/1 B4/1 D5/1 A4/2 F#4/2 G4/1 A4/1 B4/2 A4/2 -/2',
		chords: 'D/4 A/4 Bm7/4 G/4',
		voicing: 'open',
	},
	{
		id: 'lan10',
		title: 'Act I Finale',
		bpm: 100,
		melody: 'C4/1 E4/1 G4/1 C5/1 B4/2 G4/2 A4/1 F4/1 G4/2 E4/2 C4/2 D4/2 E4/2 G4/2 F4/2 E4/2 C4/2',
		chords: 'C/4 G/4 Am/4 F/4 Bb/4 F/4 Csus4/2 C/2',
		voicing: 'open',
	},
];

/* ---------------------------------------------------------------- notes and chords */
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi( name ) {
	const m = /^([A-G])([#b]?)(-?\d)$/.exec( name );
	if ( ! m ) {
		throw new Error( `bad note ${ name }` );
	}
	const accidental = m[ 2 ] === '#' ? 1 : m[ 2 ] === 'b' ? -1 : 0;
	return ( Number( m[ 3 ] ) + 1 ) * 12 + NOTE[ m[ 1 ] ] + accidental;
}
const mhz = ( n ) => 440 * Math.pow( 2, ( n - 69 ) / 12 );
const hz = ( name ) => mhz( midi( name ) );

// Enough of the contemporary vocabulary to write in it: suspensions, added ninths, sevenths.
const QUALITY = {
	'': [ 0, 4, 7 ],
	m: [ 0, 3, 7 ],
	7: [ 0, 4, 7, 10 ],
	m7: [ 0, 3, 7, 10 ],
	maj7: [ 0, 4, 7, 11 ],
	sus2: [ 0, 2, 7 ],
	sus4: [ 0, 5, 7 ],
	add9: [ 0, 4, 7, 14 ],
	6: [ 0, 4, 7, 9 ],
};
function chordNotes( name ) {
	const m = /^([A-G][#b]?)(.*)$/.exec( name );
	if ( ! m || ! ( m[ 2 ] in QUALITY ) ) {
		throw new Error( `bad chord ${ name }` );
	}
	const root = midi( m[ 1 ] + '3' );
	return QUALITY[ m[ 2 ] ].map( ( i ) => root + i );
}
// `NOTE/BEATS NOTE/BEATS` into pairs.
function run( text ) {
	return text
		.trim()
		.split( /\s+/ )
		.map( ( token ) => {
			const [ name, beats ] = token.split( '/' );
			return [ name, Number( beats ) ];
		} );
}

// A melody that does not close exactly where its harmony does will loop against the wrong chords and
// drift further every pass. That is dissonance, not variation, so it fails here rather than in someone's ears.
for ( const song of SHOW ) {
	const beats = ( text ) =>
		run( text ).reduce( ( a, [ , b ] ) => a + b, 0 );
	const m = beats( song.melody );
	const c = beats( song.chords );
	if ( m !== c ) {
		throw new Error(
			`${ song.id }: melody is ${ m } beats, harmony is ${ c }. They have to close together.`
		);
	}
}

/* ---------------------------------------------------------------- the piano

   A struck string is a harmonic series whose upper partials start quieter and die sooner, stretched a little
   because real strings are stiff, with a thump where the hammer lands. Each partial is a rotating unit vector
   rather than a Math.sin call, and a partial stops as soon as it is inaudible. */
const INHARMONIC = 0.00015;
const PARTIALS = 7;
function piano( mix, start, dur, f, gain = 0.3 ) {
	const n0 = Math.round( start * SR );
	const hold = Math.max( dur, 0.12 );
	for ( let p = 1; p <= PARTIALS; p++ ) {
		const fp = f * p * Math.sqrt( 1 + INHARMONIC * p * p );
		if ( fp > SR / 2.2 ) {
			break;
		}
		const amp = gain / Math.pow( p, 1.9 );
		// Low partials ring through the note and past it; the top of the series is gone almost at once.
		const decay = ( 3.1 + hold ) / ( 1 + 0.7 * ( p - 1 ) );
		const len = Math.min(
			Math.round( ( hold + decay * 4 ) * SR ),
			mix.length - n0
		);
		if ( len <= 0 ) {
			break;
		}
		const w = ( 2 * Math.PI * fp ) / SR;
		const cw = Math.cos( w );
		const sw = Math.sin( w );
		let c = Math.cos( Math.random() * Math.PI * 2 );
		let s = Math.sin( Math.random() * Math.PI * 2 );
		for ( let k = 0; k < len; k++ ) {
			const t = k / SR;
			const env = Math.exp( -t / decay ) * ( 1 - Math.exp( -t * 700 ) );
			if ( env < 0.0006 ) {
				break;
			}
			mix[ n0 + k ] += amp * env * s;
			const nc = c * cw - s * sw;
			s = s * cw + c * sw;
			c = nc;
		}
	}
	// The hammer: a short noise thump, felt more than heard.
	const thump = Math.round( 0.014 * SR );
	for ( let k = 0; k < thump && n0 + k < mix.length; k++ ) {
		mix[ n0 + k ] +=
			( Math.random() * 2 - 1 ) * gain * 0.12 * ( 1 - k / thump );
	}
}

// The click a pianist counts in with: a short sine blip, higher on the downbeat.
function click( mix, at, down ) {
	const n0 = Math.round( at * SR );
	const len = Math.round( 0.035 * SR );
	const w = ( 2 * Math.PI * ( down ? 1600 : 1050 ) ) / SR;
	for ( let k = 0; k < len && n0 + k < mix.length; k++ ) {
		const env = Math.exp( -( k / SR ) / 0.012 );
		mix[ n0 + k ] += Math.sin( w * k ) * env * ( down ? 0.06 : 0.035 );
	}
}

/* ---------------------------------------------------------------- one take */
function render( song ) {
	const mix = new Float32Array( SR * ( LENGTH + 3 ) );
	const beat = 60 / song.bpm;
	const melody = run( song.melody );
	const chords = run( song.chords );

	// The guide line: the tune the cast is learning, played an octave up so it sits over the accompaniment.
	for ( let at = 0; at < LENGTH; ) {
		for ( const [ name, beats ] of melody ) {
			if ( at >= LENGTH ) {
				break;
			}
			if ( name !== '-' ) {
				piano( mix, at, beats * beat * 0.9, hz( name ), 0.26 );
			}
			at += beats * beat;
		}
	}

	// The hands: root and fifth below, the chord above, broken on the offbeats where the number is moving.
	for ( let pass = 0, at = 0; at < LENGTH; pass++ ) {
		for ( const [ name, beats ] of chords ) {
			if ( at >= LENGTH ) {
				break;
			}
			const notes = chordNotes( name );
			const root = notes[ 0 ];
			piano( mix, at, beat * 1.8, mhz( root - 12 ), 0.3 );
			if ( beats >= 4 ) {
				piano( mix, at + beat * 2, beat * 1.6, mhz( root - 5 ), 0.22 );
			}
			const step = song.voicing === 'open' ? 1 : 2;
			for ( let s = 0, k = 0; s < beats; s += step, k++ ) {
				const t = at + s * beat;
				if ( t >= LENGTH ) {
					break;
				}
				const n = notes[ k % notes.length ] + ( pass % 2 ? 12 : 0 );
				piano( mix, t, step * beat * 1.4, mhz( n ), 0.13 );
			}
			at += beats * beat;
		}
	}

	// The click, on the numbers that carry a tempo.
	if ( song.click ) {
		for ( let b = 0; b < 4; b++ ) {
			click( mix, b * beat, b === 0 );
		}
	}

	// Master: fade the edges, soft clip, normalise, exactly LENGTH seconds.
	const out = new Int16Array( SR * LENGTH );
	let peak = 0;
	for ( let k = 0; k < out.length; k++ ) {
		peak = Math.max( peak, Math.abs( mix[ k ] ) );
	}
	const norm = 0.86 / ( peak || 1 );
	for ( let k = 0; k < out.length; k++ ) {
		const t = k / SR;
		const fade = Math.min( 1, t / 0.25, ( LENGTH - t ) / 1.4 );
		const v = Math.tanh( mix[ k ] * norm * 1.1 ) * fade;
		out[ k ] = Math.max(
			-32768,
			Math.min( 32767, Math.round( v * 32767 ) )
		);
	}
	return out;
}

/* ---------------------------------------------------------------- files */
function wav( pcm ) {
	const b = Buffer.alloc( 44 + pcm.length * 2 );
	b.write( 'RIFF', 0 );
	b.writeUInt32LE( 36 + pcm.length * 2, 4 );
	b.write( 'WAVE', 8 );
	b.write( 'fmt ', 12 );
	b.writeUInt32LE( 16, 16 );
	b.writeUInt16LE( 1, 20 );
	b.writeUInt16LE( 1, 22 );
	b.writeUInt32LE( SR, 24 );
	b.writeUInt32LE( SR * 2, 28 );
	b.writeUInt16LE( 2, 32 );
	b.writeUInt16LE( 16, 34 );
	b.write( 'data', 36 );
	b.writeUInt32LE( pcm.length * 2, 40 );
	Buffer.from( pcm.buffer ).copy( b, 44 );
	return b;
}
const sh = ( cmd, args ) =>
	execFileSync( cmd, args, {
		stdio: [ 'ignore', 'pipe', 'ignore' ],
		maxBuffer: 1 << 28,
	} );
/* Same envelope the plugin measures on import (Fetcher::levels): mono 8-bit at 1 kHz, mean deviation per 100 samples, 9·sqrt(v/peak). */
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
function encode( src, out, offset, length, title, artist ) {
	sh( 'ffmpeg', [
		'-v', 'error', '-y',
		'-ss', String( offset ),
		'-t', String( length ),
		'-i', src,
		'-af', `afade=t=in:d=0.3,afade=t=out:st=${ length - 1 }:d=1`,
		'-ac', '1', '-ar', '32000', '-b:a', '64k',
		'-id3v2_version', '3',
		'-metadata', `title=${ title }`,
		'-metadata', `artist=${ artist }`,
		out,
	] );
	return Math.round(
		parseFloat(
			sh( 'ffprobe', [
				'-v', 'error',
				'-show_entries', 'format=duration',
				'-of', 'csv=p=0',
				out,
			] ).toString()
		)
	);
}
function clearMp3s( dir ) {
	for ( const f of fs.readdirSync( dir ) ) {
		if ( f.endsWith( '.mp3' ) ) {
			fs.unlinkSync( path.join( dir, f ) );
		}
	}
}
const writeJSON = ( file, data, pretty ) =>
	fs.writeFileSync(
		file,
		( pretty
			? JSON.stringify( data, null, '\t' )
			: JSON.stringify( data ) ) + '\n'
	);

/* ---------------------------------------------------------------- run */
const COMPANY = 'The Lantern Company';
const SOURCE =
	'https://github.com/josephfusco/callboard/blob/main/tests/fixtures/rehearsal.js';
const CREDIT = 'Original, written for these fixtures';

const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'callboard-rehearsal-' ) );
const takes = SHOW.map( ( s ) => {
	const file = path.join( tmp, `${ s.id }.wav` );
	fs.writeFileSync( file, wav( render( s ) ) );
	console.log( `rendered ${ s.title } (${ s.bpm } bpm)` );
	return file;
} );

const demo = path.join( ROOT, 'demo-set' );
clearMp3s( demo );
const tracks = [];
const lv = {};
const tempo = {};
SHOW.forEach( ( s, k ) => {
	const file = `${ String( k + 1 ).padStart( 2, '0' ) } - ${ s.title } [${
		s.id
	}].mp3`;
	const out = path.join( demo, file );
	const duration = encode( takes[ k ], out, 0, LENGTH, s.title, COMPANY );
	lv[ s.id ] = levels( out );
	if ( s.click ) {
		tempo[ s.id ] = s.bpm; // the numbers that count in are the ones that carry a tempo
	}
	tracks.push( {
		index: k + 1,
		id: s.id,
		title: s.title,
		file,
		duration,
		url: SOURCE,
		uploader: COMPANY,
		uploader_url: SOURCE,
	} );
} );
writeJSON(
	path.join( demo, 'manifest.json' ),
	{
		name: 'The Lantern',
		slug: 'demo-set',
		order: -1, // the showcase set leads, whatever it is called

		playlist_url: '',
		curator: CREDIT,
		curator_url: SOURCE,
		tracks,
	},
	true
);
writeJSON( path.join( demo, 'levels.json' ), lv );
writeJSON( path.join( demo, 'tempo.json' ), tempo );

for ( const [ slug, length, offsets ] of [
	[ 'long-set', 20, [ 0, 18, 10 ] ],
	[ 'one-track', 24, [ 8 ] ],
] ) {
	const dir = path.join( ROOT, slug );
	const manifest = JSON.parse(
		fs.readFileSync( path.join( dir, 'manifest.json' ), 'utf8' )
	);
	clearMp3s( dir );
	const levelsOut = {};
	manifest.tracks.forEach( ( t, k ) => {
		const offset = offsets[ Math.floor( k / SHOW.length ) % offsets.length ];
		const out = path.join( dir, t.file );
		t.duration = encode(
			takes[ k % SHOW.length ],
			out,
			offset,
			length,
			t.title.replace( /^\d+\.\s*/, '' ).replace( /\s*\(.*\)$/, '' ),
			COMPANY
		);
		t.url = SOURCE;
		t.uploader = COMPANY;
		t.uploader_url = SOURCE;
		levelsOut[ t.id ] = levels( out );
	} );
	manifest.playlist_url = '';
	manifest.curator = CREDIT;
	manifest.curator_url = SOURCE;
	writeJSON( path.join( dir, 'manifest.json' ), manifest, true );
	writeJSON( path.join( dir, 'levels.json' ), levelsOut );
	console.log( `${ slug }: ${ manifest.tracks.length } tracks, ${ length }s each` );
}
fs.rmSync( tmp, { recursive: true, force: true } );
console.log( 'done' );
