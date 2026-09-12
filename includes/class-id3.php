<?php
/**
 * A small ID3v2.3 writer: enough to make an exported mp3 name itself on a car stereo.
 *
 * WordPress bundles getID3's reading modules but not its writing ones, and a composer
 * dependency for five frames would weigh more than the frames do. v2.3 rather than v2.4
 * because head units that predate v2.4 are exactly the ones that need the tag.
 *
 * @package Callboard
 */

namespace Callboard;

defined( 'ABSPATH' ) || exit;

/**
 * ID3v2.3 tag writing.
 */
final class Id3 {

	/** Front cover, per the APIC picture types. */
	private const PICTURE_COVER = 0x03;

	/**
	 * Prepend a tag to an mp3, replacing any ID3v2 tag already on it.
	 *
	 * @param string               $file   Absolute path to the mp3, rewritten in place.
	 * @param array<string,string> $frames Frame ID to text, e.g. array( 'TIT2' => 'Overture' ).
	 * @param string|null          $cover  Absolute path to a cover image, or null.
	 * @return bool Whether the file was rewritten.
	 */
	public static function write( string $file, array $frames, ?string $cover = null ): bool {
		$audio = self::without_tag( $file );
		if ( null === $audio ) {
			return false;
		}

		$body = '';
		foreach ( $frames as $id => $text ) {
			if ( '' !== $text ) {
				$body .= self::frame( $id, self::text( $text ) );
			}
		}
		if ( $cover ) {
			$picture = self::picture( $cover );
			if ( '' !== $picture ) {
				$body .= self::frame( 'APIC', $picture );
			}
		}
		if ( '' === $body ) {
			return false;
		}

		$tag = 'ID3' . chr( 3 ) . chr( 0 ) . chr( 0 ) . self::syncsafe( strlen( $body ) ) . $body;

		return false !== file_put_contents( $file, $tag . $audio ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a file this export just wrote into its own directory.
	}

	/**
	 * A file's audio with any leading ID3v2 tag removed.
	 *
	 * @param string $file Absolute path.
	 */
	private static function without_tag( string $file ): ?string {
		$data = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a file this export just copied.
		if ( false === $data ) {
			return null;
		}
		if ( ! str_starts_with( $data, 'ID3' ) || strlen( $data ) < 10 ) {
			return $data;
		}

		// The header's size is syncsafe: seven bits per byte, and it excludes the header itself.
		$size   = ( ord( $data[6] ) << 21 ) | ( ord( $data[7] ) << 14 ) | ( ord( $data[8] ) << 7 ) | ord( $data[9] );
		$offset = 10 + $size;
		if ( 4 === ord( $data[3] ) && ( ord( $data[5] ) & 0x10 ) ) {
			$offset += 10;
		}

		return substr( $data, $offset );
	}

	/**
	 * One frame: four-character ID, size, two flag bytes, payload.
	 *
	 * Unlike the tag header's, a v2.3 frame size is a plain big-endian integer.
	 *
	 * @param string $id      Frame ID.
	 * @param string $payload Frame body, already encoded.
	 */
	private static function frame( string $id, string $payload ): string {
		return $id . pack( 'N', strlen( $payload ) ) . chr( 0 ) . chr( 0 ) . $payload;
	}

	/**
	 * A text frame's payload. Latin-1 where the text fits it, since the oldest players read
	 * nothing else, and UTF-16 with a byte-order mark where it does not.
	 *
	 * @param string $text Frame text.
	 */
	private static function text( string $text ): string {
		$latin = @iconv( 'UTF-8', 'ISO-8859-1', $text ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- a failure here is the answer, not an error.
		if ( false !== $latin && '' !== $latin ) {
			return chr( 0 ) . $latin;
		}

		$utf16 = @iconv( 'UTF-8', 'UTF-16LE', $text ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- same.

		return false === $utf16 ? chr( 0 ) . $text : chr( 1 ) . "\xFF\xFE" . $utf16;
	}

	/**
	 * An APIC payload: encoding, mime type, picture type, description, then the image.
	 *
	 * @param string $cover Absolute path to the image.
	 */
	private static function picture( string $cover ): string {
		if ( ! is_readable( $cover ) ) {
			return '';
		}
		$data = file_get_contents( $cover ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading the set's own cover.
		if ( false === $data || '' === $data ) {
			return '';
		}
		$mime = 'png' === strtolower( (string) pathinfo( $cover, PATHINFO_EXTENSION ) ) ? 'image/png' : 'image/jpeg';

		return chr( 0 ) . $mime . chr( 0 ) . chr( self::PICTURE_COVER ) . chr( 0 ) . $data;
	}

	/**
	 * A four-byte syncsafe integer: seven bits per byte, so the tag never looks like audio.
	 *
	 * @param int $size Byte count.
	 */
	private static function syncsafe( int $size ): string {
		return chr( ( $size >> 21 ) & 0x7F ) . chr( ( $size >> 14 ) & 0x7F ) . chr( ( $size >> 7 ) & 0x7F ) . chr( $size & 0x7F );
	}
}
