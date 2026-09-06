<?php
/**
 * One set: header, track list, credits.
 *
 * @package Callboard
 * @var array<string, mixed> $args
 */

defined( 'ABSPATH' ) || exit;

$callboard_set   = $args['set'];
$callboard_badge = Callboard\Settings::get( 'badge' );
?>
<main class="app" id="main">
	<header class="masthead">
		<a class="back" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'All sets', 'callboard' ); ?></a>
		<h1 style="view-transition-name:set-<?php echo esc_attr( $callboard_set['slug'] ); ?>"><?php echo esc_html( $callboard_set['name'] ); ?></h1>
		<p class="label"><?php echo esc_html( $callboard_set['meta'] ); ?></p>
		<div class="actions">
			<button type="button" class="btn" id="play-all"><?php esc_html_e( 'Play all', 'callboard' ); ?></button>
			<?php if ( Callboard\Settings::get( 'offline' ) ) : ?>
			<button type="button" class="btn btn-quiet" id="offline" hidden><?php esc_html_e( 'Save offline', 'callboard' ); ?></button>
			<?php endif; ?>
		</div>
	</header>

	<?php if ( ! $callboard_set['tracks'] ) : ?>
		<p class="note"><?php esc_html_e( 'No audio in this set yet.', 'callboard' ); ?></p>
	<?php else : ?>
	<ol class="tracks" id="tracks" aria-label="<?php esc_attr_e( 'Tracks', 'callboard' ); ?>">
		<?php foreach ( $callboard_set['tracks'] as $callboard_i => $callboard_t ) : ?>
		<li>
			<button type="button" class="track" data-i="<?php echo (int) $callboard_i; ?>" aria-label="<?php echo esc_attr( sprintf( /* translators: %s: track title. */ __( 'Play %s', 'callboard' ), $callboard_t['title'] ) ); ?>">
				<span class="num"><span class="digits"><?php echo esc_html( str_pad( (string) $callboard_t['index'], 2, '0', STR_PAD_LEFT ) ); ?></span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span>
				<span class="title"><?php echo esc_html( $callboard_t['title'] ); ?>
				<?php
				if ( isset( $callboard_set['lyrics']->{$callboard_t['id']} ) || ( is_array( $callboard_set['lyrics'] ) && isset( $callboard_set['lyrics'][ $callboard_t['id'] ] ) ) ) :
					?>
					<span class="has-lyrics"><?php esc_html_e( 'lyrics', 'callboard' ); ?></span><?php endif; ?></span>
				<span class="len">
				<?php
				if ( $callboard_badge ) :
					?>
					<span class="hh" aria-hidden="true"><?php echo esc_html( $callboard_badge ); ?></span><?php endif; ?><?php echo esc_html( callboard_fmt( $callboard_t['duration'] ) ); ?></span>
			</button>
		</li>
		<?php endforeach; ?>
	</ol>
	<?php endif; ?>

	<?php callboard_template( 'footer', array( 'set' => $callboard_set ) ); ?>
</main>
