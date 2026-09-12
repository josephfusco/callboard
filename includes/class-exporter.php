<?php
/**
 * Writes a set out as a .callboard file, and reads one back.
 *
 * The file is a zip of the folder the fetcher already produces: manifest.json, the audio,
 * and the sidecars beside it. Unzipped it *is* an import folder, so `Importer` reads it
 * without knowing it was ever a file, and somebody with no Callboard at all still has
 * playable mp3s in the right order. Nothing in here is a new idea; it is the existing
 * shape, versioned and given an extension.
 *
 * @package Callboard
 */

namespace Callboard;

use WP_Error;
use WP_Post;
use ZipArchive;

defined( 'ABSPATH' ) || exit;

/**
 * Set export and import as a single file.
 */
final class Exporter {

	/**
	 * Manifest format version. Bump when a reader has to behave differently, never for
	 * a field a reader can ignore.
	 */
	public const VERSION = 1;

	public const EXT  = 'callboard';
	public const TYPE = 'application/vnd.callboard+zip';

	/** Files carried beside the audio. */
	private const SIDECARS = array( 'levels', 'lyrics', 'notes', 'tempo' );

	/**
	 * Hook registration.
	 */
	public static function register_hooks(): void {
		add_action( 'admin_post_callboard_export', array( self::class, 'handle_admin_export' ) );
	}

	/**
	 * Whether this server can read and write zips at all.
	 */
	public static function available(): bool {
		return class_exists( ZipArchive::class );
	}

	/**
	 * A track's key in the manifest and in every sidecar.
	 *
	 * `_callboard_video_id` when the track came from a fetch, so a re-import matches what is
	 * already here. Otherwise one derived from the file name, which is stable across exports
	 * and, unlike the empty string, unique within the set.
	 *
	 * @param int    $track_id Attachment ID.
	 * @param string $file     Absolute path to the audio.
	 */
	public static function track_key( int $track_id, string $file ): string {
		$video = (string) get_post_meta( $track_id, '_callboard_video_id', true );

		return '' !== $video ? $video : 'cb-' . substr( sha1( basename( $file ) ), 0, 12 );
	}

	/**
	 * The manifest for a set, built from posts rather than from whatever folder it arrived in.
	 *
	 * @param WP_Post $set Set post.
	 * @return array<string, mixed>
	 */
	public static function manifest( WP_Post $set ): array {
		$credits = (array) get_post_meta( $set->ID, '_callboard_credits', true );
		$tracks  = array();
		$index   = 0;

		foreach ( Sets::track_posts( $set->ID ) as $track ) {
			$file = get_attached_file( $track->ID );
			if ( ! $file || ! file_exists( $file ) ) {
				continue;
			}
			$duration = get_post_meta( $track->ID, '_callboard_duration', true );
			$tracks[] = array(
				'index'        => ++$index,
				'id'           => self::track_key( $track->ID, $file ),
				'title'        => $track->post_title,
				'file'         => basename( $file ),
				'duration'     => '' !== $duration ? (float) $duration : null,
				'url'          => (string) get_post_meta( $track->ID, '_callboard_source_url', true ),
				'uploader'     => (string) get_post_meta( $track->ID, '_callboard_uploader', true ),
				'uploader_url' => (string) get_post_meta( $track->ID, '_callboard_uploader_url', true ),
			);
		}

		return array(
			'version'      => self::VERSION,
			'generator'    => 'callboard/' . CALLBOARD_VERSION,
			'name'         => $set->post_title,
			'slug'         => $set->post_name,
			'order'        => (int) $set->menu_order,
			'playlist_url' => (string) ( $credits['playlist_url'] ?? '' ),
			'curator'      => (string) ( $credits['curator'] ?? '' ),
			'curator_url'  => (string) ( $credits['curator_url'] ?? '' ),
			'tracks'       => $tracks,
		);
	}

	/**
	 * The sidecars for a set, each keyed the way the manifest keys its tracks.
	 *
	 * @param WP_Post $set Set post.
	 * @return array<string, array<string, mixed>>
	 */
	public static function sidecars( WP_Post $set ): array {
		$out = array_fill_keys( self::SIDECARS, array() );

		foreach ( Sets::track_posts( $set->ID ) as $track ) {
			$file = get_attached_file( $track->ID );
			if ( ! $file || ! file_exists( $file ) ) {
				continue;
			}
			$key    = self::track_key( $track->ID, $file );
			$levels = (string) get_post_meta( $track->ID, '_callboard_levels', true );
			$lyrics = get_post_meta( $track->ID, '_callboard_lyrics', true );
			$notes  = get_post_meta( $track->ID, '_callboard_notes', true );
			$bpm    = (int) get_post_meta( $track->ID, '_callboard_bpm', true );

			if ( '' !== $levels ) {
				$out['levels'][ $key ] = $levels;
			}
			if ( is_array( $lyrics ) && $lyrics ) {
				$out['lyrics'][ $key ] = array_values( $lyrics );
			}
			if ( is_array( $notes ) && $notes ) {
				$out['notes'][ $key ] = array_values( $notes );
			}
			if ( $bpm > 0 ) {
				$out['tempo'][ $key ] = $bpm;
			}
		}

		return $out;
	}

	/**
	 * Write a set to a .callboard file.
	 *
	 * @param WP_Post $set  Set post.
	 * @param string  $path Absolute destination path.
	 * @return string|WP_Error The path written.
	 */
	public static function write( WP_Post $set, string $path ) {
		if ( ! self::available() ) {
			return new WP_Error( 'callboard_no_zip', __( 'This server has no ZipArchive, so sets cannot be exported.', 'callboard' ) );
		}

		$manifest = self::manifest( $set );
		if ( ! $manifest['tracks'] ) {
			return new WP_Error( 'callboard_empty_set', __( 'That set has no audio to export.', 'callboard' ) );
		}

		$zip = new ZipArchive();
		if ( true !== $zip->open( $path, ZipArchive::CREATE | ZipArchive::OVERWRITE ) ) {
			return new WP_Error( 'callboard_zip_open', __( 'Could not create the file.', 'callboard' ) );
		}

		$zip->addFromString( 'manifest.json', (string) wp_json_encode( $manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );

		foreach ( Sets::track_posts( $set->ID ) as $track ) {
			$file = get_attached_file( $track->ID );
			if ( $file && file_exists( $file ) ) {
				$zip->addFile( $file, basename( $file ) );
			}
		}

		foreach ( self::sidecars( $set ) as $name => $data ) {
			if ( $data ) {
				$zip->addFromString( $name . '.json', (string) wp_json_encode( $data, JSON_UNESCAPED_UNICODE ) );
			}
		}

		// The marker is the whole file: its presence is the setting.
		if ( get_post_meta( $set->ID, '_callboard_lyrics_approved', true ) ) {
			$zip->addFromString( 'lyrics.approved', '' );
		}

		foreach ( array( 'cover', 'share' ) as $role ) {
			$image = self::image_path( $set->ID, $role );
			if ( $image ) {
				$zip->addFile( $image, $role . '.png' );
			}
		}

		$zip->close();

		return $path;
	}

	/**
	 * Unpack a .callboard file into an import folder.
	 *
	 * @param string $zip_path Absolute path to the uploaded file.
	 * @param string $slug     Optional slug override; the manifest's own is used otherwise.
	 * @return string|WP_Error Absolute path to the folder.
	 */
	public static function unpack( string $zip_path, string $slug = '' ) {
		if ( ! self::available() ) {
			return new WP_Error( 'callboard_no_zip', __( 'This server has no ZipArchive, so sets cannot be imported from a file.', 'callboard' ) );
		}

		$zip = new ZipArchive();
		if ( true !== $zip->open( $zip_path ) ) {
			return new WP_Error( 'callboard_zip_open', __( 'That file is not readable as a zip.', 'callboard' ) );
		}

		$raw = $zip->getFromName( 'manifest.json' );
		if ( false === $raw ) {
			$zip->close();
			return new WP_Error( 'callboard_no_manifest', __( 'That file has no manifest.json, so it is not a set.', 'callboard' ) );
		}

		$manifest = json_decode( (string) $raw, true );
		if ( ! is_array( $manifest ) || empty( $manifest['name'] ) ) {
			$zip->close();
			return new WP_Error( 'callboard_bad_manifest', __( 'That file\'s manifest is unreadable.', 'callboard' ) );
		}
		if ( (int) ( $manifest['version'] ?? 1 ) > self::VERSION ) {
			$zip->close();
			/* translators: %d: format version found in the file. */
			return new WP_Error( 'callboard_new_format', sprintf( __( 'That file is format version %d, which this version of Callboard cannot read. Update the plugin.', 'callboard' ), (int) $manifest['version'] ) );
		}

		$slug = sanitize_title( $slug ? $slug : (string) ( $manifest['slug'] ?? $manifest['name'] ) );
		if ( ! $slug ) {
			$zip->close();
			return new WP_Error( 'callboard_bad_slug', __( 'That set has no usable slug.', 'callboard' ) );
		}

		$dir = Importer::source_dir() . '/' . $slug;
		if ( ! wp_mkdir_p( $dir ) ) {
			$zip->close();
			return new WP_Error( 'callboard_mkdir', __( 'Could not create the set folder.', 'callboard' ) );
		}

		// Extract by name rather than with extractTo(): an archive from anywhere can carry
		// `../` or an absolute path, and a set is a flat folder, so anything with a directory
		// separator in it is not ours to write.
		$total = $zip->count();
		for ( $i = 0; $i < $total; $i++ ) {
			$name = (string) $zip->getNameIndex( $i );
			if ( ! self::safe_entry( $name ) ) {
				continue;
			}
			$contents = $zip->getFromIndex( $i );
			if ( false !== $contents ) {
				file_put_contents( $dir . '/' . $name, $contents ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- writing inside the uploads dir the importer owns.
			}
		}
		$zip->close();

		return $dir;
	}

	/**
	 * Whether a zip entry is one a set folder may contain.
	 *
	 * @param string $name Entry name as the archive records it.
	 */
	private static function safe_entry( string $name ): bool {
		if ( '' === $name || str_contains( $name, '/' ) || str_contains( $name, '\\' ) || str_starts_with( $name, '.' ) ) {
			return false;
		}
		if ( 'manifest.json' === $name || 'lyrics.approved' === $name ) {
			return true;
		}
		if ( in_array( pathinfo( $name, PATHINFO_FILENAME ), self::SIDECARS, true ) && 'json' === strtolower( (string) pathinfo( $name, PATHINFO_EXTENSION ) ) ) {
			return true;
		}

		return (bool) preg_match( '/\.(mp3|m4a|opus|webm|ogg|png|jpe?g)$/i', $name );
	}

	/**
	 * The file behind a set's cover or share image, if there is one.
	 *
	 * @param int    $set_id Set post ID.
	 * @param string $role   'cover' or 'share'.
	 */
	private static function image_path( int $set_id, string $role ): ?string {
		$id = (int) get_post_meta( $set_id, '_callboard_' . $role . '_image', true );
		if ( ! $id && 'cover' === $role ) {
			$id = (int) get_post_thumbnail_id( $set_id );
		}
		$file = $id ? get_attached_file( $id ) : '';

		return $file && file_exists( $file ) ? $file : null;
	}

	/**
	 * The download's file name, without a path.
	 *
	 * @param WP_Post $set Set post.
	 */
	public static function filename( WP_Post $set ): string {
		return sanitize_file_name( ( $set->post_name ? $set->post_name : 'set' ) . '.' . self::EXT );
	}

	/**
	 * Admin: stream a set to the browser as a .callboard file.
	 */
	public static function handle_admin_export(): void {
		$set_id = isset( $_GET['set'] ) ? (int) $_GET['set'] : 0;
		check_admin_referer( 'callboard_export_' . $set_id );
		if ( ! current_user_can( 'edit_post', $set_id ) ) {
			wp_die( esc_html__( 'You cannot export that set.', 'callboard' ) );
		}

		$set = get_post( $set_id );
		if ( ! $set instanceof WP_Post || Post_Types::SET !== $set->post_type ) {
			wp_die( esc_html__( 'That is not a set.', 'callboard' ) );
		}

		$path   = trailingslashit( get_temp_dir() ) . uniqid( 'callboard-', true ) . '.' . self::EXT;
		$result = self::write( $set, $path );
		if ( is_wp_error( $result ) ) {
			wp_die( esc_html( $result->get_error_message() ) );
		}

		nocache_headers();
		header( 'Content-Type: ' . self::TYPE );
		header( 'Content-Disposition: attachment; filename="' . self::filename( $set ) . '"' );
		header( 'Content-Length: ' . (string) filesize( $path ) );
		readfile( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile -- streaming a temp file to the browser.
		wp_delete_file( $path );
		exit;
	}
}
