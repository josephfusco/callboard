<?php
/**
 * Home-screen app files. The service worker must be served from the site root to control the site,
 * so both files are written to ABSPATH (WP Engine and most hosts allow it).
 *
 * @package Callboard
 */

namespace Callboard;

defined( 'ABSPATH' ) || exit;

/**
 * Web app manifest and service worker.
 */
final class Pwa {

	/**
	 * Hook registration.
	 */
	public static function register_hooks(): void {
		add_action( 'update_option_blogname', array( self::class, 'write_files' ) );
		add_action( 'callboard_imported', array( self::class, 'write_files' ) );
		add_action( 'upgrader_process_complete', array( self::class, 'write_files' ) );
	}

	/**
	 * Write manifest.json and sw.js into the site root.
	 *
	 * @return bool Whether both files were written.
	 */
	public static function write_files(): bool {
		global $wp_filesystem;
		require_once ABSPATH . 'wp-admin/includes/file.php';
		if ( ! WP_Filesystem() ) {
			return false;
		}
		$root     = wp_make_link_relative( home_url( '/' ) );
		$root     = '' !== $root ? $root : '/';
		$name     = callboard_site_name();
		$short    = mb_strlen( $name ) > 12 ? rtrim( mb_substr( $name, 0, 12 ) ) : $name;
		$manifest = array(
			'name'             => $name,
			'short_name'       => $short,
			'description'      => Settings::get( 'tagline' ),
			'start_url'        => $root,
			'scope'            => $root,
			'display'          => 'standalone',
			'orientation'      => 'portrait',
			'background_color' => '#eceae5',
			'theme_color'      => '#eceae5',
			'icons'            => array(
				array(
					'src'   => wp_make_link_relative( CALLBOARD_URL . 'assets/icon-192.png' ),
					'sizes' => '192x192',
					'type'  => 'image/png',
				),
				array(
					'src'   => wp_make_link_relative( CALLBOARD_URL . 'assets/icon-512.png' ),
					'sizes' => '512x512',
					'type'  => 'image/png',
				),
				array(
					'src'     => wp_make_link_relative( CALLBOARD_URL . 'assets/icon-512-maskable.png' ),
					'sizes'   => '512x512',
					'type'    => 'image/png',
					'purpose' => 'maskable',
				),
			),
		);
		$sw       = str_replace(
			array( '__VERSION__', '__PLUGIN_PATH__' ),
			array( (string) time(), wp_make_link_relative( CALLBOARD_URL ) ),
			(string) $wp_filesystem->get_contents( CALLBOARD_DIR . 'pwa/sw.js' )
		);
		$ok       = $wp_filesystem->put_contents( ABSPATH . 'manifest.json', wp_json_encode( $manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), FS_CHMOD_FILE );
		$ok2      = $wp_filesystem->put_contents( ABSPATH . 'sw.js', $sw, FS_CHMOD_FILE );
		return (bool) ( $ok && $ok2 );
	}
}
