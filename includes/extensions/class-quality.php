<?php
/**
 * Quality: what a copy actually is, shown in Now Playing.
 *
 * Built as an extension, on public functions only. The server describes the file as this
 * extension's track data; the pill in Now Playing is a nowPlayingMeta contribution in the
 * callboard/quality section of assets/app.js. Unregister callboard/quality, register your own
 * extension against the same point, and yours is what Now Playing shows.
 *
 * @package Callboard
 */

namespace Callboard\Extension;

use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * The quality extension.
 */
final class Quality {

	/**
	 * Register with the extension registry.
	 */
	public static function register(): void {
		/**
		 * The quality extension. Unregister it by this id and register your own to replace the pill.
		 */
		callboard_register_extension(
			'callboard/quality',
			array(
				'title'       => __( 'Quality', 'callboard' ),
				'version'     => '1.0.0',
				'api_version' => 1,
				'track_data'  => array( self::class, 'track_data' ),
				'app_data'    => array( self::class, 'app_data' ),
			)
		);
	}

	/**
	 * "16-bit 44.1kHz" or "270 kbps 48kHz", from WordPress's own attachment metadata.
	 *
	 * @param array<string, mixed> $track      Track data so far.
	 * @param WP_Post              $attachment The audio attachment.
	 * @return array{quality: string}
	 */
	public static function track_data( array $track, WP_Post $attachment ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundBeforeLastUsed -- the point's signature.
		return array( 'quality' => callboard_quality( (array) wp_get_attachment_metadata( $attachment->ID ) ) );
	}

	/**
	 * The pattern for the estimate the script makes when the metadata has no sample rate.
	 *
	 * @return array{format: string}
	 */
	public static function app_data(): array {
		/* translators: %1$s: file format (e.g. MP3), %2$s: bitrate in kbps. */
		return array( 'format' => __( '%1$s · %2$s kbps', 'callboard' ) );
	}
}
