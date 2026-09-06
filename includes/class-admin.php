<?php
/**
 * Admin: track order, credits, lyrics approval, settings, import.
 *
 * @package Callboard
 */

namespace Callboard;

use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * Admin screens.
 */
final class Admin {

	/**
	 * Hook registration.
	 */
	public static function register_hooks(): void {
		add_action( 'add_meta_boxes_' . Post_Types::SET, array( self::class, 'meta_boxes' ) );
		add_action( 'save_post_' . Post_Types::SET, array( self::class, 'save' ) );
		add_action( 'admin_menu', array( self::class, 'menu' ) );
		add_action( 'admin_init', array( self::class, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( self::class, 'assets' ) );
		add_action( 'admin_notices', array( self::class, 'import_notice' ) );
		add_filter( 'manage_' . Post_Types::SET . '_posts_columns', array( self::class, 'columns' ) );
		add_action( 'manage_' . Post_Types::SET . '_posts_custom_column', array( self::class, 'column' ), 10, 2 );
	}

	/**
	 * Meta boxes on the Set screen.
	 */
	public static function meta_boxes(): void {
		add_meta_box( 'callboard-tracks', __( 'Tracks', 'callboard' ), array( self::class, 'box_tracks' ), Post_Types::SET, 'normal', 'high' );
		add_meta_box( 'callboard-credits', __( 'Source & credits', 'callboard' ), array( self::class, 'box_credits' ), Post_Types::SET, 'normal' );
		add_meta_box( 'callboard-lyrics', __( 'Lyrics', 'callboard' ), array( self::class, 'box_lyrics' ), Post_Types::SET, 'side' );
	}

	/**
	 * Sortable track list with editable titles.
	 *
	 * @param WP_Post $post Set post.
	 */
	public static function box_tracks( WP_Post $post ): void {
		wp_nonce_field( 'callboard_save', 'callboard_nonce' );
		$tracks = Sets::track_posts( $post->ID );
		if ( ! $tracks ) {
			echo '<p>' . esc_html__( 'No audio yet. Upload audio files to the Media Library and attach them to this set, or import a folder.', 'callboard' ) . '</p>';
			return;
		}
		echo '<p class="description">' . esc_html__( 'Drag to reorder. Titles are what the cast sees.', 'callboard' ) . '</p>';
		echo '<ol class="callboard-tracks" id="callboard-tracks">';
		foreach ( $tracks as $track ) {
			$meta = (array) wp_get_attachment_metadata( $track->ID );
			printf(
				'<li data-id="%1$d"><span class="dashicons dashicons-menu"></span><input type="hidden" name="callboard_order[]" value="%1$d"><input type="text" class="regular-text" name="callboard_title[%1$d]" value="%2$s"><span class="callboard-len">%3$s</span><a href="%4$s">%5$s</a></li>',
				(int) $track->ID,
				esc_attr( $track->post_title ),
				esc_html( $meta['length_formatted'] ?? '' ),
				esc_url( get_edit_post_link( $track->ID ) ),
				esc_html__( 'Media', 'callboard' )
			);
		}
		echo '</ol>';
	}

	/**
	 * Credits fields.
	 *
	 * @param WP_Post $post Set post.
	 */
	public static function box_credits( WP_Post $post ): void {
		$c      = (array) get_post_meta( $post->ID, '_callboard_credits', true );
		$fields = array(
			'playlist_url' => __( 'Source playlist URL', 'callboard' ),
			'curator'      => __( 'Playlist by', 'callboard' ),
			'curator_url'  => __( 'Playlist author URL', 'callboard' ),
		);
		echo '<table class="form-table" role="presentation">';
		foreach ( $fields as $key => $label ) {
			printf(
				'<tr><th scope="row"><label for="callboard-%1$s">%2$s</label></th><td><input type="text" class="regular-text" id="callboard-%1$s" name="callboard_credits[%1$s]" value="%3$s"></td></tr>',
				esc_attr( $key ),
				esc_html( $label ),
				esc_attr( (string) ( $c[ $key ] ?? '' ) )
			);
		}
		echo '</table>';
		echo '<p class="description">' . esc_html__( 'Per-track uploader credits come from each audio file\'s metadata and are shown automatically.', 'callboard' ) . '</p>';
	}

	/**
	 * Lyrics approval.
	 *
	 * @param WP_Post $post Set post.
	 */
	public static function box_lyrics( WP_Post $post ): void {
		$on = (bool) get_post_meta( $post->ID, '_callboard_lyrics_approved', true );
		printf(
			'<label><input type="checkbox" name="callboard_lyrics_approved" value="1" %s> %s</label><p class="description">%s</p>',
			checked( $on, true, false ),
			esc_html__( 'Show lyrics for this set', 'callboard' ),
			esc_html__( 'Only turn this on after checking the imported captions for accuracy.', 'callboard' )
		);
	}

	/**
	 * Save meta boxes.
	 *
	 * @param int $post_id Set ID.
	 */
	public static function save( int $post_id ): void {
		if ( ! isset( $_POST['callboard_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['callboard_nonce'] ), 'callboard_save' ) || ! current_user_can( 'edit_post', $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		$order  = array_map( 'intval', (array) ( $_POST['callboard_order'] ?? array() ) );
		$titles = isset( $_POST['callboard_title'] ) ? array_map( 'sanitize_text_field', wp_unslash( (array) $_POST['callboard_title'] ) ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- sanitized per element.
		foreach ( $order as $i => $track_id ) {
			if ( get_post_field( 'post_parent', $track_id ) !== (string) $post_id ) {
				continue;
			}
			$update = array(
				'ID'         => $track_id,
				'menu_order' => $i + 1,
			);
			if ( ! empty( $titles[ $track_id ] ) ) {
				$update['post_title'] = $titles[ $track_id ];
			}
			wp_update_post( $update );
		}
		$credits = isset( $_POST['callboard_credits'] ) ? array_map( 'sanitize_text_field', wp_unslash( (array) $_POST['callboard_credits'] ) ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- sanitized per element.
		update_post_meta(
			$post_id,
			'_callboard_credits',
			array(
				'playlist_url' => esc_url_raw( $credits['playlist_url'] ?? '' ),
				'curator'      => $credits['curator'] ?? '',
				'curator_url'  => esc_url_raw( $credits['curator_url'] ?? '' ),
			)
		);
		update_post_meta( $post_id, '_callboard_lyrics_approved', empty( $_POST['callboard_lyrics_approved'] ) ? 0 : 1 );
		Sets::flush();
	}

	/**
	 * Settings and Import submenus.
	 */
	public static function menu(): void {
		$parent = 'edit.php?post_type=' . Post_Types::SET;
		add_submenu_page( $parent, __( 'Import', 'callboard' ), __( 'Import', 'callboard' ), 'manage_options', 'callboard-import', array( self::class, 'page_import' ) );
		add_submenu_page( $parent, __( 'Callboard Settings', 'callboard' ), __( 'Settings', 'callboard' ), 'manage_options', 'callboard-settings', array( self::class, 'page_settings' ) );
	}

	/**
	 * Settings API registration.
	 */
	public static function register_settings(): void {
		register_setting(
			'callboard',
			Settings::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( Settings::class, 'sanitize' ),
				'default'           => Settings::defaults(),
			)
		);
		add_settings_section( 'callboard_main', '', '__return_false', 'callboard' );
		$fields = array(
			'tagline'     => array( __( 'Tagline', 'callboard' ), 'text', __( 'Shown under the title and in link previews.', 'callboard' ) ),
			'footer_note' => array( __( 'Home page footer', 'callboard' ), 'text', __( 'A short disclosure, e.g. "For rehearsal use only."', 'callboard' ) ),
			'badge'       => array( __( 'Badge on the playing track', 'callboard' ), 'text', __( 'An emoji, or leave empty.', 'callboard' ) ),
			'confetti'    => array( __( 'Confetti text', 'callboard' ), 'text', __( 'Triple-tap the big title to release it. A lucky number, a name. Empty turns it off.', 'callboard' ) ),
			'hearts'      => array( __( 'Mix hearts into the confetti', 'callboard' ), 'checkbox', '' ),
			'show_hint'   => array( __( 'Show the "Add to Home Screen" hint on iPhone', 'callboard' ), 'checkbox', '' ),
			'offline'     => array( __( 'Offer "Save offline"', 'callboard' ), 'checkbox', '' ),
		);
		foreach ( $fields as $key => list( $label, $type, $help ) ) {
			add_settings_field(
				$key,
				$label,
				array( self::class, 'field' ),
				'callboard',
				'callboard_main',
				array(
					'key'       => $key,
					'type'      => $type,
					'help'      => $help,
					'label_for' => 'callboard-' . $key,
				)
			);
		}
	}

	/**
	 * Render a settings field.
	 *
	 * @param array<string, string> $args Field args.
	 */
	public static function field( array $args ): void {
		$value = Settings::get( $args['key'] );
		$name  = Settings::OPTION . '[' . $args['key'] . ']';
		if ( 'checkbox' === $args['type'] ) {
			printf( '<input type="checkbox" id="callboard-%1$s" name="%2$s" value="1" %3$s>', esc_attr( $args['key'] ), esc_attr( $name ), checked( (bool) $value, true, false ) );
		} else {
			printf( '<input type="text" class="regular-text" id="callboard-%1$s" name="%2$s" value="%3$s">', esc_attr( $args['key'] ), esc_attr( $name ), esc_attr( (string) $value ) );
		}
		if ( $args['help'] ) {
			echo '<p class="description">' . esc_html( $args['help'] ) . '</p>';
		}
	}

	/**
	 * Settings page.
	 */
	public static function page_settings(): void {
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Callboard', 'callboard' ); ?></h1>
			<p><?php esc_html_e( 'The site title (Settings → General) is the app name and the home page heading.', 'callboard' ); ?></p>
			<form method="post" action="options.php">
				<?php settings_fields( 'callboard' ); ?>
				<?php do_settings_sections( 'callboard' ); ?>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}

	/**
	 * Import page: folder import now, plus how to fetch from YouTube.
	 */
	public static function page_import(): void {
		$dir = Importer::source_dir();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Import sets', 'callboard' ); ?></h1>
			<h2><?php esc_html_e( 'From a folder on this server', 'callboard' ); ?></h2>
			<p>
				<?php
				printf(
					/* translators: %s: directory path. */
					esc_html__( 'Drop a set folder (audio files plus manifest.json) into %s and import. Folders are re-imported automatically after each deploy stamp change.', 'callboard' ),
					'<code>' . esc_html( $dir ) . '</code>'
				);
				?>
			</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="callboard_import">
				<?php wp_nonce_field( 'callboard_import' ); ?>
				<?php submit_button( __( 'Import now', 'callboard' ), 'primary', 'submit', false ); ?>
			</form>
			<hr>
			<h2><?php esc_html_e( 'From YouTube', 'callboard' ); ?></h2>
			<p><?php esc_html_e( 'Paste a video or playlist URL. The next `wp callboard run` fetches audio only, draws the artwork, and the set appears here.', 'callboard' ); ?></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="callboard-request">
				<input type="hidden" name="action" value="callboard_request">
				<?php wp_nonce_field( 'callboard_request' ); ?>
				<p><label for="callboard-url"><?php esc_html_e( 'YouTube URL', 'callboard' ); ?></label><br><input type="url" class="regular-text" id="callboard-url" name="callboard_url" required placeholder="https://www.youtube.com/playlist?list=…"></p>
				<p><label for="callboard-name"><?php esc_html_e( 'Set name', 'callboard' ); ?></label><br><input type="text" class="regular-text" id="callboard-name" name="callboard_name" required></p>
				<?php submit_button( __( 'Queue it', 'callboard' ), 'secondary', 'submit', false ); ?>
			</form>
			<?php self::requests_table(); ?>
			<details <?php echo Fetcher::available() ? '' : 'open'; ?>>
				<summary><?php esc_html_e( 'How fetching works', 'callboard' ); ?></summary>
				<?php if ( Fetcher::available() ) : ?>
					<p><?php esc_html_e( 'This server has yt-dlp. Drain the queue with WP-CLI:', 'callboard' ); ?></p>
					<pre><code>wp callboard run</code></pre>
				<?php else : ?>
					<p><?php esc_html_e( 'This host cannot run yt-dlp, which is normal for managed hosting. Fetch on a machine that has it, with the same plugin installed (wp-env works well), then deploy the finished set folder here and import.', 'callboard' ); ?></p>
					<pre><code>wp callboard fetch '&lt;youtube url&gt;' --name="Spring Show"
wp callboard run   <?php esc_html_e( '# or drain everything queued above', 'callboard' ); ?></code></pre>
				<?php endif; ?>
				<p><?php esc_html_e( 'wp callboard doctor reports what the current environment can do.', 'callboard' ); ?></p>
			</details>
			<?php do_action( 'callboard_import_page' ); ?>
		</div>
		<?php
	}

	/**
	 * Queue table on the import page.
	 */
	private static function requests_table(): void {
		$requests = Requests::all();
		if ( ! $requests ) {
			return;
		}
		echo '<table class="widefat striped" style="max-width:900px;margin-top:12px"><thead><tr><th>' . esc_html__( 'Set', 'callboard' ) . '</th><th>' . esc_html__( 'Source', 'callboard' ) . '</th><th>' . esc_html__( 'Status', 'callboard' ) . '</th><th></th></tr></thead><tbody>';
		foreach ( $requests as $post ) {
			$r      = Requests::to_array( $post );
			$delete = wp_nonce_url( admin_url( 'admin-post.php?action=callboard_request_delete&id=' . $r['id'] ), 'callboard_request_delete_' . $r['id'] );
			printf(
				'<tr><td><strong>%1$s</strong><br><code>%2$s</code></td><td><a href="%3$s" target="_blank" rel="noopener noreferrer">%4$s</a></td><td><span class="callboard-status callboard-status-%5$s">%5$s</span>%6$s</td><td><a href="%7$s" class="submitdelete">%8$s</a></td></tr>',
				esc_html( $r['name'] ),
				esc_html( $r['slug'] ),
				esc_url( $r['url'] ),
				esc_html( wp_parse_url( $r['url'], PHP_URL_HOST ) . wp_parse_url( $r['url'], PHP_URL_PATH ) ),
				esc_html( $r['status'] ),
				$r['log'] ? '<br><small>' . esc_html( mb_substr( $r['log'], -160 ) ) . '</small>' : '',
				esc_url( $delete ),
				esc_html__( 'Remove', 'callboard' )
			);
		}
		echo '</tbody></table>';
	}

	/**
	 * Show import results.
	 */
	public static function import_notice(): void {
		$results = get_transient( 'callboard_import_notice' );
		if ( ! $results ) {
			return;
		}
		delete_transient( 'callboard_import_notice' );
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( implode( ' ', (array) $results ) ) . '</p></div>';
	}

	/**
	 * Sortable + a little CSS on the Set screen.
	 *
	 * @param string $hook Current screen hook.
	 */
	public static function assets( string $hook ): void {
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) || get_current_screen()?->post_type !== Post_Types::SET ) {
			return;
		}
		wp_enqueue_script( 'jquery-ui-sortable' );
		wp_add_inline_script( 'jquery-ui-sortable', 'jQuery(function($){$("#callboard-tracks").sortable({handle:".dashicons-menu"});});' );
		wp_add_inline_style( 'wp-admin', '.callboard-tracks{margin:0}.callboard-tracks li{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #dcdcde}.callboard-tracks .dashicons-menu{cursor:grab;color:#787c82}.callboard-tracks input[type=text]{flex:1}.callboard-len{color:#646970;font-variant-numeric:tabular-nums;min-width:3em}' );
	}

	/**
	 * List table columns.
	 *
	 * @param array<string, string> $columns Columns.
	 * @return array<string, string>
	 */
	public static function columns( array $columns ): array {
		return array(
			'cb'     => $columns['cb'],
			'title'  => $columns['title'],
			'tracks' => __( 'Tracks', 'callboard' ),
			'link'   => __( 'Link', 'callboard' ),
			'date'   => $columns['date'],
		);
	}

	/**
	 * List table column content.
	 *
	 * @param string $column  Column key.
	 * @param int    $post_id Set ID.
	 */
	public static function column( string $column, int $post_id ): void {
		if ( 'tracks' === $column ) {
			echo esc_html( (string) count( Sets::track_posts( $post_id ) ) );
		} elseif ( 'link' === $column ) {
			$url = home_url( '/' . get_post_field( 'post_name', $post_id ) . '/' );
			printf( '<a href="%1$s" target="_blank" rel="noopener">%2$s</a>', esc_url( $url ), esc_html( wp_make_link_relative( $url ) ) );
		}
	}
}
