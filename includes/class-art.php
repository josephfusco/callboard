<?php
/**
 * Cover and share-card artwork, drawn with GD. Quiet: warm ground, the set name, a label, one accent.
 *
 * @package Callboard
 */

namespace Callboard;

defined( 'ABSPATH' ) || exit;

/**
 * Artwork generator.
 */
final class Art {

	private const BG     = array( 241, 238, 231 );
	private const INK    = array( 30, 28, 26 );
	private const MUTED  = array( 120, 116, 108 );
	private const ACCENT = array( 232, 84, 30 );

	/**
	 * 1024×1024 Now Playing cover.
	 *
	 * @param array<string, mixed> $manifest Set manifest.
	 * @param string               $out      Output path.
	 */
	public static function cover( array $manifest, string $out ): bool {
		if ( ! self::ready() ) {
			return false;
		}
		$s   = 1024;
		$pad = 90;
		$im  = self::canvas( $s, $s );
		self::dot( $im, $s - $pad - 22, $pad + 22, 22 );
		self::rule( $im, $pad, $pad + 20, 160 );
		$y = self::title( $im, (string) $manifest['name'], $pad - 4, $s - $pad - 66, $s - 2 * $pad, 140, 3 );
		self::text( $im, 32, $pad, $s - $pad - 8, self::MUTED, self::label( $manifest ), 'SemiBold' );
		return imagepng( $im, $out, 6 );
	}

	/**
	 * 1200×630 link-preview card.
	 *
	 * @param array<string, mixed> $manifest Set manifest.
	 * @param string               $out      Output path.
	 */
	public static function share( array $manifest, string $out ): bool {
		if ( ! self::ready() ) {
			return false;
		}
		$w   = 1200;
		$h   = 630;
		$pad = 80;
		$im  = self::canvas( $w, $h );
		self::dot( $im, $w - $pad - 20, $pad + 20, 20 );
		self::rule( $im, $pad, $pad + 16, 140 );
		self::title( $im, (string) $manifest['name'], $pad - 4, $h - $pad - 70, $w - 2 * $pad - 220, 124, 2 );
		self::text( $im, 28, $pad, $h - $pad - 6, self::MUTED, self::label( $manifest ), 'SemiBold' );
		// A quiet row of level bars, bottom right.
		$bx = $w - $pad - 4 * 18;
		foreach ( array( 18, 34, 26, 42 ) as $k => $bar ) {
			$c = imagecolorallocate( $im, ...( 1 === $k ? self::ACCENT : self::INK ) );
			imagefilledrectangle( $im, $bx + $k * 18, $h - $pad - $bar, $bx + $k * 18 + 8, $h - $pad, $c );
		}
		return imagepng( $im, $out, 6 );
	}

	/**
	 * "Rehearsal tracks · 20 tracks · 42 min".
	 *
	 * @param array<string, mixed> $manifest Set manifest.
	 */
	private static function label( array $manifest ): string {
		return Settings::get( 'tagline' ) . ' · ' . callboard_meta( (array) ( $manifest['tracks'] ?? array() ) );
	}

	/**
	 * GD with FreeType and our font present?
	 */
	private static function ready(): bool {
		return function_exists( 'imagecreatetruecolor' ) && function_exists( 'imagettftext' ) && file_exists( self::font( 'Bold' ) );
	}

	/**
	 * Font path.
	 *
	 * @param string $weight 'Bold' or 'SemiBold'.
	 */
	private static function font( string $weight ): string {
		return CALLBOARD_DIR . 'assets/fonts/Poppins-' . $weight . '.ttf';
	}

	/**
	 * Blank canvas in the ground color.
	 *
	 * @param int $w Width.
	 * @param int $h Height.
	 * @return \GdImage
	 */
	private static function canvas( int $w, int $h ) {
		$im = imagecreatetruecolor( $w, $h );
		imagefill( $im, 0, 0, imagecolorallocate( $im, ...self::BG ) );
		return $im;
	}

	/**
	 * Accent dot.
	 *
	 * @param \GdImage $im Image.
	 * @param int      $cx Center x.
	 * @param int      $cy Center y.
	 * @param int      $r  Radius.
	 */
	private static function dot( $im, int $cx, int $cy, int $r ): void {
		imagefilledellipse( $im, $cx, $cy, $r * 2, $r * 2, imagecolorallocate( $im, ...self::ACCENT ) );
	}

	/**
	 * Short hairline.
	 *
	 * @param \GdImage $im Image.
	 * @param int      $x  Left.
	 * @param int      $y  Top.
	 * @param int      $w  Width.
	 */
	private static function rule( $im, int $x, int $y, int $w ): void {
		imagefilledrectangle( $im, $x, $y, $x + $w, $y + 4, imagecolorallocate( $im, ...self::INK ) );
	}

	/**
	 * Draw one line of text at a baseline.
	 *
	 * @param \GdImage        $im     Image.
	 * @param int             $size   Point size.
	 * @param int             $x      Left.
	 * @param int             $y      Baseline.
	 * @param array<int, int> $rgb    Color.
	 * @param string          $text   Text.
	 * @param string          $weight Font weight.
	 */
	private static function text( $im, int $size, int $x, int $y, array $rgb, string $text, string $weight = 'Bold' ): void {
		imagettftext( $im, $size, 0, $x, $y, imagecolorallocate( $im, ...$rgb ), self::font( $weight ), $text );
	}

	/**
	 * Wrapped title, bottom-anchored: largest size that fits within $max_lines lines.
	 *
	 * @param \GdImage $im        Image.
	 * @param string   $title     Text.
	 * @param int      $x         Left.
	 * @param int      $bottom    Baseline of the last line.
	 * @param int      $max_w     Available width.
	 * @param int      $start     Starting point size.
	 * @param int      $max_lines Line cap.
	 * @return int Baseline of the first line.
	 */
	private static function title( $im, string $title, int $x, int $bottom, int $max_w, int $start, int $max_lines ): int {
		$size = $start;
		do {
			$lines = self::wrap( $title, $size, $max_w );
			if ( count( $lines ) <= $max_lines ) {
				break;
			}
			$size -= 8;
		} while ( $size > 40 );
		$lh = (int) round( $size * 1.35 );
		$y  = $bottom - $lh * ( count( $lines ) - 1 );
		foreach ( $lines as $line ) {
			self::text( $im, $size, $x, $y, self::INK, $line );
			$y += $lh;
		}
		return $bottom - $lh * ( count( $lines ) - 1 );
	}

	/**
	 * Greedy word wrap using measured widths.
	 *
	 * @param string $text  Text.
	 * @param int    $size  Point size.
	 * @param int    $max_w Max width in pixels.
	 * @return string[]
	 */
	private static function wrap( string $text, int $size, int $max_w ): array {
		$lines = array();
		$cur   = '';
		$words = preg_split( '/\s+/', trim( $text ) );
		foreach ( is_array( $words ) ? $words : array() as $word ) {
			$try = trim( $cur . ' ' . $word );
			$box = imagettfbbox( $size, 0, self::font( 'Bold' ), $try );
			if ( $box && ( $box[2] - $box[0] ) <= $max_w ) {
				$cur = $try;
			} else {
				if ( '' !== $cur ) {
					$lines[] = $cur;
				}
				$cur = $word;
			}
		}
		if ( '' !== $cur ) {
			$lines[] = $cur;
		}
		return $lines;
	}
}
