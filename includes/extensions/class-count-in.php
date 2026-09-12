<?php
/**
 * Count-in: a track with a tempo taps four beats before it plays from the top.
 *
 * Built as an extension, on public functions only. The tempo reaches the page as this extension's
 * track data, the ♩ badge on the row is a track badge, and the count itself lives in the
 * callboard/count-in section of assets/app.js, where it holds the start of playback through the
 * beforePlay point. Unregister callboard/count-in and all three go.
 *
 * @package Callboard
 */

namespace Callboard\Extension;

use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * The count-in extension.
 */
final class Count_In {

	/**
	 * Register with the extension registry.
	 */
	public static function register(): void {
		/**
		 * The count-in extension. Unregister it by this id to switch the count-in and its badge off.
		 */
		callboard_register_extension(
			'callboard/count-in',
			array(
				'title'       => __( 'Count-in', 'callboard' ),
				'version'     => '1.0.0',
				'api_version' => 1,
				'track_data'  => array( self::class, 'track_data' ),
				'app_data'    => array( self::class, 'app_data' ),
				'slots'       => array(
					'track_badges' => array( self::class, 'badge' ),
				),
			)
		);
	}

	/**
	 * The tempo, where the import found one.
	 *
	 * @param array<string, mixed> $track      Track data so far.
	 * @param WP_Post              $attachment The audio attachment.
	 * @return array{bpm: int|null}
	 */
	public static function track_data( array $track, WP_Post $attachment ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundBeforeLastUsed -- the point's signature.
		$bpm = (int) get_post_meta( $attachment->ID, '_callboard_bpm', true );
		return array( 'bpm' => $bpm > 0 ? $bpm : null );
	}

	/**
	 * Whether the setting has the count-in on. Per request, since it is a setting and not the track.
	 *
	 * @return array{enabled: bool}
	 */
	public static function app_data(): array {
		return array( 'enabled' => (bool) callboard_get_setting( 'count_in' ) );
	}

	/**
	 * `♩ 96` on the row, rendered by the server so nothing moves when the script arrives.
	 *
	 * @param array<string, mixed> $track Track data.
	 * @return array<int, array<string, string>>
	 */
	public static function badge( array $track ): array {
		$bpm = (int) ( $track['ext']['callboard/count-in']['bpm'] ?? 0 );
		if ( ! $bpm ) {
			return array();
		}
		return array(
			array(
				'text'      => '♩ ' . $bpm,
				/* translators: %d: beats per minute. */
				'label'     => sprintf( __( '%d beats per minute, counts in', 'callboard' ), $bpm ),
				'className' => 'bpm',
			),
		);
	}
}
