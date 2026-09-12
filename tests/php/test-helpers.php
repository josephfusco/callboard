<?php
/**
 * The small functions that write every line of text a cast member reads.
 *
 * @package Callboard
 */

/**
 * @covers ::callboard_fmt
 * @covers ::callboard_meta
 * @covers ::callboard_size
 * @covers ::callboard_quality
 */
class Test_Callboard_Helpers extends WP_UnitTestCase {

	/**
	 * @dataProvider durations
	 */
	public function test_a_duration_reads_as_a_clock( ?float $seconds, string $expected ): void {
		$this->assertSame( $expected, callboard_fmt( $seconds ) );
	}

	/**
	 * @return array<string, array{0: float|null, 1: string}>
	 */
	public function durations(): array {
		return array(
			'nothing known'    => array( null, '–:––' ),
			'zero'             => array( 0.0, '0:00' ),
			'single digit'     => array( 7.0, '0:07' ),
			'a fraction under' => array( 59.9, '0:59' ),
			'exactly a minute' => array( 60.0, '1:00' ),
			'past ten minutes' => array( 754.0, '12:34' ),
			'past an hour'     => array( 3661.0, '61:01' ),
		);
	}

	public function test_a_set_with_no_audio_says_so(): void {
		$this->assertSame( 'No audio yet', callboard_meta( array() ) );
	}

	/**
	 * @dataProvider set_lengths
	 */
	public function test_a_set_summarises_its_own_length( array $durations, string $expected ): void {
		$tracks = array_map( static fn( $d ) => array( 'duration' => $d ), $durations );
		$this->assertSame( $expected, callboard_meta( $tracks ) );
	}

	/**
	 * @return array<string, array{0: float[], 1: string}>
	 */
	public function set_lengths(): array {
		return array(
			'one short track' => array( array( 12.0 ), '1 track · 12 sec' ),
			'under a minute'  => array( array( 20.0, 21.0 ), '2 tracks · 41 sec' ),
			'a few minutes'   => array( array( 200.0, 220.0 ), '2 tracks · 7 min' ),
			'over an hour'    => array( array_fill( 0, 18, 250.0 ), '18 tracks · 1 hr 15 min' ),
			'a track untimed' => array( array( 200.0, null ), '2 tracks · 3 min' ),
		);
	}

	/**
	 * @dataProvider sizes
	 */
	public function test_a_download_size_reads_the_way_a_phone_writes_it( int $bytes, string $expected ): void {
		$this->assertSame( $expected, callboard_size( $bytes ) );
	}

	/**
	 * @return array<string, array{0: int, 1: string}>
	 */
	public function sizes(): array {
		return array(
			'empty is still something' => array( 0, '1 KB' ),
			'kilobytes'                => array( 200 * 1024, '200 KB' ),
			'just under a megabyte'    => array( 1048575, '1024 KB' ),
			'small files get a place'  => array( 5 * 1048576 + 524288, '5.5 MB' ),
			'big files do not'         => array( 120 * 1048576, '120 MB' ),
		);
	}

	/**
	 * Bit depth is a property of lossless audio. Printing "16-bit" beside a 128 kbps MP3 would be
	 * describing the decoder, not the recording, which is the mistake the pill exists to avoid.
	 */
	public function test_quality_reports_bit_depth_only_when_the_audio_is_lossless(): void {
		$this->assertSame(
			'24-bit 96kHz',
			callboard_quality(
				array(
					'sample_rate'     => 96000,
					'bits_per_sample' => 24,
					'lossless'        => true,
				)
			)
		);

		$this->assertSame(
			'256 kbps 44.1kHz',
			callboard_quality(
				array(
					'sample_rate'     => 44100,
					'bits_per_sample' => 16,
					'lossless'        => false,
					'bitrate'         => 256000,
				)
			)
		);
	}

	public function test_quality_says_nothing_rather_than_guessing(): void {
		$this->assertSame( '', callboard_quality( array() ), 'no sample rate means nothing is known' );
		$this->assertSame( '48kHz', callboard_quality( array( 'sample_rate' => 48000 ) ), 'a rate with no bitrate is still a fact' );
	}

	public function test_a_sample_rate_drops_a_trailing_zero(): void {
		$this->assertSame( '44.1kHz', callboard_quality( array( 'sample_rate' => 44100 ) ) );
		$this->assertSame( '48kHz', callboard_quality( array( 'sample_rate' => 48000 ) ) );
	}
}
