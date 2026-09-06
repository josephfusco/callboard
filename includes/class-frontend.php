<?php
/**
 * Front-end assets and <head>: only ours, whatever theme is active.
 *
 * @package Callboard
 */

namespace Callboard;

defined( 'ABSPATH' ) || exit;

/**
 * Assets and head output.
 */
final class Frontend {

	/**
	 * Hook registration.
	 */
	public static function register_hooks(): void {
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue' ), 20 );
		add_action( 'wp_enqueue_scripts', array( self::class, 'dequeue_everything_else' ), PHP_INT_MAX );
		add_action( 'wp_head', array( self::class, 'link_previews' ), 2 );
		add_action( 'wp_head', array( self::class, 'inline_css' ), 3 );
		add_action( 'wp_head', array( self::class, 'app_meta' ), 4 );
		// Block themes register a second viewport tag while locating templates (after init), so remove it just before wp_head runs.
		add_action( 'wp_head', static fn() => remove_action( 'wp_head', '_block_template_viewport_meta_tag', 0 ), -1 );
		add_action( 'init', array( self::class, 'trim_core_output' ) );
		add_filter( 'should_load_separate_core_block_assets', '__return_false' );
		add_filter( 'wp_img_tag_add_auto_sizes', '__return_false' );
		add_filter( 'wp_speculation_rules_configuration', '__return_null' );
		add_filter( 'show_admin_bar', '__return_false' ); // the app is the whole front end; admins use wp-admin.
	}

	/**
	 * Our script and its data.
	 */
	public static function enqueue(): void {
		wp_enqueue_script( 'callboard', callboard_asset( 'assets/app.js' ), array(), null, array( 'strategy' => 'defer' ) ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
		$data             = Sets::app_data( Router::view() );
		$data['settings'] = Settings::for_client();
		$data['icon']     = callboard_asset( 'assets/icon-512.png' );
		$data['version']  = CALLBOARD_VERSION;
		$data['push']     = Settings::get( 'push' ) && Push::available() ? array(
			'key' => Push::keys()['publicKey'] ?? '',
			'api' => esc_url_raw( rest_url( 'callboard/v1/push/' ) ),
		) : null;
		$data['text']     = array(
			'tagline'        => Settings::get( 'tagline' ),
			'footer_note'    => Settings::get( 'footer_note' ),
			'all_sets'       => __( 'All sets', 'callboard' ),
			'play_all'       => __( 'Play all', 'callboard' ),
			'pause'          => __( 'Pause', 'callboard' ),
			'resume'         => __( 'Play', 'callboard' ),
			'install'        => __( 'Add this to your Home Screen to keep it on your phone.', 'callboard' ),
			'install_go'     => __( 'Add', 'callboard' ),
			'open_safari'    => __( 'Open this in Safari to add it to your Home Screen.', 'callboard' ),
			'open_safari_go' => __( 'Open in Safari', 'callboard' ),
			'save'           => __( 'Save offline', 'callboard' ),
			'saved'          => __( 'Saved offline', 'callboard' ),
			/* translators: 1: tracks saved so far, 2: total tracks. */
			'saving_set'     => __( 'Saving offline, %1$s of %2$s', 'callboard' ),
			/* translators: 1: tracks saved so far, 2: total tracks. */
			'save_rest'      => __( 'Save the rest, %1$s of %2$s saved', 'callboard' ),
			'updated'        => __( 'Updated', 'callboard' ),
			'reload'         => __( 'Reload', 'callboard' ),
			'saved_hover'    => __( ' · hold to remove', 'callboard' ),
			'saved_hint'     => __( 'Saved offline. Press and hold, or press Delete, to remove the copies.', 'callboard' ),
			/* translators: 1: tracks saved so far, 2: total tracks. */
			'saving'         => __( 'Saving %1$s/%2$s · Cancel', 'callboard' ),
			'not_here'       => __( "That page isn't here. Everything we have is below.", 'callboard' ),
			'nothing'        => __( 'Nothing here yet.', 'callboard' ),
			'no_audio'       => __( 'No audio in this set yet.', 'callboard' ),
			'audio_by'       => __( 'Audio by', 'callboard' ),
			'playlist'       => __( 'Playlist', 'callboard' ),
			'by'             => __( 'by', 'callboard' ),
			'lyrics'         => __( 'lyrics', 'callboard' ),
			/* translators: %s: track title. */
			'play'           => __( 'Play %s', 'callboard' ),
			'tracks'         => __( 'Tracks', 'callboard' ),
			'lyrics_label'   => __( 'Lyrics', 'callboard' ),
			'lyrics_sheet'   => __( 'Lyrics · auto-captions, may be rough', 'callboard' ),
			'notes'          => __( 'Notes', 'callboard' ),
			'notes_sheet'    => __( 'Director notes', 'callboard' ),
			'show_notes'     => __( 'Show director notes', 'callboard' ),
			'hide_notes'     => __( 'Hide director notes', 'callboard' ),
			'loop'           => __( 'Loop', 'callboard' ),
			'loop_clear'     => __( 'Clear loop', 'callboard' ),
			'loop_set'       => __( 'Set a loop: tap at the start, then at the end', 'callboard' ),
			'loop_from'      => __( 'Loop from', 'callboard' ),
			'loop_end'       => __( 'Tap at the end of the loop', 'callboard' ),
			/* translators: %d: beats per minute. */
			'tempo'          => __( '%d beats per minute, counts in', 'callboard' ),
			'show_lyrics'    => __( 'Show lyrics', 'callboard' ),
			'hide_lyrics'    => __( 'Hide lyrics', 'callboard' ),
			'show_track'     => __( 'Show current track', 'callboard' ),
			/* translators: %s: track title. */
			'save_track'     => __( 'Save %s offline', 'callboard' ),
			/* translators: %s: track title. */
			'saved_track'    => __( '%s is saved offline', 'callboard' ),
			'remove_confirm' => __( 'Remove offline copies? Tap again', 'callboard' ),
			/* translators: %s: track title. */
			'saving_track'   => __( 'Saving %s, tap to cancel', 'callboard' ),
			'notify'         => __( 'Notify me about new sets', 'callboard' ),
			'notify_on'      => __( 'Notifications on', 'callboard' ),
			'notify_home'    => __( 'Add to Home Screen first, then turn on notifications from there.', 'callboard' ),
			'notify_denied'  => __( 'Notifications are blocked in your browser settings.', 'callboard' ),
		);
		/**
		 * Everything the front end knows: site, sets, settings, text. Add a field here and it is on window.CALLBOARD.
		 *
		 * @param array<string, mixed> $data App data.
		 */
		wp_localize_script( 'callboard', 'CALLBOARD', apply_filters( 'callboard_app_data', $data ) );
	}

	/**
	 * Drop any style or script the active theme or other plugins added.
	 */
	public static function dequeue_everything_else(): void {
		foreach ( wp_styles()->queue as $handle ) {
			wp_dequeue_style( $handle );
		}
		foreach ( wp_scripts()->queue as $handle ) {
			if ( 'callboard' !== $handle ) {
				wp_dequeue_script( $handle );
			}
		}
	}

	/**
	 * Inline the stylesheet: one fewer render-blocking request.
	 */
	public static function inline_css(): void {
		$css = file_get_contents( CALLBOARD_DIR . 'assets/app.css' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		echo '<style id="callboard-css">' . $css . '</style>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static plugin file.
	}

	/**
	 * Theme color, manifest, icons, iOS web-app meta.
	 */
	public static function app_meta(): void {
		?>
		<meta name="theme-color" content="#eceae5" media="(prefers-color-scheme: light)">
		<meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)">
		<meta name="color-scheme" content="light dark">
		<link rel="manifest" href="<?php echo esc_url( home_url( '/manifest.json' ) ); ?>">
		<link rel="icon" type="image/png" sizes="192x192" href="<?php echo esc_url( callboard_asset( 'assets/icon-192.png' ) ); ?>">
		<link rel="apple-touch-icon" sizes="180x180" href="<?php echo esc_url( callboard_asset( 'assets/icon-180.png' ) ); ?>">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
		<meta name="apple-mobile-web-app-title" content="<?php echo esc_attr( callboard_site_name() ); ?>">
		<?php
		$loc = Pwa::splash_location();
		if ( is_dir( $loc['dir'] ) ) {
			foreach ( Pwa::splash_sizes() as $dims ) {
				list( $w, $h, $dpr ) = $dims;
				foreach ( array( 'light', 'dark' ) as $scheme ) {
					$file = sprintf( '%s/%s-%dx%d.png', $loc['dir'], $scheme, $w, $h );
					if ( file_exists( $file ) ) {
						printf(
							'<link rel="apple-touch-startup-image" media="(device-width: %1$dpx) and (device-height: %2$dpx) and (-webkit-device-pixel-ratio: %3$d) and (orientation: portrait)%4$s" href="%5$s">' . "\n",
							(int) ( $w / $dpr ),
							(int) ( $h / $dpr ),
							(int) $dpr,
							'dark' === $scheme ? ' and (prefers-color-scheme: dark)' : '',
							esc_url( sprintf( '%s/%s-%dx%d.png', $loc['url'], $scheme, $w, $h ) )
						);
					}
				}
			}
		}
	}

	/**
	 * Open Graph and Twitter tags, per view.
	 */
	public static function link_previews(): void {
		$view  = Router::view();
		$set   = $view ? Sets::by_slug( $view ) : null;
		$title = Router::page_title();
		$url   = $set ? home_url( '/' . $set['slug'] . '/' ) : home_url( '/' );
		if ( $set ) {
			$desc = $set['meta'] . '. ' . Settings::get( 'tagline' ) . '.';
			$img  = $set['share'];
		} else {
			$count = count( Sets::all() );
			/* translators: %d: number of sets. */
			$desc = Settings::get( 'tagline' ) . '. ' . sprintf( _n( '%d set.', '%d sets.', $count, 'callboard' ), $count );
			$img  = file_exists( CALLBOARD_DIR . 'assets/share.png' ) ? callboard_asset( 'assets/share.png' ) : callboard_asset( 'assets/icon-512.png' );
		}
		$tags = array(
			'og:type'             => 'website',
			'og:site_name'        => callboard_site_name(),
			'og:title'            => $title,
			'og:description'      => $desc,
			'og:url'              => $url,
			'og:image'            => $img,
			'og:image:secure_url' => $img,
			'og:image:type'       => 'image/png',
			'og:image:alt'        => $title,
			'twitter:card'        => 'summary_large_image',
			'twitter:title'       => $title,
			'twitter:description' => $desc,
			'twitter:image'       => $img,
		);
		foreach ( $tags as $key => $value ) {
			printf( '<meta %s="%s" content="%s">' . "\n", str_starts_with( $key, 'og:' ) ? 'property' : 'name', esc_attr( $key ), esc_attr( $value ) );
		}
		printf( '<meta name="description" content="%s">' . "\n", esc_attr( $desc ) );
		printf( '<link rel="image_src" href="%s">' . "\n", esc_url( $img ) );
	}

	/**
	 * Remove core head/footer output we never want.
	 */
	public static function trim_core_output(): void {
		foreach ( array( 'wp_generator', 'wp_shortlink_wp_head', 'rsd_link', 'wlwmanifest_link', 'wp_oembed_add_discovery_links', 'wp_resource_hints', 'wp_print_auto_sizes_contain_css_fix' ) as $hook ) {
			remove_action( 'wp_head', $hook );
		}
		if ( 'production' === wp_get_environment_type() ) { // REST discovery stays available to local tooling and tests.
			remove_action( 'wp_head', 'rest_output_link_wp_head' );
			remove_action( 'template_redirect', 'rest_output_link_header', 11 );
		}
		remove_action( 'wp_head', 'feed_links', 2 );
		remove_action( 'wp_head', 'feed_links_extra', 3 );
		remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
		remove_action( 'wp_print_styles', 'print_emoji_styles' );
		remove_action( 'wp_enqueue_scripts', 'wp_enqueue_global_styles' );
		remove_action( 'wp_footer', 'wp_enqueue_global_styles', 1 );
		remove_action( 'wp_enqueue_scripts', 'wp_enqueue_classic_theme_styles' );
		remove_action( 'wp_enqueue_scripts', 'wp_common_block_scripts_and_styles' );
		remove_action( 'wp_body_open', 'wp_global_styles_render_svg_filters' );
		remove_action( 'wp_footer', 'the_block_template_skip_link' );
	}
}
