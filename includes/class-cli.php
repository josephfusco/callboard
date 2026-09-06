<?php
/**
 * WP-CLI: fetch sets from YouTube, drain the admin queue, import folders.
 *
 * @package Callboard
 */

namespace Callboard;

use WP_CLI;

defined( 'ABSPATH' ) || exit;

/**
 * `wp callboard` commands.
 */
final class Cli {

	/**
	 * Register with WP-CLI.
	 */
	public static function register(): void {
		WP_CLI::add_command( 'callboard', self::class );
	}

	/**
	 * Fetch a YouTube video or playlist as a new set.
	 *
	 * ## OPTIONS
	 *
	 * <url>
	 * : YouTube video or playlist URL.
	 *
	 * --name=<name>
	 * : Set name shown to the cast.
	 *
	 * [--slug=<slug>]
	 * : Folder and URL slug. Defaults to the name.
	 *
	 * ## EXAMPLES
	 *
	 *     wp callboard fetch 'https://www.youtube.com/playlist?list=…' --name="Spring Show"
	 *
	 * @param string[]              $args       Positional args.
	 * @param array<string, string> $assoc_args Named args.
	 */
	public function fetch( array $args, array $assoc_args ): void {
		$url  = (string) $args[0];
		$name = (string) ( $assoc_args['name'] ?? '' );
		$slug = sanitize_title( (string) ( $assoc_args['slug'] ?? $name ) );
		if ( '' === $name || '' === $slug ) {
			WP_CLI::error( 'Give the set a --name.' );
		}
		self::require_tools();
		$manifest = Fetcher::fetch( $url, $slug, $name, static fn( string $line ) => WP_CLI::log( '  ' . $line ) );
		if ( is_wp_error( $manifest ) ) {
			WP_CLI::error( $manifest->get_error_message() );
		}
		$result = Importer::import_folder( Importer::source_dir() . '/' . $slug );
		do_action( 'callboard_imported', array( $slug => $result ) );
		WP_CLI::success( $result . ' ' . home_url( '/' . $slug . '/' ) );
	}

	/**
	 * Fetch everything queued from Sets → Import → "From YouTube".
	 *
	 * ## OPTIONS
	 *
	 * [--watch]
	 * : Keep polling for new requests.
	 *
	 * [--interval=<seconds>]
	 * : Seconds between polls with --watch.
	 * ---
	 * default: 60
	 * ---
	 *
	 * @param string[]              $args       Positional args.
	 * @param array<string, string> $assoc_args Named args.
	 */
	public function run( array $args, array $assoc_args ): void {
		self::require_tools();
		do {
			$queued = Requests::all( 'queued' );
			if ( ! $queued ) {
				WP_CLI::log( 'Nothing queued.' );
			}
			foreach ( $queued as $post ) {
				$r = Requests::to_array( $post );
				WP_CLI::log( sprintf( '→ %s (%s) %s', $r['name'], $r['slug'], $r['url'] ) );
				Requests::set_status( $r['id'], 'running', 'fetching' );
				$manifest = Fetcher::fetch( $r['url'], $r['slug'], $r['name'], static fn( string $line ) => WP_CLI::log( '  ' . $line ) );
				if ( is_wp_error( $manifest ) ) {
					Requests::set_status( $r['id'], 'failed', $manifest->get_error_message() );
					WP_CLI::warning( $manifest->get_error_message() );
					continue;
				}
				$result = Importer::import_folder( Importer::source_dir() . '/' . $r['slug'] );
				Requests::set_status( $r['id'], Sets::post_by_slug( $r['slug'] ) ? 'done' : 'failed', $result );
				do_action( 'callboard_imported', array( $r['slug'] => $result ) );
				WP_CLI::success( $result );
			}
			if ( isset( $assoc_args['watch'] ) ) {
				sleep( max( 5, (int) ( $assoc_args['interval'] ?? 60 ) ) );
			}
		} while ( isset( $assoc_args['watch'] ) );
	}

	/**
	 * Import every set folder in the uploads/callboard directory.
	 *
	 * @param string[]              $args       Positional args.
	 * @param array<string, string> $assoc_args Named args.
	 */
	public function import( array $args, array $assoc_args ): void { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- WP-CLI signature.
		$results = Importer::import_all();
		if ( ! $results ) {
			WP_CLI::log( 'Nothing to import in ' . Importer::source_dir() );
			return;
		}
		foreach ( $results as $slug => $message ) {
			WP_CLI::log( sprintf( '%s: %s', $slug, $message ) );
		}
		WP_CLI::success( 'Imported.' );
	}

	/**
	 * Show which fetch tools this environment has.
	 *
	 * @param string[]              $args       Positional args.
	 * @param array<string, string> $assoc_args Named args.
	 */
	public function doctor( array $args, array $assoc_args ): void { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- WP-CLI signature.
		$tools = Fetcher::tools();
		WP_CLI::log( 'proc_open: ' . ( function_exists( 'proc_open' ) ? 'available' : 'disabled' ) );
		WP_CLI::log( 'yt-dlp:    ' . ( $tools['ytdlp'] ?? 'not found' ) );
		WP_CLI::log( 'ffmpeg:    ' . ( $tools['ffmpeg'] ?? 'not found (audio will be kept as m4a)' ) );
		WP_CLI::log( 'GD:        ' . ( function_exists( 'imagettftext' ) ? 'available' : 'missing (no artwork will be drawn)' ) );
		WP_CLI::log( 'import dir: ' . Importer::source_dir() );
	}

	/**
	 * Stop early with a clear message when fetching is impossible here.
	 */
	private static function require_tools(): void {
		if ( ! Fetcher::available() ) {
			WP_CLI::error( 'Fetching needs proc_open and yt-dlp on this machine. Run `wp callboard doctor`, or build the set folder elsewhere and use `wp callboard import`.' );
		}
	}
}
