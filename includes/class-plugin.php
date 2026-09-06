<?php
/**
 * Wires the plugin together.
 *
 * @package Callboard
 */

namespace Callboard;

defined( 'ABSPATH' ) || exit;

/**
 * Plugin bootstrap.
 */
final class Plugin {

	/**
	 * Register every component.
	 */
	public static function boot(): void {
		Post_Types::register_hooks();
		Sets::register_hooks();
		Importer::register_hooks();
		Router::register_hooks();
		Frontend::register_hooks();
		Privacy::register_hooks();
		Pwa::register_hooks();
		if ( is_admin() ) {
			Admin::register_hooks();
		}
	}

	/**
	 * Activation: register types, write PWA files, import anything waiting.
	 */
	public static function activate(): void {
		Post_Types::register();
		Pwa::write_files();
		Importer::import_all();
		flush_rewrite_rules();
	}
}
