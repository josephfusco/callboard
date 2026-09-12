<?php
/**
 * Which tier a copy lands in.
 *
 * The boundaries are borrowed from Tidal, so the interesting cases are the ones that sit exactly on
 * them and the ones where a format lies about itself.
 *
 * @package Callboard
 */

/**
 * @covers ::callboard_quality_tier
 * @covers ::callboard_quality_tier_label
 */
class Test_Callboard_Quality_Tier extends WP_UnitTestCase {

	/**
	 * @dataProvider copies
	 */
	public function test_a_copy_lands_in_the_tier_it_belongs_to( array $meta, string $expected ): void {
		$this->assertSame( $expected, callboard_quality_tier( $meta ) );
	}

	/**
	 * @return array<string, array{0: array<string, mixed>, 1: string}>
	 */
	public function copies(): array {
		$lossless = static fn( int $bits, int $rate ): array => array(
			'sample_rate'     => $rate,
			'bits_per_sample' => $bits,
			'lossless'        => true,
		);
		$lossy    = static fn( int $kbps, int $rate = 44100 ): array => array(
			'sample_rate' => $rate,
			'lossless'    => false,
			'bitrate'     => $kbps * 1000,
		);

		return array(
			'studio master'          => array( $lossless( 24, 96000 ), 'max' ),
			'24-bit at CD rate'      => array( $lossless( 24, 44100 ), 'max' ),
			'16-bit past 48k'        => array( $lossless( 16, 88200 ), 'max' ),
			'a CD rip'               => array( $lossless( 16, 44100 ), 'hifi' ),
			'16-bit at 48k'          => array( $lossless( 16, 48000 ), 'hifi' ),
			'a good lossy rip'       => array( $lossy( 320 ), 'high' ),
			'exactly on the line'    => array( $lossy( 256 ), 'high' ),
			'just under it'          => array( $lossy( 255 ), 'low' ),
			'what YouTube serves'    => array( $lossy( 128 ), 'low' ),
			'a spoken-word download' => array( $lossy( 64, 32000 ), 'low' ),
		);
	}

	public function test_nothing_known_is_not_a_tier(): void {
		$this->assertSame( '', callboard_quality_tier( array() ), 'no sample rate means nothing is known' );
		$this->assertSame(
			'',
			callboard_quality_tier( array( 'sample_rate' => 44100 ) ),
			'a rate with no bitrate and no lossless flag cannot be placed'
		);
	}

	/**
	 * Lossless with no bit depth still has a floor: it is at least CD quality by definition, and
	 * calling it Low because getID3 did not report a depth would be the wrong way to be wrong.
	 */
	public function test_lossless_without_a_bit_depth_is_still_lossless(): void {
		$this->assertSame(
			'hifi',
			callboard_quality_tier(
				array(
					'sample_rate' => 44100,
					'lossless'    => true,
				)
			)
		);
	}

	public function test_every_tier_has_a_name_and_nothing_else_does(): void {
		foreach ( array( 'max', 'hifi', 'high', 'low' ) as $tier ) {
			$this->assertNotSame( '', callboard_quality_tier_label( $tier ), "{$tier} needs a label" );
		}
		$this->assertSame( '', callboard_quality_tier_label( '' ) );
		$this->assertSame( '', callboard_quality_tier_label( 'lossless' ) );
	}

	/**
	 * The tier is a headline and callboard_quality() is the measurement behind it, so the two must
	 * never disagree about whether the copy is lossless.
	 */
	public function test_the_tier_and_the_detail_tell_the_same_story(): void {
		$master = array(
			'sample_rate'     => 96000,
			'bits_per_sample' => 24,
			'lossless'        => true,
		);
		$this->assertSame( 'max', callboard_quality_tier( $master ) );
		$this->assertStringContainsString( '24-bit', callboard_quality( $master ) );

		$stream = array(
			'sample_rate' => 44100,
			'lossless'    => false,
			'bitrate'     => 128000,
		);
		$this->assertSame( 'low', callboard_quality_tier( $stream ) );
		$this->assertStringContainsString( 'kbps', callboard_quality( $stream ) );
		$this->assertStringNotContainsString( '-bit', callboard_quality( $stream ) );
	}
}
