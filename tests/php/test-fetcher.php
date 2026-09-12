<?php
/**
 * What Fetcher asks yt-dlp for, and what it keeps.
 *
 * The real tools never run here. Two small shell scripts stand in for yt-dlp and ffmpeg, write down
 * the arguments they were given, and answer the way the real ones do. The arguments are the point:
 * they decide which copy of a recording ends up on a phone.
 *
 * @package Callboard
 */

use Callboard\Fetcher;

/**
 * @covers \Callboard\Fetcher
 */
class Test_Callboard_Fetcher extends WP_UnitTestCase {

	/**
	 * Scratch folder holding the stand-in tools, their log, and the import folder.
	 *
	 * @var string
	 */
	private string $dir;

	public function set_up(): void {
		parent::set_up();
		if ( ! function_exists( 'proc_open' ) ) {
			$this->markTestSkipped( 'Fetcher needs proc_open.' );
		}
		$this->dir = sys_get_temp_dir() . '/callboard-fetch-' . wp_generate_password( 8, false );
		wp_mkdir_p( $this->dir . '/bin' );
		wp_mkdir_p( $this->dir . '/import' );

		// A search for one song, the way yt-dlp's flat JSON returns it: a live recording first, a
		// stranger's upload second, and the label's own "Topic" upload last.
		$this->write(
			'search.json',
			(string) wp_json_encode(
				array(
					'extractor'   => 'youtube:search',
					'webpage_url' => 'ytsearch3:song',
					'entries'     => array(
						$this->entry( 'live1', 'Song (Live at the Palladium)', 'Band' ),
						$this->entry( 'upload1', 'Song', 'Someone Else' ),
						$this->entry( 'topic1', 'Song', 'Band - Topic' ),
					),
				)
			)
		);

		// yt-dlp: logs every call, answers -J with the search, and for the download leaves the track
		// behind as the m4a YouTube served, saying it had nothing to convert.
		$this->tool(
			'yt-dlp',
			<<<SH
			for a in "\$@"; do printf '%s\\n' "\$a" >> "{$this->dir}/calls.log"; done
			echo '--' >> "{$this->dir}/calls.log"
			case " \$* " in *" -J "*) cat "{$this->dir}/search.json"; exit 0;; esac
			out=""; prev=""
			for a in "\$@"; do if [ "\$prev" = "-o" ] && [ -z "\$out" ]; then out="\$a"; fi; prev="\$a"; done
			track="\$(dirname "\$out")/01 - Song [topic1].m4a"
			: > "\$track"
			echo "[ExtractAudio] Not converting audio \$track; file is already in target format m4a" >&2
			SH
		);

		// ffmpeg: a build with the native AAC encoder, and nothing to say about levels.
		$this->tool( 'ffmpeg', 'case " $* " in *" -encoders "*) echo " A..... aac  AAC (Advanced Audio Coding)";; esac' );

		add_filter( 'callboard_ytdlp_path', fn() => $this->dir . '/bin/yt-dlp' );
		add_filter( 'callboard_ffmpeg_path', fn() => $this->dir . '/bin/ffmpeg' );
		add_filter( 'callboard_import_dir', fn() => $this->dir . '/import' );
	}

	public function tear_down(): void {
		$files = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $this->dir, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::CHILD_FIRST );
		foreach ( $files as $file ) {
			$file->isDir() ? rmdir( $file->getPathname() ) : wp_delete_file( $file->getPathname() ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- a temp folder this test made.
		}
		rmdir( $this->dir ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- same.
		parent::tear_down();
	}

	/**
	 * #104. The download asked ffmpeg for mp3 at "quality 0", so every track was a lossy copy of a
	 * lossy copy, and often a bigger file than the one YouTube sent. It asks for the AAC stream first
	 * now, and when it must convert it names a fixed bitrate.
	 */
	public function test_the_download_keeps_the_aac_stream_instead_of_re_encoding_it(): void {
		$manifest = Fetcher::fetch( 'ytsearch3:song', 'song', 'Song', '__return_null' );
		$this->assertIsArray( $manifest );

		$download = $this->download_args();
		$this->assertStringStartsWith( 'bestaudio[acodec^=aac]', (string) $this->after( $download, '-f' ), 'An AAC stream is what gets asked for first.' );
		$this->assertSame( 'm4a', $this->after( $download, '--audio-format' ) );
		$this->assertNotSame( '0', $this->after( $download, '--audio-quality' ), 'Quality 0 lets the encoder inflate the file.' );

		$this->assertSame( 'aac', $manifest['tracks'][0]['codec'] );
		$this->assertFalse( $manifest['tracks'][0]['reencoded'] );
	}

	/**
	 * #104. A search returns rival copies of one recording, and every one of them became a track. It
	 * keeps one now, and prefers the label's own upload over a live take or a stranger's rip.
	 */
	public function test_a_search_keeps_one_copy_and_prefers_the_labels_own_upload(): void {
		$manifest = Fetcher::fetch( 'ytsearch3:song', 'song', 'Song', '__return_null' );
		$this->assertIsArray( $manifest );

		$this->assertCount( 1, $manifest['tracks'] );
		$this->assertSame( 'topic1', $manifest['tracks'][0]['id'] );
		$download = $this->download_args();
		$this->assertSame( 'https://www.youtube.com/watch?v=topic1', end( $download ) );
		$this->assertSame( 'https://www.youtube.com/watch?v=topic1', $manifest['playlist_url'], 'The query is not a link to anything.' );
	}

	/**
	 * One flat search result.
	 *
	 * @param string $id      Video id.
	 * @param string $title   Title.
	 * @param string $channel Channel name.
	 * @return array<string, string>
	 */
	private function entry( string $id, string $title, string $channel ): array {
		return array(
			'id'      => $id,
			'title'   => $title,
			'channel' => $channel,
			'url'     => 'https://www.youtube.com/watch?v=' . $id,
		);
	}

	/**
	 * The arguments of the call that downloaded audio, rather than the one that read the playlist.
	 *
	 * @return string[]
	 */
	private function download_args(): array {
		$calls = explode( "--\n", (string) file_get_contents( $this->dir . '/calls.log' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		foreach ( $calls as $call ) {
			$args = array_values( array_filter( explode( "\n", $call ), 'strlen' ) );
			if ( in_array( '-x', $args, true ) ) {
				return $args;
			}
		}
		$this->fail( 'yt-dlp was never asked to download.' );
	}

	/**
	 * The value that follows a flag, or null when the flag is absent.
	 *
	 * @param string[] $args Argv.
	 * @param string   $flag Flag.
	 */
	private function after( array $args, string $flag ): ?string {
		$at = array_search( $flag, $args, true );
		return false === $at ? null : ( $args[ $at + 1 ] ?? null );
	}

	/**
	 * A file in the scratch folder.
	 *
	 * @param string $name     File name.
	 * @param string $contents Contents.
	 */
	private function write( string $name, string $contents ): void {
		file_put_contents( $this->dir . '/' . $name, $contents ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
	}

	/**
	 * An executable stand-in for a command-line tool.
	 *
	 * @param string $name Tool name.
	 * @param string $body Shell script body.
	 */
	private function tool( string $name, string $body ): void {
		$this->write( "bin/{$name}", "#!/bin/sh\n{$body}\nexit 0\n" );
		chmod( $this->dir . "/bin/{$name}", 0755 ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_chmod -- the stand-in has to be executable.
	}
}
