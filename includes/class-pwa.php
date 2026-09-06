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
	 * The iPhone screens we draw launch images for: [width, height, device-pixel-ratio] in portrait.
	 *
	 * @return array<int, array{0: int, 1: int, 2: int}>
	 */
	public static function splash_sizes(): array {
		return array(
			array( 1320, 2868, 3 ),
			array( 1206, 2622, 3 ),
			array( 1290, 2796, 3 ),
			array( 1179, 2556, 3 ),
			array( 1170, 2532, 3 ),
			array( 1080, 2340, 3 ),
			array( 1242, 2688, 3 ),
			array( 1125, 2436, 3 ),
			array( 828, 1792, 2 ),
			array( 750, 1334, 2 ),
		);
	}

	/**
	 * Where launch images live and their URL base.
	 *
	 * @return array{dir: string, url: string}
	 */
	public static function splash_location(): array {
		$u = wp_upload_dir( null, false );
		return array(
			'dir' => $u['basedir'] . '/callboard/splash',
			'url' => $u['baseurl'] . '/callboard/splash',
		);
	}

	/**
	 * Draw launch images (light and dark) so the installed app doesn't flash white. Skipped without GD.
	 */
	public static function write_splash_screens(): void {
		if ( ! function_exists( 'imagecreatetruecolor' ) || ! function_exists( 'imagettftext' ) ) {
			return;
		}
		$loc  = self::splash_location();
		$name = callboard_site_name();
		$key  = md5( $name . CALLBOARD_VERSION );
		if ( get_option( 'callboard_splash_key' ) === $key && is_dir( $loc['dir'] ) ) {
			return;
		}
		wp_mkdir_p( $loc['dir'] );
		$icon    = @imagecreatefrompng( CALLBOARD_DIR . 'assets/icon-512.png' ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		$font    = CALLBOARD_DIR . 'assets/fonts/Poppins-SemiBold.ttf';
		$schemes = array(
			'light' => array( array( 236, 234, 229 ), array( 30, 28, 26 ) ),
			'dark'  => array( array( 22, 22, 22 ), array( 242, 241, 238 ) ),
		);
		foreach ( $schemes as $scheme => $colors ) {
			foreach ( self::splash_sizes() as $dims ) {
				list( $w, $h, $dpr ) = $dims;
				$im                  = imagecreatetruecolor( $w, $h );
				imagefill( $im, 0, 0, imagecolorallocate( $im, ...$colors[0] ) );
				$size = (int) round( $w * 0.22 );
				if ( $icon ) {
					imagecopyresampled( $im, $icon, (int) ( ( $w - $size ) / 2 ), (int) ( $h / 2 - $size * 0.85 ), 0, 0, $size, $size, imagesx( $icon ), imagesy( $icon ) );
				}
				$pt  = (int) round( 14 * $dpr );
				$box = imagettfbbox( $pt, 0, $font, $name );
				$tw  = $box ? $box[2] - $box[0] : 0;
				imagettftext( $im, $pt, 0, (int) ( ( $w - $tw ) / 2 ), (int) ( $h / 2 + $size * 0.45 ), imagecolorallocate( $im, ...$colors[1] ), $font, $name );
				imagepng( $im, sprintf( '%s/%s-%dx%d.png', $loc['dir'], $scheme, $w, $h ), 6 );
				imagedestroy( $im );
			}
		}
		if ( $icon ) {
			imagedestroy( $icon );
		}
		update_option( 'callboard_splash_key', $key, false );
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
			'id'               => $root,
			'display'          => 'standalone',
			'display_override' => array( 'standalone', 'minimal-ui' ),
			'categories'       => array( 'music', 'education' ),
			'shortcuts'        => array_map(
				static fn( array $set ) => array(
					'name'  => $set['name'],
					'url'   => wp_make_link_relative( home_url( '/' . $set['slug'] . '/' ) ),
					'icons' => array(
						array(
							'src'   => wp_make_link_relative( CALLBOARD_URL . 'assets/icon-192.png' ),
							'sizes' => '192x192',
						),
					),
				),
				array_slice( Sets::all(), 0, 4 )
			),
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
		self::write_splash_screens();
		$ok  = $wp_filesystem->put_contents( ABSPATH . 'manifest.json', wp_json_encode( $manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), FS_CHMOD_FILE );
		$ok2 = $wp_filesystem->put_contents( ABSPATH . 'sw.js', $sw, FS_CHMOD_FILE );
		return (bool) ( $ok && $ok2 );
	}
}
