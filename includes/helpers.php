<?php
/**
 * Small template helpers.
 *
 * @package Callboard
 */

defined( 'ABSPATH' ) || exit;

/**
 * Render the app. Called by the companion theme's index.php.
 */
function callboard_render(): void {
	if ( ! class_exists( Callboard\Plugin::class ) ) {
		esc_html_e( 'Callboard is not active.', 'callboard' );
		return;
	}
	include CALLBOARD_DIR . 'templates/index.php';
}

/**
 * Include a plugin template with variables in scope.
 *
 * @param string               $name Template file name without extension.
 * @param array<string, mixed> $args Variables to expose.
 */
function callboard_template( string $name, array $args = array() ): void { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- $args is read by the included template.
	/**
	 * Swap a template for your own. Return a path to a PHP file that receives the same $args.
	 *
	 * @param string               $file Path to the plugin's template.
	 * @param string               $name Template name: index, home, set, board, deck, footer, fragment.
	 * @param array<string, mixed> $args Template arguments.
	 */
	$file = (string) apply_filters( 'callboard_template_path', CALLBOARD_DIR . 'templates/' . $name . '.php', $name, $args );
	if ( ! is_readable( $file ) ) {
		return;
	}
	include $file; // $args stays in scope for the template.
}

/**
 * Format a duration in seconds as m:ss for a duration in seconds.
 *
 * @param float|null $seconds Seconds.
 */
function callboard_fmt( ?float $seconds ): string {
	if ( null === $seconds ) {
		return '–:––';
	}
	return sprintf( '%d:%02d', floor( $seconds / 60 ), floor( fmod( $seconds, 60 ) ) );
}

/**
 * "20 tracks · 42 min".
 *
 * @param array<int, array<string, mixed>> $tracks Tracks.
 */
function callboard_meta( array $tracks ): string {
	if ( ! $tracks ) {
		return __( 'No audio yet', 'callboard' );
	}
	$seconds = (int) round( array_sum( array_map( static fn( array $t ) => (float) ( $t['duration'] ?? 0 ), $tracks ) ) );
	$hours   = intdiv( $seconds, 3600 );
	$minutes = (int) round( ( $seconds % 3600 ) / 60 );
	if ( $hours ) {
		$total = sprintf( '%d hr %d min', $hours, $minutes );
	} elseif ( $seconds < 60 ) {
		$total = sprintf( '%d sec', $seconds );
	} else {
		$total = sprintf( '%d min', $minutes );
	}
	/* translators: 1: number of tracks, 2: total length such as "42 min". */
	return sprintf( _n( '%1$d track · %2$s', '%1$d tracks · %2$s', count( $tracks ), 'callboard' ), count( $tracks ), $total );
}

/**
 * "463 KB", "3.1 MB", "74 MB": the same thresholds as sizeLabel() in the front-end script.
 *
 * @param int $bytes Bytes.
 */
function callboard_size( int $bytes ): string {
	if ( $bytes < 1048576 ) {
		return max( 1, (int) round( $bytes / 1024 ) ) . ' KB';
	}
	if ( $bytes < 10485760 ) {
		return number_format( $bytes / 1048576, 1, '.', '' ) . ' MB';
	}
	return (int) round( $bytes / 1048576 ) . ' MB';
}

/**
 * Inline SVG icon markup.
 *
 * @param string $name Icon name.
 */
function callboard_icon( string $name ): string {
	$paths = array(
		'share' => '<path d="M12 3v12m0-12L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
		'prev'  => '<path class="skip-bar" d="M6 5h2v14H6z"/><path class="skip-tri" d="M19 5v14L9 12z"/>',
		'next'  => '<path class="skip-bar" d="M16 5h2v14h-2z"/><path class="skip-tri" d="M5 5v14l10-7z"/>',
		'bell'  => '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
		'close' => '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" fill="none"/>',
		'cast'  => '<path d="M6 17H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 13.5 17.5 21h-11z"/>',
	);
	return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' . ( $paths[ $name ] ?? '' ) . '</svg>';
}

/**
 * The site title as plain text (get_bloginfo() returns it HTML-encoded).
 */
function callboard_site_name(): string {
	return wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
}

/**
 * Cache-busted URL for a plugin asset.
 *
 * @param string $path Path relative to the plugin root.
 */
function callboard_asset( string $path ): string {
	$file = CALLBOARD_DIR . $path;
	return CALLBOARD_URL . $path . ( file_exists( $file ) ? '?v=' . filemtime( $file ) : '' );
}

/**
 * External link with the rel attributes we always want.
 *
 * @param string      $text Link text.
 * @param string|null $url  URL; plain text is returned when empty.
 */
function callboard_link( string $text, ?string $url ): string {
	if ( ! $url ) {
		return esc_html( $text );
	}
	return '<a href="' . esc_url( $url ) . '" target="_blank" rel="nofollow noopener noreferrer">' . esc_html( $text ) . '</a>';
}

/**
 * Which tier a copy belongs to: max, hifi, high, low, or '' when nothing is known.
 *
 * The names are Tidal's, deliberately. A cast member comparing two copies of the same song has
 * almost certainly seen that vocabulary somewhere, and inventing a private one would mean teaching
 * it. The boundaries are Tidal's too: lossless is HiFi, lossless past CD is Max, and lossy splits
 * at the 256 kbps their High tier sits on.
 *
 * The tier is a headline, not a measurement — callboard_quality() below is the measurement, and the
 * two are shown together so the word never has to be taken on trust.
 *
 * @param array<string, mixed> $meta Attachment metadata.
 */
function callboard_quality_tier( array $meta ): string {
	$rate = (int) ( $meta['sample_rate'] ?? 0 );
	if ( ! $rate ) {
		return '';
	}

	if ( ! empty( $meta['lossless'] ) ) {
		$bits = (int) ( $meta['bits_per_sample'] ?? 0 );
		return $bits >= 24 || $rate > 48000 ? 'max' : 'hifi';
	}

	$kbps = (int) round( ( (float) ( $meta['bitrate'] ?? 0 ) ) / 1000 );
	if ( ! $kbps ) {
		return '';
	}

	return $kbps >= 256 ? 'high' : 'low';
}

/**
 * The tier's name, for a badge.
 *
 * @param string $tier One of max, hifi, high, low.
 */
function callboard_quality_tier_label( string $tier ): string {
	$names = array(
		'max'  => _x( 'Max', 'audio quality tier', 'callboard' ),
		'hifi' => _x( 'HiFi', 'audio quality tier', 'callboard' ),
		'high' => _x( 'High', 'audio quality tier', 'callboard' ),
		'low'  => _x( 'Low', 'audio quality tier', 'callboard' ),
	);

	return $names[ $tier ] ?? '';
}

/**
 * What a copy actually is: "16-bit 44.1kHz" for lossless, "270 kbps 48.0kHz" for lossy.
 *
 * Bit depth is a property of PCM, so it is only shown where the format has one. Printing "24-bit"
 * over an mp3 would be flattering and false. This is here because a track can arrive from the
 * server, off a stick, or out of a car export that was re-encoded on the way, and the difference
 * is worth being able to see.
 *
 * @param array<string, mixed> $meta Attachment metadata.
 */
function callboard_quality( array $meta ): string {
	$rate = (int) ( $meta['sample_rate'] ?? 0 );
	if ( ! $rate ) {
		return '';
	}
	$khz  = rtrim( rtrim( number_format( $rate / 1000, 1 ), '0' ), '.' ) . 'kHz';
	$bits = (int) ( $meta['bits_per_sample'] ?? 0 );

	if ( ! empty( $meta['lossless'] ) && $bits ) {
		/* translators: 1: bit depth, 2: sample rate such as 44.1kHz. */
		return sprintf( __( '%1$d-bit %2$s', 'callboard' ), $bits, $khz );
	}

	$kbps = (int) round( ( (float) ( $meta['bitrate'] ?? 0 ) ) / 1000 );
	if ( ! $kbps ) {
		return $khz;
	}

	/* translators: 1: bitrate in kbps, 2: sample rate such as 44.1kHz. */
	return sprintf( __( '%1$d kbps %2$s', 'callboard' ), $kbps, $khz );
}
