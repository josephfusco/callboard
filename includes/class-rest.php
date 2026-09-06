<?php
/**
 * REST API for runners: read the queue, report progress, upload a set's files, finish.
 * Authenticated only (application passwords work), capability manage_options.
 *
 * @package Callboard
 */

namespace Callboard;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * REST routes under callboard/v1.
 */
final class Rest {

	private const NS = 'callboard/v1';

	/**
	 * Hook registration.
	 */
	public static function register_hooks(): void {
		add_action( 'rest_api_init', array( self::class, 'routes' ) );
	}

	/**
	 * Register routes.
	 */
	public static function routes(): void {
		$perm = static fn() => current_user_can( 'manage_options' );
		$id   = array(
			'id' => array(
				'type'     => 'integer',
				'required' => true,
			),
		);

		register_rest_route(
			self::NS,
			'/requests',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => $perm,
				'callback'            => static fn( WP_REST_Request $r ) => array_map( array( Requests::class, 'to_array' ), Requests::all( $r->get_param( 'status' ) ? sanitize_key( $r->get_param( 'status' ) ) : null ) ),
			)
		);
		register_rest_route(
			self::NS,
			'/requests/(?P<id>\d+)/status',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => $perm,
				'args'                => $id + array(
					'status' => array(
						'type'     => 'string',
						'required' => true,
						'enum'     => Requests::STATUSES,
					),
					'log'    => array(
						'type'    => 'string',
						'default' => '',
					),
				),
				'callback'            => array( self::class, 'status' ),
			)
		);
		register_rest_route(
			self::NS,
			'/requests/(?P<id>\d+)/files',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => $perm,
				'args'                => $id,
				'callback'            => array( self::class, 'upload' ),
			)
		);
		register_rest_route(
			self::NS,
			'/requests/(?P<id>\d+)/complete',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => $perm,
				'args'                => $id,
				'callback'            => array( self::class, 'complete' ),
			)
		);
	}

	/**
	 * Update a request's status.
	 *
	 * @param WP_REST_Request $r Request.
	 */
	public static function status( WP_REST_Request $r ): WP_REST_Response|WP_Error {
		$id = (int) $r['id'];
		if ( ! Requests::set_status( $id, (string) $r['status'], (string) $r['log'] ) ) {
			return new WP_Error( 'callboard_not_found', __( 'No such request.', 'callboard' ), array( 'status' => 404 ) );
		}
		$post = get_post( $id );
		return new WP_REST_Response( $post ? Requests::to_array( $post ) : null );
	}

	/**
	 * Receive one file for the request's set folder (multipart field "file").
	 *
	 * @param WP_REST_Request $r Request.
	 */
	public static function upload( WP_REST_Request $r ): WP_REST_Response|WP_Error {
		$id   = (int) $r['id'];
		$slug = sanitize_title( (string) get_post_meta( $id, '_callboard_slug', true ) );
		if ( get_post_type( $id ) !== Requests::TYPE || ! $slug ) {
			return new WP_Error( 'callboard_not_found', __( 'No such request.', 'callboard' ), array( 'status' => 404 ) );
		}
		$files = $r->get_file_params();
		if ( empty( $files['file']['tmp_name'] ) ) {
			return new WP_Error( 'callboard_no_file', __( 'No file.', 'callboard' ), array( 'status' => 400 ) );
		}
		$name    = sanitize_file_name( basename( (string) ( $files['file']['name'] ?? 'file' ) ) );
		$allowed = array( 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'wav', 'flac', 'png', 'jpg', 'jpeg', 'webp', 'json', 'approved' );
		$ext     = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
		if ( ! in_array( $ext, $allowed, true ) ) {
			return new WP_Error( 'callboard_bad_type', __( 'File type not allowed.', 'callboard' ), array( 'status' => 415 ) );
		}
		$dir = Importer::source_dir() . '/' . $slug;
		if ( ! wp_mkdir_p( $dir ) ) {
			return new WP_Error( 'callboard_mkdir', __( 'Could not create the set folder.', 'callboard' ), array( 'status' => 500 ) );
		}
		$dest = $dir . '/' . $name;
		if ( ! move_uploaded_file( $files['file']['tmp_name'], $dest ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
			return new WP_Error( 'callboard_move', __( 'Could not store the file.', 'callboard' ), array( 'status' => 500 ) );
		}
		return new WP_REST_Response(
			array(
				'stored' => $slug . '/' . $name,
				'bytes'  => filesize( $dest ),
			)
		);
	}

	/**
	 * Import the folder and mark the request done.
	 *
	 * @param WP_REST_Request $r Request.
	 */
	public static function complete( WP_REST_Request $r ): WP_REST_Response|WP_Error {
		$id   = (int) $r['id'];
		$slug = sanitize_title( (string) get_post_meta( $id, '_callboard_slug', true ) );
		$dir  = Importer::source_dir() . '/' . $slug;
		if ( get_post_type( $id ) !== Requests::TYPE || ! file_exists( $dir . '/manifest.json' ) ) {
			return new WP_Error( 'callboard_incomplete', __( 'No manifest uploaded for this request.', 'callboard' ), array( 'status' => 409 ) );
		}
		$result = Importer::import_folder( $dir );
		$set    = Sets::post_by_slug( $slug );
		Requests::set_status( $id, $set ? 'done' : 'failed', $result );
		do_action( 'callboard_imported', array( $slug => $result ) );
		return new WP_REST_Response(
			array(
				'result' => $result,
				'set'    => $set ? home_url( '/' . $slug . '/' ) : null,
			)
		);
	}
}
