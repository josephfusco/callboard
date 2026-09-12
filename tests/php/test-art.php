<?php
/**
 * The artwork Callboard draws for a set that arrives without any.
 *
 * These read the PNG back rather than asking the drawing code what it meant to do: what matters is
 * whether the name ends up on the picture, not what size the loop settled on.
 *
 * @package Callboard
 */

use Callboard\Art;

/**
 * @covers \Callboard\Art
 */
class Test_Callboard_Art extends WP_UnitTestCase {

	/**
	 * Where the PNGs go.
	 *
	 * @var string
	 */
	private string $dir;

	public function set_up(): void {
		parent::set_up();
		if ( ! function_exists( 'imagettftext' ) ) {
			$this->markTestSkipped( 'GD without FreeType cannot draw the artwork.' );
		}
		$this->dir = sys_get_temp_dir() . '/callboard-art-' . wp_generate_password( 8, false );
		wp_mkdir_p( $this->dir );
	}

	public function tear_down(): void {
		foreach ( (array) glob( $this->dir . '/*' ) as $file ) {
			wp_delete_file( $file );
		}
		rmdir( $this->dir ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- a temp folder this test made.
		parent::tear_down();
	}

	/**
	 * #93. "Hadestown" is one word, and at the size the cover starts from it is wider than the column.
	 * Wrapping happens between words, so a count of lines said it fit and the name ran off the right
	 * edge. Nothing but the background may sit in the margin beside the title.
	 *
	 * @dataProvider cards
	 */
	public function test_a_long_one_word_name_stays_inside_the_artwork( string $kind, array $margin ): void {
		$file = $this->dir . "/{$kind}.png";
		$this->assertTrue( Art::$kind( $this->manifest( 'Hadestown' ), $file ) );

		// The left margin is always bare, so it says what the background is.
		$im    = imagecreatefrompng( $file );
		$bg    = imagecolorat( $im, 4, (int) ( imagesy( $im ) / 2 ) );
		$inked = 0;
		for ( $x = $margin[0]; $x <= $margin[1]; $x++ ) {
			for ( $y = $margin[2]; $y <= $margin[3]; $y++ ) {
				$inked += imagecolorat( $im, $x, $y ) === $bg ? 0 : 1;
			}
		}

		$this->assertSame( 0, $inked, "The name reaches the {$kind}'s right margin." );
	}

	/**
	 * The right margin beside each card's title: clear of the accent dot above and the level bars below.
	 *
	 * @return array<string, array{0: string, 1: array{0: int, 1: int, 2: int, 3: int}}>
	 */
	public function cards(): array {
		return array(
			'the square cover'      => array( 'cover', array( 950, 1023, 200, 880 ) ),
			'the link-preview card' => array( 'share', array( 920, 1199, 150, 490 ) ),
		);
	}

	/**
	 * A manifest with nothing but a name, the way a folder of dropped-in audio produces one.
	 *
	 * @param string $name Set name.
	 * @return array<string, mixed>
	 */
	private function manifest( string $name ): array {
		return array(
			'name'   => $name,
			'slug'   => sanitize_title( $name ),
			'tracks' => array(),
		);
	}
}
