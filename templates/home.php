<?php
/**
 * Home: every set.
 *
 * @package Callboard
 * @var array<string, mixed> $args
 */

defined( 'ABSPATH' ) || exit;

$callboard_sets = Callboard\Sets::all();
?>
<main class="app" id="main">
	<header class="masthead">
		<p class="label"><?php echo esc_html( Callboard\Settings::get( 'tagline' ) ); ?></p>
		<h1><?php bloginfo( 'name' ); ?></h1>
		<?php if ( Callboard\Settings::get( 'push' ) && Callboard\Push::available() ) : ?>
		<div class="actions"><button type="button" class="btn btn-quiet" id="notify" hidden><?php esc_html_e( 'Notify me about new sets', 'callboard' ); ?></button><p class="note small" id="notify-note" hidden></p></div>
		<?php endif; ?>
	</header>

	<?php if ( ! empty( $args['not_found'] ) ) : ?>
		<p class="note note-404"><?php esc_html_e( "That page isn't here. Everything we have is below.", 'callboard' ); ?></p>
	<?php endif; ?>

	<?php if ( ! $callboard_sets ) : ?>
		<p class="note"><?php esc_html_e( 'Nothing here yet.', 'callboard' ); ?></p>
	<?php else : ?>
	<ul class="sets">
		<?php foreach ( $callboard_sets as $callboard_s ) : ?>
		<li>
			<a class="set" href="<?php echo esc_url( home_url( '/' . $callboard_s['slug'] . '/' ) ); ?>">
				<span class="set-mark" aria-hidden="true"><?php echo esc_html( mb_strtoupper( mb_substr( $callboard_s['name'], 0, 1 ) ) ); ?></span>
				<span class="set-text">
					<span class="set-name" style="view-transition-name:set-<?php echo esc_attr( $callboard_s['slug'] ); ?>"><?php echo esc_html( $callboard_s['name'] ); ?></span>
					<span class="set-meta"><?php echo esc_html( $callboard_s['meta'] ); ?></span>
				</span>
				<span class="set-go" aria-hidden="true"></span>
			</a>
		</li>
		<?php endforeach; ?>
	</ul>
	<?php endif; ?>

	<?php callboard_template( 'footer', array( 'set' => null ) ); ?>
</main>
