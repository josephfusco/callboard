/* eslint-disable no-console -- a command-line script; it talks. */
/* Fixture audio for tests and the Playground demo: ten Broadway songs from public-domain 78s.
   Every composition was published before 1930 and every recording made by 1925, so both are public domain
   in the United States (17 U.S.C. § 1401 puts pre-1926 recordings in the public domain from 2026). The
   transfers come from the Internet Archive's Great 78 Project.

   demo-set gets one 40-second excerpt per song. long-set (24 tracks) and one-track keep their titles, ids
   and sidecars (lyrics, notes, tempo are keyed by id) and take shorter windows from the same ten sources,
   so the repository carries ten downloads' worth of audio, not thirty-five.

   Run: node tests/fixtures/songs.js (needs ffmpeg and ffprobe on PATH). Rewrites the mp3s, manifest.json
   and levels.json of demo-set, long-set and one-track. */
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );
const { execFileSync } = require( 'child_process' );

const ROOT = path.join( __dirname, 'callboard' );
const START = 3; // seconds in: past the needle drop
/* Restoration for acoustic-era transfers: rumble out below 100 Hz, clicks repaired, hiss reduced with a spectral
   denoiser, nothing above 4.8 kHz (a 1920s horn recorded nothing there; what is there is noise), then evened out.
   Pass --raw to hear the transfer as archived. */
const RAW = process.argv.includes( '--raw' );
const RESTORE = RAW
	? ''
	: 'highpass=f=100,adeclick=w=55:o=75:a=2:t=2:b=2,afftdn=nr=20:nf=-32:tn=1,lowpass=f=4800,dynaudnorm=f=400:g=21:p=0.85:m=8,';

/* Item identifiers on archive.org; the title is the song as a cast would call it, the show is for the credits. */
const SOURCES = [
	{
		id: '78_tea-for-two-no-no-nanette_frederick-bishop-vincent-youmans_gbia3037992b',
		title: 'Tea for Two',
		show: 'No, No, Nanette (1925)',
	},
	{
		id: '78_fascinating-rhythm_cliff-edwards-ukelele-ike-gershwin_gbia0341984b',
		title: 'Fascinating Rhythm',
		show: 'Lady, Be Good! (1924)',
	},
	{
		id: '78_oh-lady-be-good_ben-bernie-his-hotel-roosevelt-orch-gershwin_gbia3018889b',
		title: 'Oh, Lady Be Good!',
		show: 'Lady, Be Good! (1924)',
	},
	{
		id: '78_look-for-the-silver-lining_betsy-lane-shepherd-and-lewis-james-jerome-kern_gbia0088693a',
		title: 'Look for the Silver Lining',
		show: 'Sally (1920)',
	},
	{
		id: '78_im-just-wild-about-harry_vincent-and-his-hotel-pennsylvania-orchestra-noble-sissle_gbia0130106a',
		title: "I'm Just Wild About Harry",
		show: 'Shuffle Along (1921)',
	},
	{
		id: '78_april-showers_metropolitan-dance-players-louis-silvers_gbia0095724a',
		title: 'April Showers',
		show: 'Bombo (1921)',
	},
	{
		id: '78_toot-toot-tootsie_arthur-fields-gus-kahn-ernie-erdman-dan-russo_gbia0015127a',
		title: 'Toot, Toot, Tootsie!',
		show: 'Bombo (1922)',
	},
	{
		id: '78_manhattan_imperial-dance-orchestra-hart-rodgers_gbia0117730a',
		title: 'Manhattan',
		show: 'Garrick Gaieties (1925)',
	},
	{
		id: '78_second-hand-rose_rich-tone-quartette-clarke-hanley_gbia0401453a',
		title: 'Second Hand Rose',
		show: 'Ziegfeld Follies of 1921',
	},
	{
		id: '78_somebody-loves-me_cliff-edwards-ukelele-ike-gershwin_gbia0005212a',
		title: 'Somebody Loves Me',
		show: 'George White’s Scandals of 1924',
	},
];

const sleep = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );
async function getJSON( url ) {
	for ( let n = 0; n < 5; n++ ) {
		try {
			const r = await fetch( url, {
				signal: AbortSignal.timeout( 30000 ),
			} );
			if ( r.ok ) {
				return await r.json();
			}
		} catch {}
		await sleep( 2000 * ( n + 1 ) );
	}
	throw new Error( `could not fetch ${ url }` );
}
async function download( url, to ) {
	for ( let n = 0; n < 5; n++ ) {
		try {
			const r = await fetch( url, {
				signal: AbortSignal.timeout( 180000 ),
			} );
			if ( r.ok ) {
				fs.writeFileSync( to, Buffer.from( await r.arrayBuffer() ) );
				return;
			}
		} catch {}
		await sleep( 2000 * ( n + 1 ) );
	}
	throw new Error( `could not download ${ url }` );
}
const run = ( cmd, args, opts = {} ) =>
	execFileSync( cmd, args, {
		stdio: [ 'ignore', 'pipe', 'ignore' ],
		maxBuffer: 1 << 28,
		...opts,
	} );

/* Same envelope the plugin measures on import (Fetcher::levels): mono 8-bit at 1 kHz, mean deviation per 100 samples, 9·sqrt(v/peak). */
function levels( file ) {
	const pcm = run( 'ffmpeg', [
		'-v',
		'error',
		'-i',
		file,
		'-ac',
		'1',
		'-ar',
		'1000',
		'-f',
		'u8',
		'-',
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

const tidyName = ( performer ) =>
	performer
		.replace( /\s+/g, ' ' )
		.replace(
			/\b[A-Z][A-Z'.]+\b/g,
			( w ) => w[ 0 ] + w.slice( 1 ).toLowerCase()
		);

/* Cut one excerpt: mono 32 kHz at the given bitrate, faded in and out, tagged. Returns the rounded duration. */
function cut( src, out, offset, length, bitrate, title, artist ) {
	run( 'ffmpeg', [
		'-v',
		'error',
		'-y',
		'-ss',
		String( offset ),
		'-t',
		String( length ),
		'-i',
		src,
		'-af',
		`${ RESTORE }afade=t=in:d=0.6,afade=t=out:st=${ length - 1.2 }:d=1.2`,
		'-ac',
		'1',
		'-ar',
		'32000',
		'-b:a',
		bitrate,
		'-id3v2_version',
		'3',
		'-metadata',
		`title=${ title }`,
		'-metadata',
		`artist=${ artist }`,
		out,
	] );
	return Math.round(
		parseFloat(
			run( 'ffprobe', [
				'-v',
				'error',
				'-show_entries',
				'format=duration',
				'-of',
				'csv=p=0',
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

( async () => {
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'callboard-78-' ) );
	const sources = [];
	for ( const [ k, s ] of SOURCES.entries() ) {
		const meta = await getJSON( `https://archive.org/metadata/${ s.id }` );
		const mp3 = meta.files.find( ( f ) => f.name.endsWith( '.mp3' ) );
		if ( ! mp3 ) {
			throw new Error( `no mp3 in ${ s.id }` );
		}
		const year = String( meta.metadata.date || '' ).slice( 0, 4 );
		if ( ! year || +year > 1925 ) {
			throw new Error(
				`${ s.id } is dated ${ year }; only recordings through 1925 are public domain`
			);
		}
		const performer = tidyName(
			( Array.isArray( meta.metadata.creator )
				? meta.metadata.creator[ 0 ]
				: meta.metadata.creator ) || 'Unknown'
		);
		const src = path.join( tmp, `${ k }.mp3` );
		await download(
			`https://archive.org/download/${ s.id }/${ encodeURIComponent(
				mp3.name
			) }`,
			src
		);
		sources.push( {
			...s,
			src,
			performer,
			year,
			url: `https://archive.org/details/${ s.id }`,
			short: s.id.slice( s.id.lastIndexOf( '_' ) + 1 ),
		} );
		console.log( `fetched ${ s.title }  ${ performer } (${ year })` );
	}

	// demo-set: the songs themselves
	const demo = path.join( ROOT, 'demo-set' );
	clearMp3s( demo );
	const tracks = [];
	const lv = {};
	sources.forEach( ( s, k ) => {
		const file = `${ String( k + 1 ).padStart(
			2,
			'0'
		) } - ${ s.title.replace( /[\/:]/g, '-' ) } [${ s.short }].mp3`;
		const out = path.join( demo, file );
		const duration = cut(
			s.src,
			out,
			START,
			40,
			'64k',
			s.title,
			s.performer
		);
		lv[ s.short ] = levels( out );
		tracks.push( {
			index: k + 1,
			id: s.short,
			title: s.title,
			file,
			duration,
			url: s.url,
			uploader: s.performer,
			uploader_url: s.url,
			show: s.show,
			recorded: s.year,
		} );
	} );
	writeJSON(
		path.join( demo, 'manifest.json' ),
		{
			name: 'Demo Set',
			slug: 'demo-set',
			order: 0,
			playlist_url: 'https://great78.archive.org/',
			curator: 'Great 78 Project',
			curator_url: 'https://archive.org/details/georgeblood',
			tracks,
		},
		true
	);
	writeJSON( path.join( demo, 'levels.json' ), lv );

	// long-set and one-track: keep titles, ids and sidecars; the audio is a window from one of the songs
	for ( const [ slug, length, bitrate ] of [
		[ 'long-set', 20, '48k' ],
		[ 'one-track', 24, '48k' ],
	] ) {
		const dir = path.join( ROOT, slug );
		const manifest = JSON.parse(
			fs.readFileSync( path.join( dir, 'manifest.json' ), 'utf8' )
		);
		clearMp3s( dir );
		const levelsOut = {};
		manifest.tracks.forEach( ( t, k ) => {
			const s = sources[ k % sources.length ];
			const offset =
				START +
				45 * Math.floor( k / sources.length ) +
				( slug === 'one-track' ? 60 : 0 ); // different window each lap
			const out = path.join( dir, t.file );
			t.duration = cut(
				s.src,
				out,
				offset,
				length,
				bitrate,
				t.title.replace( /^\d+\.\s*/, '' ).replace( /\s*\(.*\)$/, '' ),
				s.performer
			);
			t.url = s.url;
			t.uploader = s.performer;
			t.uploader_url = s.url;
			levelsOut[ t.id ] = levels( out );
		} );
		manifest.playlist_url = 'https://great78.archive.org/';
		manifest.curator = 'Great 78 Project';
		manifest.curator_url = 'https://archive.org/details/georgeblood';
		writeJSON( path.join( dir, 'manifest.json' ), manifest, true );
		writeJSON( path.join( dir, 'levels.json' ), levelsOut );
		console.log(
			`${ slug }: ${ manifest.tracks.length } tracks, ${ length }s each`
		);
	}
	fs.rmSync( tmp, { recursive: true, force: true } );
	console.log( 'done' );
} )();
