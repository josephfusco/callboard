<?php
/**
 * Badging: the number on the Home Screen icon.
 *
 * A notification sets the icon's badge from the service worker. Opening the app is reading what the
 * badge was for, so this extension contributes zero to the app badge, and a page whose contributors
 * add up to zero clears it. The contribution is in the callboard/badging section of assets/app.js;
 * this side only registers the id, so the site decides whether it runs. Unregister it and the badge
 * stays until something else clears it.
 *
 * @package Callboard
 */

namespace Callboard\Extension;

defined( 'ABSPATH' ) || exit;

/**
 * The badging extension.
 */
final class Badging {

	/**
	 * Register with the extension registry.
	 */
	public static function register(): void {
		/**
		 * The badging extension. Unregister it by this id and the page leaves the badge alone.
		 */
		callboard_register_extension(
			'callboard/badging',
			array(
				'title'       => __( 'Home Screen badge', 'callboard' ),
				'version'     => '1.0.0',
				'api_version' => 1,
			)
		);
	}
}
