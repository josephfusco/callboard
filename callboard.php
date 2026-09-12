<?php
/**
 * Plugin Name: Callboard
 * Description: Rehearsal tracks for a cast. Sets of audio, a persistent player, installable as a home-screen app.
 * Version: 2.1.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Plugin URI: https://josephfus.co/callboard/
 * Author: Joe Fusco
 * Author URI: https://josephfus.co/
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: callboard
 * Domain Path: /languages
 *
 * @package Callboard
 */

defined( 'ABSPATH' ) || exit;

define( 'CALLBOARD_VERSION', '2.1.0' );
define( 'CALLBOARD_FILE', __FILE__ );
define( 'CALLBOARD_DIR', plugin_dir_path( __FILE__ ) );
define( 'CALLBOARD_URL', plugin_dir_url( __FILE__ ) );

if ( is_readable( CALLBOARD_DIR . 'vendor/autoload.php' ) ) {
	require_once CALLBOARD_DIR . 'vendor/autoload.php';
}
require_once CALLBOARD_DIR . 'includes/helpers.php';

spl_autoload_register(
	static function ( string $class_name ): void {
		if ( ! str_starts_with( $class_name, 'Callboard\\' ) ) {
			return;
		}
		$file = CALLBOARD_DIR . 'includes/class-' . strtolower( str_replace( '_', '-', substr( $class_name, 10 ) ) ) . '.php';
		if ( is_readable( $file ) ) {
			require $file;
		}
	}
);

register_activation_hook( __FILE__, array( Callboard\Plugin::class, 'activate' ) );
add_action( 'plugins_loaded', array( Callboard\Plugin::class, 'boot' ) );
