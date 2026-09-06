<?php
/**
 * Imports sets from folders in uploads/callboard/<slug>/ (manifest.json + audio files).
 *
 * The folder is an import format; once imported, posts are the source of truth.
 * Re-imports refresh order, credits and lyrics but never overwrite titles edited in the admin.
 *
 * @package Callboard
 */

namespace Callboard;

use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * Folder importer.
 */
final class Importer {

	private const STAMP_OPTION = 'callboard_import_stamp';

	/**
	 * Hook registration.
	 */
	public static function register_hooks(): void {
		add_action( 'init', array( self::class, 'maybe_import' ), 20 );
		add_action( 'admin_post_callboard_import', array( self::class, 'handle_admin_import' ) );
	}

	/**
	 * Where import folders live.
	 */
	public static function source_dir(): string {
		$dir = wp_upload_dir( null, false )['basedir'] . '/callboard';
		/**
		 * Filter the import directory.
		 *
		 * @param string $dir Absolute path.
		 */
		return (string) apply_filters( 'callboard_import_dir', $dir );
	}

	/**
	 * Import when the deploy stamp file has changed since the last run.
	 */
	public static function maybe_import(): void {
		$stamp_file = self::source_dir() . '/.deploy';
		if ( ! file_exists( $stamp_file ) ) {
			return;
		}
		$stamp = trim( (string) file_get_contents( $stamp_file ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( $stamp && get_option( self::STAMP_OPTION ) !== $stamp ) {
			update_option( self::STAMP_OPTION, $stamp, false );
			self::import_all();
		}
	}

	/**
	 * Import every folder that has a manifest.
	 *
	 * @return array<string, string> slug => result message.
	 */
	public static function import_all(): array {
		$results   = array();
		$manifests = glob( self::source_dir() . '/*/manifest.json' );
		foreach ( is_array( $manifests ) ? $manifests : array() as $manifest ) {
			$slug             = basename( dirname( $manifest ) );
			$results[ $slug ] = self::import_folder( dirname( $manifest ) );
		}
		if ( $results ) {
			/**
			 * Fires after an import pass.
			 *
			 * @param array<string, string> $results Per-slug messages.
			 */
			do_action( 'callboard_imported', $results );
		}
		return $results;
	}

	/**
	 * Import one set folder.
	 *
	 * @param string $dir Absolute folder path.
	 * @return string Human-readable result.
	 */
	public static function import_folder( string $dir ): string {
		$slug = sanitize_title( basename( $dir ) );
		$data = json_decode( (string) file_get_contents( $dir . '/manifest.json' ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( ! is_array( $data ) || empty( $data['tracks'] ) ) {
			return __( 'No manifest or no tracks.', 'callboard' );
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$set = Sets::post_by_slug( $slug );
		if ( ! $set ) {
			$set_id = wp_insert_post(
				array(
					'post_type'   => Post_Types::SET,
					'post_status' => 'publish',
					'post_name'   => $slug,
					'post_title'  => sanitize_text_field( $data['name'] ?? ucwords( str_replace( '-', ' ', $slug ) ) ),
					'menu_order'  => (int) ( $data['order'] ?? 0 ),
				),
				true
			);
			if ( is_wp_error( $set_id ) ) {
				return $set_id->get_error_message();
			}
			$set = get_post( $set_id );
		}
		if ( ! $set instanceof WP_Post ) {
			return __( 'Could not create the set.', 'callboard' );
		}

		update_post_meta(
			$set->ID,
			'_callboard_credits',
			array(
				'playlist_url' => esc_url_raw( (string) ( $data['playlist_url'] ?? '' ) ),
				'curator'      => sanitize_text_field( (string) ( $data['curator'] ?? '' ) ),
				'curator_url'  => esc_url_raw( (string) ( $data['curator_url'] ?? '' ) ),
			)
		);
		if ( file_exists( $dir . '/lyrics.approved' ) ) {
			update_post_meta( $set->ID, '_callboard_lyrics_approved', 1 );
		}

		$lyrics   = file_exists( $dir . '/lyrics.json' ) ? (array) json_decode( (string) file_get_contents( $dir . '/lyrics.json' ), true ) : array(); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$existing = array();
		foreach ( Sets::track_posts( $set->ID ) as $track ) {
			$existing[ (string) get_post_meta( $track->ID, '_callboard_video_id', true ) ] = $track->ID;
		}

		$added = 0;
		foreach ( $data['tracks'] as $t ) {
			$file = isset( $t['file'] ) ? $dir . '/' . $t['file'] : null;
			if ( ! $file || ! file_exists( $file ) ) {
				continue;
			}
			$video_id = sanitize_text_field( (string) ( $t['id'] ?? '' ) );
			$order    = (int) ( $t['index'] ?? 0 );
			$track_id = $existing[ $video_id ] ?? 0;

			if ( ! $track_id ) {
				$track_id = self::attach_file( $file, $set->ID, self::clean_title( (string) ( $t['title'] ?? $video_id ) ), $order );
				if ( ! $track_id ) {
					continue;
				}
				update_post_meta( $track_id, '_callboard_video_id', $video_id );
				++$added;
			} else {
				wp_update_post(
					array(
						'ID'          => $track_id,
						'menu_order'  => $order,
						'post_parent' => $set->ID,
					)
				);
			}
			update_post_meta( $track_id, '_callboard_source_url', esc_url_raw( (string) ( $t['url'] ?? '' ) ) );
			update_post_meta( $track_id, '_callboard_uploader', sanitize_text_field( (string) ( $t['uploader'] ?? '' ) ) );
			update_post_meta( $track_id, '_callboard_uploader_url', esc_url_raw( (string) ( $t['uploader_url'] ?? '' ) ) );
			if ( isset( $t['duration'] ) ) {
				update_post_meta( $track_id, '_callboard_duration', (float) $t['duration'] );
			}
			if ( ! empty( $lyrics[ $video_id ] ) && is_array( $lyrics[ $video_id ] ) ) {
				update_post_meta( $track_id, '_callboard_lyrics', self::sanitize_cues( $lyrics[ $video_id ] ) );
			}
		}

		self::import_image( $dir . '/cover.png', $set->ID, 'cover' );
		self::import_image( $dir . '/share.png', $set->ID, 'share' );

		Sets::flush();
		/* translators: 1: set name, 2: number of new tracks. */
		return sprintf( __( '%1$s: %2$d new tracks.', 'callboard' ), $set->post_title, $added );
	}

	/**
	 * Register a file already in the uploads directory as an attachment of a set.
	 *
	 * @param string $file   Absolute path.
	 * @param int    $set_id Set post ID.
	 * @param string $title  Attachment title.
	 * @param int    $order  Menu order.
	 * @return int Attachment ID or 0.
	 */
	private static function attach_file( string $file, int $set_id, string $title, int $order ): int {
		$type = wp_check_filetype( basename( $file ) );
		$id   = wp_insert_attachment(
			array(
				'post_mime_type' => $type['type'] ? $type['type'] : 'application/octet-stream',
				'post_title'     => $title,
				'post_status'    => 'inherit',
				'post_parent'    => $set_id,
				'menu_order'     => $order,
			),
			$file,
			$set_id,
			true
		);
		if ( is_wp_error( $id ) ) {
			return 0;
		}
		wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $file ) );
		return (int) $id;
	}

	/**
	 * Import cover / share image for a set if the file is present and changed.
	 *
	 * @param string $file Absolute path.
	 * @param int    $set  Set post ID.
	 * @param string $role 'cover' or 'share'.
	 */
	private static function import_image( string $file, int $set, string $role ): void {
		if ( ! file_exists( $file ) ) {
			return;
		}
		$meta_key = '_callboard_' . $role . '_image';
		$current  = (int) get_post_meta( $set, $meta_key, true );
		$mtime    = (string) filemtime( $file );
		if ( $current && get_post_meta( $current, '_callboard_source_mtime', true ) === $mtime ) {
			return;
		}
		if ( $current ) {
			wp_delete_attachment( $current, true );
		}
		$id = self::attach_file( $file, $set, get_the_title( $set ) . ' – ' . $role, 0 );
		if ( ! $id ) {
			return;
		}
		update_post_meta( $id, '_callboard_source_mtime', $mtime );
		update_post_meta( $set, $meta_key, $id );
		if ( 'cover' === $role ) {
			set_post_thumbnail( $set, $id );
		}
	}

	/**
	 * "3. Be Our Guest (Some Show OBC)" → "Be Our Guest".
	 *
	 * @param string $title Raw title.
	 */
	public static function clean_title( string $title ): string {
		$title = preg_replace( '/^\s*\d+\s*[.)-]\s*/', '', $title );
		$title = preg_replace( '/\s*[\(\[][^)\]]*[\)\]]\s*$/', '', $title );
		$title = str_replace( array( ' / ', '/' ), ' / ', $title );
		return sanitize_text_field( trim( preg_replace( '/\s+/', ' ', $title ) ) );
	}

	/**
	 * Cues as [[start, end, text], ...] with sane types.
	 *
	 * @param array<int, mixed> $cues Raw cues.
	 * @return array<int, array{0: float, 1: float, 2: string}>
	 */
	private static function sanitize_cues( array $cues ): array {
		$out = array();
		foreach ( $cues as $cue ) {
			if ( is_array( $cue ) && count( $cue ) >= 3 ) {
				$out[] = array( (float) $cue[0], (float) $cue[1], sanitize_text_field( (string) $cue[2] ) );
			}
		}
		return $out;
	}

	/**
	 * Admin "Import now" button.
	 */
	public static function handle_admin_import(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Not allowed.', 'callboard' ) );
		}
		check_admin_referer( 'callboard_import' );
		$results = self::import_all();
		set_transient( 'callboard_import_notice', $results ? $results : array( __( 'Nothing to import.', 'callboard' ) ), 60 );
		wp_safe_redirect( admin_url( 'edit.php?post_type=' . Post_Types::SET ) );
		exit;
	}
}
