<?php
/**
 * The board: the next call pinned at the top, then what else is posted.
 *
 * @package Callboard
 */

defined( 'ABSPATH' ) || exit;

$callboard_calls = Callboard\Calls::board();
if ( ! $callboard_calls ) {
	return;
}
?>
<section class="board" aria-label="<?php esc_attr_e( 'Callboard', 'callboard' ); ?>">
	<?php foreach ( $callboard_calls as $callboard_c ) : ?>
	<article class="call<?php echo $callboard_c['is_next'] ? ' is-next' : ''; ?>">
		<?php if ( $callboard_c['when'] || $callboard_c['where'] ) : ?>
		<p class="call-when">
			<?php if ( $callboard_c['when'] ) : ?>
			<time datetime="<?php echo esc_attr( $callboard_c['when_iso'] ); ?>"><?php echo esc_html( $callboard_c['when_text'] ); ?></time>
			<span class="call-rel" data-when="<?php echo esc_attr( $callboard_c['when_iso'] ); ?>"><?php echo esc_html( $callboard_c['relative'] ); ?></span>
			<?php endif; ?>
			<?php if ( $callboard_c['where'] ) : ?>
			<span class="call-where"><?php echo esc_html( $callboard_c['where'] ); ?></span>
			<?php endif; ?>
		</p>
		<?php endif; ?>
		<h2 class="call-title"><?php echo esc_html( $callboard_c['title'] ); ?></h2>
		<?php if ( $callboard_c['body'] ) : ?>
		<div class="call-body"><?php echo $callboard_c['body']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- passed through wp_kses_post() in Calls::build(). ?></div>
		<?php endif; ?>
		<?php if ( $callboard_c['numbers'] ) : ?>
		<p class="call-numbers" aria-label="<?php esc_attr_e( 'Numbers being worked', 'callboard' ); ?>">
			<?php foreach ( $callboard_c['numbers'] as $callboard_n ) : ?>
			<a href="<?php echo esc_url( home_url( '/' . $callboard_n['slug'] . '/' ) ); ?>" data-track="<?php echo (int) $callboard_n['index']; ?>" aria-label="<?php echo esc_attr( sprintf( /* translators: 1: track title, 2: set name. */ __( 'Play %1$s from %2$s', 'callboard' ), $callboard_n['title'], $callboard_n['set'] ) ); ?>"><?php echo esc_html( $callboard_n['title'] ); ?></a>
			<?php endforeach; ?>
		</p>
		<?php endif; ?>
		<p class="call-meta"><?php echo esc_html( $callboard_c['posted'] ); ?></p>
	</article>
	<?php endforeach; ?>
</section>
