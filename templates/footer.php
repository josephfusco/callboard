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
		<p class="version">Callboard <?php echo esc_html( CALLBOARD_VERSION ); ?></p>
	<?php else : ?>
		<?php
		$callboard_c     = $callboard_set['credits'];
		$callboard_names = is_array( $callboard_c['uploaders'] ) ? $callboard_c['uploaders'] : array();
		$callboard_bits  = array();
		foreach ( $callboard_names as $callboard_n => $callboard_u ) {
			$callboard_bits[] = callboard_link( (string) $callboard_n, $callboard_u );
		}
		$callboard_credit = $callboard_bits
			? esc_html__( 'Audio by', 'callboard' ) . ' ' . implode( ', ', $callboard_bits )
			: '';
		if ( ! empty( $callboard_c['playlist_url'] ) ) {
			$callboard_playlist = callboard_link( __( 'Playlist', 'callboard' ), $callboard_c['playlist_url'] );
			if ( ! empty( $callboard_c['curator'] ) ) {
				$callboard_playlist .= ' ' . esc_html__( 'by', 'callboard' ) . ' ' . callboard_link( $callboard_c['curator'], $callboard_c['curator_url'] ?? null );
			}
			$callboard_credit = $callboard_credit ? $callboard_credit . ' · ' . $callboard_playlist : $callboard_playlist;
		}
		if ( $callboard_credit ) :
			?>
			<p><?php echo wp_kses_post( $callboard_credit ); ?></p>
		<?php endif; ?>
	<?php endif; ?>
</footer>
