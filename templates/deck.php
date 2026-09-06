<?php
/**
 * Persistent player and the Home Screen hint. Lives outside #main so it survives view swaps.
 *
 * @package Callboard
 */

defined( 'ABSPATH' ) || exit;
?>
<section class="deck" id="deck" aria-label="<?php esc_attr_e( 'Player', 'callboard' ); ?>" hidden>
	<div class="deck-inner">
		<div class="seek-wrap">
			<span class="seek-line" aria-hidden="true"><i class="seek-fill" id="seek-fill"></i></span><i class="seek-knob" id="seek-knob" aria-hidden="true"></i>
			<input type="range" id="seek" min="0" max="1000" value="0" step="1" aria-label="<?php esc_attr_e( 'Seek', 'callboard' ); ?>" aria-valuetext="0:00">
		</div>
		<div class="deck-row">
			<button type="button" class="deck-text" id="open-lyrics" aria-expanded="false" aria-controls="lyrics" aria-label="<?php esc_attr_e( 'Show current track', 'callboard' ); ?>">
				<span class="deck-title" id="now-title" aria-live="polite"><span class="mq"><span><?php esc_html_e( 'Choose a track', 'callboard' ); ?></span></span></span>
				<span class="deck-time" data-offline="<?php esc_attr_e( 'Offline', 'callboard' ); ?>"><span id="cur">0:00</span><span class="sep" aria-hidden="true"> / </span><span id="dur">0:00</span></span>
			</button>
			<div class="deck-controls">
				<button type="button" class="ctl skip" id="prev" aria-label="<?php esc_attr_e( 'Previous', 'callboard' ); ?>"><?php echo callboard_icon( 'prev' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static SVG shipped with the plugin. ?></button>
				<button type="button" class="ctl play" id="toggle" aria-label="<?php esc_attr_e( 'Play', 'callboard' ); ?>"><svg class="pp" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path id="pp-path" d="M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z" data-play="M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z" data-pause="M 11,10 15,10 15,26 11,26 z M 20,10 24,10 24,26 20,26 z"><animate id="pp-anim" attributeName="d" dur="0.22s" begin="indefinite" fill="freeze" calcMode="spline" keySplines=".3 .7 .2 1" keyTimes="0;1"/></path></svg></button>
				<button type="button" class="ctl skip" id="next" aria-label="<?php esc_attr_e( 'Next', 'callboard' ); ?>"><?php echo callboard_icon( 'next' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static SVG shipped with the plugin. ?></button>
			</div>
		</div>
		<audio id="audio" preload="metadata"></audio>
	</div>
</section>

<div class="a2hs" id="a2hs" hidden role="status">
	<?php echo callboard_icon( 'share' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static SVG shipped with the plugin. ?>
	<p><?php echo wp_kses( __( 'Keep this on your phone: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.', 'callboard' ), array( 'strong' => array() ) ); ?></p>
	<button type="button" class="a2hs-x" id="a2hs-close" aria-label="<?php esc_attr_e( 'Dismiss', 'callboard' ); ?>">&times;</button>
</div>

<section class="lyrics" id="lyrics" hidden aria-label="<?php esc_attr_e( 'Lyrics', 'callboard' ); ?>" role="dialog" aria-modal="false">
	<div class="lyrics-head">
		<span class="label"><?php esc_html_e( 'Lyrics · auto-captions, may be rough', 'callboard' ); ?></span>
		<button type="button" class="ctl" id="close-lyrics" aria-label="<?php esc_attr_e( 'Close lyrics', 'callboard' ); ?>"><?php echo callboard_icon( 'close' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static SVG shipped with the plugin. ?></button>
	</div>
	<ol class="lyrics-lines" id="lyrics-lines"></ol>
</section>

