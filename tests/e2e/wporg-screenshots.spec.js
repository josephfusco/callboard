/**
 * Checks that the wordpress.org screenshots match their readme.txt captions.
 *
 * wordpress.org pairs screenshot-N.png with caption N. The images are generated from
 * .wordpress-org/screenshots.json by scripts/wporg-screenshots.js. See #100.
 */
const fs = require( 'fs' );
const path = require( 'path' );
const { test, expect } = require( '@playwright/test' );

const ROOT = path.join( __dirname, '..', '..' );
const DIR = path.join( ROOT, '.wordpress-org' );

/**
 * A PNG's size, from its IHDR chunk.
 *
 * @param {string} file Path.
 */
const pngSize = ( file ) => {
	const head = fs.readFileSync( file ).subarray( 0, 24 );
	return { width: head.readUInt32BE( 16 ), height: head.readUInt32BE( 20 ) };
};

/**
 * The numbered captions under readme.txt's Screenshots heading.
 */
const readmeCaptions = () => {
	const readme = fs.readFileSync( path.join( ROOT, 'readme.txt' ), 'utf8' );
	const section = readme.split( '== Screenshots ==' )[ 1 ].split( /\n== / )[ 0 ];
	return [ ...section.matchAll( /^(\d+)\. (.+)$/gm ) ].map( ( m ) => ( {
		n: Number( m[ 1 ] ),
		caption: m[ 2 ].trim(),
	} ) );
};

test.describe( 'wordpress.org screenshots', () => {
	test( 'every caption in readme.txt matches its screenshot, in order', () => {
		const shots = JSON.parse(
			fs.readFileSync( path.join( DIR, 'screenshots.json' ), 'utf8' )
		);
		const captions = readmeCaptions();
		expect( captions.map( ( c ) => c.n ) ).toEqual(
			shots.map( ( _, i ) => i + 1 )
		);
		expect( captions.map( ( c ) => c.caption ) ).toEqual(
			shots.map( ( s ) => s.caption )
		);
		shots.forEach( ( shot, i ) => {
			expect( shot.file ).toBe( `screenshot-${ i + 1 }.png` );
			expect( pngSize( path.join( DIR, shot.file ) ) ).toEqual( {
				width: 2400,
				height: 1500,
			} );
		} );
	} );

	test( 'the first screenshot is the home page', () => {
		const shots = JSON.parse(
			fs.readFileSync( path.join( DIR, 'screenshots.json' ), 'utf8' )
		);
		expect( shots[ 0 ].view ).toBe( 'home' );
	} );
} );
