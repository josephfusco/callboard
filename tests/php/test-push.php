<?php
/**
 * The one route anybody on the internet can post to.
 *
 * Subscribing is deliberately open — a cast member turns on notifications without an account, which
 * is the whole point of a link in a group chat. That makes this the plugin's widest surface, so the
 * cases below are the ones somebody would actually try.
 *
 * @package Callboard
 */

use Callboard\Push;

/**
 * @covers \Callboard\Push
 */
class Test_Callboard_Push extends WP_UnitTestCase {

	private function subscribe( string $endpoint, string $p256dh = 'BKxQ', string $auth = 'c2Vj' ) {
		$r = new WP_REST_Request( 'POST', '/callboard/v1/push/subscribe' );
		$r->set_header( 'content-type', 'application/json' );
		$r->set_body(
			(string) wp_json_encode(
				array(
					'endpoint' => $endpoint,
					'keys'     => array(
						'p256dh' => $p256dh,
						'auth'   => $auth,
					),
				)
			)
		);
		return Push::subscribe( $r );
	}

	/**
	 * Sending a notice makes the server POST to whatever endpoint was stored. An https URL alone
	 * does not prove the endpoint is a push service — these are all https, and all of them point
	 * back inside the network the site runs in.
	 *
	 * @dataProvider inside_the_network
	 */
	public function test_an_endpoint_pointing_inward_is_refused( string $endpoint ): void {
		$result = $this->subscribe( $endpoint );

		$this->assertWPError( $result, "{$endpoint} was accepted" );
		$this->assertSame( 'callboard_bad_subscription', $result->get_error_code() );
	}

	/**
	 * @return array<string, array{0: string}>
	 */
	public function inside_the_network(): array {
		return array(
			'loopback by name'    => array( 'https://localhost/push' ),
			'loopback by address' => array( 'https://127.0.0.1/push' ),
			'private 10.x'        => array( 'https://10.0.0.1/push' ),
			'private 192.168.x'   => array( 'https://192.168.1.1/push' ),
			'private 172.16.x'    => array( 'https://172.16.0.1/push' ),
			'credentials in host' => array( 'https://user:pass@example.com/push' ),
		);
	}

	/**
	 * @dataProvider not_a_subscription
	 */
	public function test_something_that_is_not_a_subscription_is_refused( string $endpoint, string $p256dh, string $auth ): void {
		$result = $this->subscribe( $endpoint, $p256dh, $auth );

		$this->assertWPError( $result );
		$this->assertSame( 'callboard_bad_subscription', $result->get_error_code() );
	}

	/**
	 * @return array<string, array{0: string, 1: string, 2: string}>
	 */
	public function not_a_subscription(): array {
		return array(
			'no endpoint'    => array( '', 'BKxQ', 'c2Vj' ),
			'plain http'     => array( 'http://push.example.com/x', 'BKxQ', 'c2Vj' ),
			'a file path'    => array( 'file:///etc/passwd', 'BKxQ', 'c2Vj' ),
			'no public key'  => array( 'https://push.example.com/x', '', 'c2Vj' ),
			'no auth secret' => array( 'https://push.example.com/x', 'BKxQ', '' ),
		);
	}

	public function test_a_real_looking_subscription_is_stored_once_per_endpoint(): void {
		$endpoint = 'https://fcm.googleapis.com/fcm/send/abc123';

		$first = $this->subscribe( $endpoint );
		$this->assertNotWPError( $first );

		$before = Push::count();
		$again  = $this->subscribe( $endpoint );
		$this->assertNotWPError( $again );

		$this->assertSame( $before, Push::count(), 'the same browser subscribing twice is one subscriber, not two' );
	}

	/**
	 * The route is open, so the only thing standing between it and a table full of rows is the cap.
	 */
	public function test_the_subscriber_cap_is_enforced(): void {
		add_filter( 'callboard_max_subscribers', static fn(): int => 2 );

		$this->assertNotWPError( $this->subscribe( 'https://fcm.googleapis.com/fcm/send/one' ) );
		$this->assertNotWPError( $this->subscribe( 'https://fcm.googleapis.com/fcm/send/two' ) );

		$third = $this->subscribe( 'https://fcm.googleapis.com/fcm/send/three' );
		$this->assertWPError( $third );
		$this->assertSame( 'callboard_full', $third->get_error_code() );

		remove_all_filters( 'callboard_max_subscribers' );
	}

	/**
	 * A subscription holds credentials for one browser. They are stored, so they must not also be
	 * readable by anyone who asks the REST API nicely.
	 */
	public function test_subscriber_records_are_private(): void {
		$this->assertNotWPError( $this->subscribe( 'https://fcm.googleapis.com/fcm/send/private' ) );

		$posts = get_posts(
			array(
				'post_type'   => Push::TYPE,
				'post_status' => 'any',
				'numberposts' => -1,
			)
		);

		$this->assertNotEmpty( $posts );
		foreach ( $posts as $post ) {
			$this->assertSame( 'private', $post->post_status );
		}

		$type = get_post_type_object( Push::TYPE );
		$this->assertFalse( $type->public, 'subscriber records must not be a public post type' );
		$this->assertFalse( (bool) $type->show_in_rest, 'subscriber records must not be exposed over REST' );
	}
}
