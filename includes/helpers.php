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
	$file = CALLBOARD_DIR . 'templates/' . $name . '.php';
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
		'loop'  => '<path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
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
