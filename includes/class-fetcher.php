<?php
/**
 * Builds a set folder from a YouTube URL with yt-dlp (and ffmpeg when present).
 * Runs wherever the binaries exist: a laptop, wp-env, a VPS. Managed hosts use the folder importer instead.
 *
 * @package Callboard
 */

namespace Callboard;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Wraps yt-dlp to produce manifest.json, audio files, lyrics.json, cover.png and share.png.
 */
final class Fetcher {

	/**
	 * Absolute paths of the tools we can use, or null.
	 *
	 * @return array{ytdlp: ?string, ffmpeg: ?string}
	 */
	public static function tools(): array {
		return array(
			'ytdlp'  => self::which( (string) apply_filters( 'callboard_ytdlp_path', 'yt-dlp' ) ),
			'ffmpeg' => self::which( (string) apply_filters( 'callboard_ffmpeg_path', 'ffmpeg' ) ),
		);
	}

	/**
	 * Whether this environment can fetch at all.
	 */
	public static function available(): bool {
		return function_exists( 'proc_open' ) && null !== self::tools()['ytdlp'];
	}

	/**
	 * Fetch a playlist or video into <import dir>/<slug>/ and return the manifest.
	 *
	 * @param string   $url      YouTube URL.
	 * @param string   $slug     Folder / set slug.
	 * @param string   $name     Display name for the set.
	 * @param callable $progress Receives a line of progress text.
	 * @return array<string, mixed>|WP_Error Manifest.
	 */
	public static function fetch( string $url, string $slug, string $name, callable $progress ) {
		$tools = self::tools();
		if ( ! function_exists( 'proc_open' ) || ! $tools['ytdlp'] ) {
			return new WP_Error( 'callboard_no_ytdlp', __( 'yt-dlp is not available here.', 'callboard' ) );
		}
		$dir = Importer::source_dir() . '/' . sanitize_title( $slug );
		if ( ! wp_mkdir_p( $dir ) ) {
			return new WP_Error( 'callboard_mkdir', __( 'Could not create the set folder.', 'callboard' ) );
		}

		$progress( __( 'Reading the playlist…', 'callboard' ) );
		$info = self::run( array( $tools['ytdlp'], '--flat-playlist', '-J', $url ) );
		if ( is_wp_error( $info ) ) {
			return $info;
		}
		$source = json_decode( $info, true );
		if ( ! is_array( $source ) ) {
			return new WP_Error( 'callboard_bad_json', __( 'yt-dlp returned something unexpected.', 'callboard' ) );
		}
		$entries = $source['entries'] ?? array( $source );

		$progress( sprintf( /* translators: %d: number of videos. */ __( 'Downloading audio for %d videos…', 'callboard' ), count( $entries ) ) );
		$cmd = array( $tools['ytdlp'], '-x', '--no-playlist-reverse', '--download-archive', $dir . '/.archive', '-o', $dir . '/%(playlist_index|1)02d - %(title)s [%(id)s].%(ext)s' );
		if ( $tools['ffmpeg'] ) {
			array_push( $cmd, '--audio-format', 'mp3', '--audio-quality', '0', '--ffmpeg-location', dirname( $tools['ffmpeg'] ) );
		} else {
			array_push( $cmd, '-f', 'bestaudio[ext=m4a]/bestaudio' );
		}
		array_push( $cmd, '--write-auto-subs', '--sub-langs', 'en', '--sub-format', 'json3', '-o', 'subtitle:' . $dir . '/.subs/%(id)s', $url );
		$out = self::run( $cmd, $progress );
		if ( is_wp_error( $out ) ) {
			return $out;
		}

		$progress( __( 'Writing the manifest…', 'callboard' ) );
		$overrides = file_exists( $dir . '/titles.json' ) ? (array) json_decode( (string) file_get_contents( $dir . '/titles.json' ), true ) : array(); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$files     = array_map( static fn( string $f ) => $dir . '/' . $f, array_filter( (array) scandir( $dir ), static fn( $f ) => is_string( $f ) && preg_match( '/\.(mp3|m4a|opus|webm|ogg)$/i', $f ) ) ); // no GLOB_BRACE: not on musl.
		$tracks    = array();
		foreach ( array_values( $entries ) as $i => $e ) {
			$vid  = (string) ( $e['id'] ?? '' );
			$file = null;
			foreach ( is_array( $files ) ? $files : array() as $f ) {
				if ( str_contains( basename( $f ), '[' . $vid . ']' ) ) {
					$file = $f;
					break;
				}
			}
			$tracks[] = array(
				'index'        => $i + 1,
				'id'           => $vid,
				'title'        => (string) ( $overrides[ $vid ] ?? $e['title'] ?? $vid ),
				'file'         => $file ? basename( $file ) : null,
				'duration'     => $file ? self::duration( $file, $tools['ffmpeg'] ) : ( isset( $e['duration'] ) ? (float) $e['duration'] : null ),
				'url'          => (string) ( $e['url'] ?? 'https://www.youtube.com/watch?v=' . $vid ),
				'uploader'     => (string) ( $e['uploader'] ?? $e['channel'] ?? '' ),
				'uploader_url' => (string) ( $e['uploader_url'] ?? $e['channel_url'] ?? '' ),
			);
		}
		$manifest = array(
			'name'         => $name,
			'slug'         => sanitize_title( $slug ),
			'order'        => 0,
			'playlist_url' => (string) ( $source['webpage_url'] ?? $url ),
			'curator'      => (string) ( $source['uploader'] ?? $source['channel'] ?? '' ),
			'curator_url'  => (string) ( $source['uploader_url'] ?? $source['channel_url'] ?? '' ),
			'tracks'       => $tracks,
		);
		file_put_contents( $dir . '/manifest.json', wp_json_encode( $manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

		$lyrics = self::lyrics( $dir );
		if ( $lyrics ) {
			file_put_contents( $dir . '/lyrics.json', wp_json_encode( $lyrics, JSON_UNESCAPED_UNICODE ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			$progress( sprintf( /* translators: %d: number of tracks with captions. */ __( 'Captions found for %d tracks (review before enabling).', 'callboard' ), count( $lyrics ) ) );
		}

		$progress( __( 'Drawing the cover and share card…', 'callboard' ) );
		Art::cover( $manifest, $dir . '/cover.png' );
		Art::share( $manifest, $dir . '/share.png' );

		return $manifest;
	}

	/**
	 * YouTube json3 auto-captions → [[start, end, text], ...] per video id. Only tracks with real lyrics.
	 *
	 * @param string $dir Set folder.
	 * @return array<string, array<int, array{0: float, 1: float, 2: string}>>
	 */
	private static function lyrics( string $dir ): array {
		$out   = array();
		$files = glob( $dir . '/.subs/*.json3' );
		foreach ( is_array( $files ) ? $files : array() as $f ) {
			$vid  = explode( '.', basename( $f ) )[0];
			$data = json_decode( (string) file_get_contents( $f ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$cues = array();
			foreach ( (array) ( $data['events'] ?? array() ) as $ev ) {
				$text = '';
				foreach ( (array) ( $ev['segs'] ?? array() ) as $seg ) {
					$text .= (string) ( $seg['utf8'] ?? '' );
				}
				$text = trim( preg_replace( '/\s+/', ' ', str_replace( "\n", ' ', $text ) ) );
				if ( '' === $text || preg_match( '/^\[.*\]$/', $text ) ) {
					continue;
				}
				$start  = ( (float) ( $ev['tStartMs'] ?? 0 ) ) / 1000;
				$cues[] = array( round( $start, 2 ), round( $start + ( (float) ( $ev['dDurationMs'] ?? 4000 ) ) / 1000, 2 ), $text );
			}
			$words = array_sum( array_map( static fn( $c ) => count( explode( ' ', $c[2] ) ), $cues ) );
			if ( count( $cues ) >= 4 && $words >= 20 ) {
				$out[ $vid ] = $cues;
			}
		}
		return $out;
	}

	/**
	 * Duration in seconds via ffprobe when available, else from the audio's metadata reader.
	 *
	 * @param string      $file   Audio file.
	 * @param string|null $ffmpeg ffmpeg path (ffprobe sits beside it).
	 */
	private static function duration( string $file, ?string $ffmpeg ): ?float {
		$ffprobe = $ffmpeg ? dirname( $ffmpeg ) . '/ffprobe' : self::which( 'ffprobe' );
		if ( $ffprobe && is_executable( $ffprobe ) ) {
			$out = self::run( array( $ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', $file ) );
			if ( ! is_wp_error( $out ) && is_numeric( trim( $out ) ) ) {
				return round( (float) trim( $out ), 1 );
			}
		}
		require_once ABSPATH . 'wp-admin/includes/media.php';
		$meta = wp_read_audio_metadata( $file );
		return isset( $meta['length'] ) ? (float) $meta['length'] : null;
	}

	/**
	 * Run a command, streaming stderr lines to $progress. Returns stdout.
	 *
	 * @param string[]      $cmd      Argv.
	 * @param callable|null $progress Line callback.
	 * @return string|WP_Error
	 */
	private static function run( array $cmd, ?callable $progress = null ) {
		$spec = array(
			0 => array( 'pipe', 'r' ),
			1 => array( 'pipe', 'w' ),
			2 => array( 'pipe', 'w' ),
		);
		$proc = proc_open( $cmd, $spec, $pipes ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.system_calls_proc_open
		if ( ! is_resource( $proc ) ) {
			return new WP_Error( 'callboard_spawn', __( 'Could not start the fetch tool.', 'callboard' ) );
		}
		fclose( $pipes[0] ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		stream_set_blocking( $pipes[2], false );
		$out = '';
		$err = '';
		while ( ! feof( $pipes[1] ) ) {
			$out .= (string) fread( $pipes[1], 8192 ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
			$line = fgets( $pipes[2] );
			if ( false !== $line ) {
				$err .= $line;
				if ( $progress && preg_match( '/\[(download|ExtractAudio)\] (Destination|Downloading item|\d+\.\d+% of)/', $line ) ) {
					$progress( trim( $line ) );
				}
			}
		}
		$err .= (string) stream_get_contents( $pipes[2] );
		fclose( $pipes[1] ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $pipes[2] ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		$code = proc_close( $proc );
		if ( 0 !== $code ) {
			return new WP_Error( 'callboard_tool_failed', trim( $err ) ? trim( $err ) : sprintf( 'exit %d', $code ) );
		}
		return $out;
	}

	/**
	 * Resolve a binary on PATH (or accept an absolute path).
	 *
	 * @param string $bin Name or path.
	 */
	private static function which( string $bin ): ?string {
		if ( str_contains( $bin, '/' ) ) {
			return is_executable( $bin ) ? $bin : null;
		}
		foreach ( explode( PATH_SEPARATOR, (string) getenv( 'PATH' ) ) as $p ) {
			if ( $p && is_executable( $p . '/' . $bin ) ) {
				return $p . '/' . $bin;
			}
		}
		foreach ( array( '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin' ) as $p ) {
			if ( is_executable( $p . '/' . $bin ) ) {
				return $p . '/' . $bin;
			}
		}
		return null;
	}
}
