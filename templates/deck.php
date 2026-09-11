<?php
/**
 * Persistent player and the Home Screen hint. Lives outside #main so it survives view swaps.
 *
 * @package Callboard
 */

defined( 'ABSPATH' ) || exit;
?>
<section class="deck<?php echo 'matrix' === Callboard\Settings::get( 'display' ) ? ' matrix' : ''; ?>" id="deck" aria-label="<?php esc_attr_e( 'Player', 'callboard' ); ?>" hidden>
	<i class="deck-glow-halo" id="deck-glow-halo" aria-hidden="true"></i><i class="deck-glow" id="deck-glow" aria-hidden="true"></i><i class="deck-glow-hot" id="deck-glow-hot" aria-hidden="true"></i>
	<div class="deck-inner deck-display">
		<div class="deck-text">
			<button type="button" class="deck-open" id="open-lyrics" aria-expanded="false" aria-controls="lyrics" aria-label="<?php esc_attr_e( 'Show current track', 'callboard' ); ?>"><span class="matrix-window" id="matrix-window" aria-hidden="true"><canvas class="matrix-grid" id="matrix-grid"></canvas><canvas class="matrix-text" id="matrix"></canvas></span>
				<span class="deck-title" id="now-title" aria-live="polite"><span class="mq"><span><?php esc_html_e( 'Choose a track', 'callboard' ); ?></span></span></span>
			</button>
			<span class="deck-time" data-offline="<?php esc_attr_e( 'Offline', 'callboard' ); ?>"><button type="button" class="remote-chip is-away" id="remote" data-state="" aria-label="<?php esc_attr_e( 'Play on another device', 'callboard' ); ?>"><?php echo callboard_icon( 'cast' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static SVG shipped with the plugin. ?></button><span id="cur">0:00</span><span class="sep" aria-hidden="true"> / </span><span id="dur">0:00</span></span>
		</div>
	</div>
	<div class="seek-wrap">
		<canvas class="wave wave-base" id="wave-base" aria-hidden="true"></canvas><canvas class="wave wave-hover" id="wave-hover" aria-hidden="true"></canvas><div class="wave-reveal" id="wave-reveal" aria-hidden="true"><canvas class="wave wave-played" id="wave-played"></canvas></div>
		<span class="seek-line" aria-hidden="true"><i class="seek-fill" id="seek-fill"></i><i class="loop-band" id="loop-band"></i></span><span class="seek-marks" id="seek-marks" aria-hidden="true"></span><i class="seek-knob" id="seek-knob" aria-hidden="true"></i>
		<input type="range" id="seek" min="0" max="1000" value="0" step="1" aria-label="<?php esc_attr_e( 'Seek', 'callboard' ); ?>" aria-valuetext="0:00">
	</div>
	<div class="deck-inner deck-transport">
		<div class="deck-controls">
			<button type="button" class="ctl skip" id="prev" aria-label="<?php esc_attr_e( 'Previous', 'callboard' ); ?>"><?php echo callboard_icon( 'prev' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static SVG shipped with the plugin. ?></button>
			<button type="button" class="ctl play" id="toggle" data-state="play" aria-label="<?php esc_attr_e( 'Play', 'callboard' ); ?>"><i class="cap" aria-hidden="true"><svg class="pp" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path class="glyph" d="M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z"/><path class="glyph-pause" d="M 11,10 15,10 15,26 11,26 z M 20,10 24,10 24,26 20,26 z"/></svg></i></button>
			<button type="button" class="ctl skip" id="next" aria-label="<?php esc_attr_e( 'Next', 'callboard' ); ?>"><?php echo callboard_icon( 'next' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static SVG shipped with the plugin. ?></button>
		</div>
		<audio id="audio" preload="metadata"></audio>
	</div>
</section>

<button type="button" class="update" id="update" hidden><span><?php esc_html_e( 'Updated', 'callboard' ); ?></span><span class="update-go"><?php esc_html_e( 'Reload', 'callboard' ); ?></span></button>
<p class="toast" id="toast" role="status" hidden></p>
<div class="a2hs" id="a2hs" hidden role="status">
	<?php echo callboard_icon( 'share' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static SVG shipped with the plugin. ?>
	<p id="a2hs-text"><?php echo wp_kses( __( 'Keep this on your phone: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.', 'callboard' ), array( 'strong' => array() ) ); ?></p>
	<button type="button" class="btn btn-small" id="a2hs-go" hidden></button>
	<button type="button" class="a2hs-x" id="a2hs-close" aria-label="<?php esc_attr_e( 'Dismiss', 'callboard' ); ?>">&times;</button>
</div>

<section class="lyrics" id="lyrics" hidden aria-label="<?php esc_attr_e( 'Lyrics', 'callboard' ); ?>" role="dialog" aria-modal="false">
	<div class="lyrics-head">
		<span class="label" id="sheet-label"><?php esc_html_e( 'Lyrics · auto-captions, may be rough', 'callboard' ); ?></span>
		<button type="button" class="ctl" id="close-lyrics" aria-label="<?php esc_attr_e( 'Close lyrics', 'callboard' ); ?>"><?php echo callboard_icon( 'close' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static SVG shipped with the plugin. ?></button>
	</div>
	<ol class="lyrics-lines" id="lyrics-lines"></ol>
</section>

