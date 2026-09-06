<?php
/**
 * Footer: a disclosure on home, credits on a set.
 *
 * @package Callboard
 * @var array<string, mixed> $args
 */

defined( 'ABSPATH' ) || exit;

$callboard_set = $args['set'] ?? null;
?>
<footer class="colophon">
	<?php if ( ! $callboard_set ) : ?>
		<?php
		if ( Callboard\Settings::get( 'footer_note' ) ) :
			?>
			<p><?php echo esc_html( Callboard\Settings::get( 'footer_note' ) ); ?></p><?php endif; ?>
	<?php else : ?>
		<?php
		$callboard_c     = $callboard_set['credits'];
		$callboard_names = is_array( $callboard_c['uploaders'] ) ? $callboard_c['uploaders'] : array();
		if ( $callboard_names ) :
			$callboard_links = array();
			foreach ( $callboard_names as $callboard_n => $callboard_u ) {
				$callboard_links[] = callboard_link( (string) $callboard_n, $callboard_u );
			}
			?>
			<p><?php esc_html_e( 'Audio by', 'callboard' ); ?> <?php echo wp_kses_post( implode( ', ', $callboard_links ) ); ?>
			<?php
			if ( ! empty( $callboard_c['playlist_url'] ) ) :
				?>
				· <?php echo wp_kses_post( callboard_link( __( 'Playlist', 'callboard' ), $callboard_c['playlist_url'] ) ); ?>
				<?php
				if ( ! empty( $callboard_c['curator'] ) ) :
					?>
								<?php esc_html_e( 'by', 'callboard' ); ?> <?php echo wp_kses_post( callboard_link( $callboard_c['curator'], $callboard_c['curator_url'] ?? null ) ); ?><?php endif; ?><?php endif; ?></p>
		<?php endif; ?>
	<?php endif; ?>
</footer>
