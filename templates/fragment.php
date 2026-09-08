<?php
/**
 * A view without the shell: the <main> the script swaps into the page on navigation.
 * The same templates render it, so there is one renderer, on the server. The service worker keeps
 * copies of these for offline, and the home fragment is part of the precached shell.
 *
 * @package Callboard
 */

defined( 'ABSPATH' ) || exit;

$callboard_view = Callboard\Router::view();
$callboard_set  = $callboard_view ? Callboard\Sets::by_slug( $callboard_view ) : null;

header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
header( 'Cache-Control: no-cache' ); // The worker and the page decide what to keep, not the HTTP cache.
callboard_template(
	$callboard_set ? 'set' : 'home',
	array(
		'set'       => $callboard_set,
		'not_found' => null === $callboard_view,
	)
);
