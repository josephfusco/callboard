<?php
/**
 * The artwork the plugin draws for a set, and the one colour it reads back out of a cover.
 *
 * @package Callboard
 */

use Callboard\Art;

/**
 * @covers \Callboard\Art
 */
class Test_Callboard_Art extends WP_UnitTestCase {

	/**
	 * Files written by a test, removed after it.
	 *
	 * @var string[]
	 */
	private array $files = array();

	public function tear_down(): void {
		foreach ( $this->files as $file ) {
			if ( file_exists( $file ) ) {
				unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- a temp file this test wrote.
			}
		}
		parent::tear_down();
	}

	private function temp( string $ext ): string {
		$file          = trailingslashit( get_temp_dir() ) . 'callboard-art-' . wp_generate_password( 8, false ) . '.' . $ext;
		$this->files[] = $file;
		return $file;
	}

	/**
	 * A flat PNG, optionally with a square of another colour in the middle.
	 *
	 * @param int[]      $ground RGB of the background.
	 * @param int[]|null $mark   RGB of the square, if any.
	 */
	private function png( array $ground, ?array $mark = null ): string {
		$im = imagecreatetruecolor( 64, 64 );
		imagefill( $im, 0, 0, imagecolorallocate( $im, ...$ground ) );
		if ( $mark ) {
			imagefilledrectangle( $im, 24, 24, 39, 39, imagecolorallocate( $im, ...$mark ) );
		}
		$file = $this->temp( 'png' );
		imagepng( $im, $file );
		return $file;
	}

	public function test_a_cover_comes_back_as_a_square_png(): void {
		if ( ! function_exists( 'imagettftext' ) ) {
			$this->markTestSkipped( 'GD here has no FreeType, so there is no cover to draw.' );
		}
		$out      = $this->temp( 'png' );
		$manifest = array(
			'name'   => 'Shakespeare’s Sonnets',
			'slug'   => 'demo-set',
			'tracks' => array(),
		);

		$this->assertTrue( Art::cover( $manifest, $out ) );

		$size = getimagesize( $out );
		$this->assertSame( array( 1024, 1024, IMAGETYPE_PNG ), array( $size[0], $size[1], $size[2] ) );
	}

	/**
	 * Mostly cream paper with one red mark on it reads as the mark.
	 */
	public function test_a_cover_is_tinted_by_the_colour_it_carries_not_the_paper(): void {
		$tint = Art::tint( $this->png( array( 245, 240, 225 ), array( 200, 30, 30 ) ) );

		$this->assertMatchesRegularExpression( '/^#[0-9a-f]{6}$/', (string) $tint );
		[ $r, $g, $b ] = sscanf( (string) $tint, '#%02x%02x%02x' );
		$this->assertGreaterThan( $g + 40, $r );
		$this->assertGreaterThan( $b + 40, $r );
	}

	public function test_a_grey_cover_is_its_own_grey(): void {
		$this->assertSame( '#808080', Art::tint( $this->png( array( 128, 128, 128 ) ) ) );
	}

	public function test_a_file_that_is_not_an_image_has_no_tint(): void {
		$file = $this->temp( 'png' );
		file_put_contents( $file, 'not a picture' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a temp file for the test.

		$this->assertNull( Art::tint( $file ) );
	}
}
