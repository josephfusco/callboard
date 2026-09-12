<?php
/**
 * Two routes: the home page (all sets) and /<set-slug>/. Everything else falls back to home with a note.
 *
 * @package Callboard
 */

namespace Callboard;

defined( 'ABSPATH' ) || exit;

/**
 * Front-end routing.
 */
final class Router {

	/**
	 * Hook registration.
	 */
	public static function register_hooks(): void {
		add_filter( 'pre_handle_404', array( self::class, 'prevent_404' ) );
		add_filter( 'template_include', array( self::class, 'template' ), PHP_INT_MAX );
		add_filter( 'pre_get_document_title', array( self::class, 'title' ) );
	}

	/**
	 * Which view is this request? '' = home, 'slug' = a set, null = unknown path.
	 */
	public static function view(): ?string {
		static $view = false;
		if ( false !== $view ) {
			return $view;
		}
		$request = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '/';
		$path    = trim( (string) wp_parse_url( $request, PHP_URL_PATH ), '/' );
		$base    = trim( (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH ), '/' );
		if ( $base && str_starts_with( $path, $base ) ) {
			$path = trim( substr( $path, strlen( $base ) ), '/' );
		}
		if ( '' === $path ) {
			$view = '';
		} elseif ( preg_match( '/^[a-z0-9-]+$/', $path ) && Sets::by_slug( $path ) ) {
			$view = $path;
		} else {
			$view = null;
		}
		return $view;
	}

	/**
	 * Our routes are never 404s.
	 *
	 * @param bool $pre Whether to short-circuit.
	 */
	public static function prevent_404( bool $pre ): bool {
		return null !== self::view() ? true : $pre;
	}

	/**
	 * Render every front-end request with the plugin template.
	 */
	public static function template(): string {
		if ( ! Gate::allowed() ) {
			return CALLBOARD_DIR . 'templates/gate.php';
		}

		return CALLBOARD_DIR . ( self::is_fragment() ? 'templates/fragment.php' : 'templates/index.php' );
	}

	/**
	 * A view without the shell, for the script to swap in on navigation. Same templates, same data.
	 */
	public static function is_fragment(): bool {
		return isset( $_GET['fragment'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- a read-only render switch.
	}

	/**
	 * Document title.
	 */
	public static function title(): string {
		$view = self::view();
		return $view && Gate::allowed() ? Sets::by_slug( $view )['name'] . ' · ' . callboard_site_name() : callboard_site_name();
	}

	/**
	 * Page title for the current view (compact bar, link previews).
	 */
	public static function page_title(): string {
		$view = self::view();
		return $view && Gate::allowed() ? Sets::by_slug( $view )['name'] : callboard_site_name();
	}
}
