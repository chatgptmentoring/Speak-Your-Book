<?php
/**
 * Messages to authors: POST /wp-json/lcc-fair/v1/message
 * The visitor's message is emailed from this site to the author, who can simply reply. The
 * authors' addresses stay on the server and never appear in the page.
 */

if (!defined('ABSPATH')) {
	exit;
}

add_action('rest_api_init', function () {
	register_rest_route('lcc-fair/v1', '/message', array(
		'methods'             => 'POST',
		'callback'            => 'lcc_vbf_message_send',
		'permission_callback' => '__return_true',
	));
});

function lcc_vbf_message_reply($ok, $status, $message = '') {
	return new WP_REST_Response(array('success' => $ok, 'message' => $message), $status);
}

function lcc_vbf_message_send(WP_REST_Request $request) {
	if (!lcc_vbf_request_origin_allowed()) {
		return lcc_vbf_message_reply(false, 403, 'origin_not_allowed');
	}
	$b = json_decode($request->get_body(), true);
	if (!is_array($b)) {
		return lcc_vbf_message_reply(false, 400, 'bad_request');
	}
	if (!empty($b['_honey'])) {
		return lcc_vbf_message_reply(true, 200); // a bot filled the hidden field: say yes, send nothing
	}
	$field = function ($k, $max) use ($b) {
		return isset($b[$k]) && is_string($b[$k]) ? mb_substr(trim($b[$k]), 0, $max) : '';
	};

	$authors = lcc_vbf_authors();
	$id      = sanitize_key($field('author', 80));
	if (!isset($authors[$id])) {
		return lcc_vbf_message_reply(false, 404, 'unknown_author');
	}
	$o        = lcc_vbf_options();
	$inboxes  = lcc_vbf_inboxes();
	$own      = $inboxes[$id];
	$to       = $own ? $own : (is_email($o['fallback_inbox']) ? $o['fallback_inbox'] : '');
	if (!$to) {
		return lcc_vbf_message_reply(false, 404, 'no_inbox');
	}

	// one line, and nothing that could add another address to the reply
	$name    = trim(preg_replace('/[\r\n\t<>",;]+/', ' ', $field('name', 80)));
	$email   = sanitize_email($field('email', 120));
	$message = sanitize_textarea_field($field('message', 2000));
	if ($name === '' || $message === '' || !is_email($email)) {
		return lcc_vbf_message_reply(false, 400, 'missing_fields');
	}
	if (!lcc_vbf_take('message', 5, 500)) {
		return lcc_vbf_message_reply(false, 429, 'slow_down');
	}

	$author = $authors[$id]['name'];
	$books  = !empty($authors[$id]['books']) ? implode(', ', $authors[$id]['books']) : '';
	$lines  = array(
		$own
			? sprintf('%s wrote to you through the Virtual Book Fair of Life Coach Code.', $name)
			: sprintf('%s wrote to %s through the Virtual Book Fair of Life Coach Code. Please pass this message along.', $name, $author),
		'',
		$message,
		'',
		'---',
		sprintf('From: %s <%s>', $name, $email),
		$books ? sprintf('For: %s (%s)', $author, $books) : sprintf('For: %s', $author),
		sprintf('Reply to this email to answer %s directly.', $name),
	);
	$sent = wp_mail(
		$to,
		sprintf('A message for %s from the Virtual Book Fair', $author),
		implode("\n", $lines),
		array(
			'Reply-To: ' . $name . ' <' . $email . '>',
			'Content-Type: text/plain; charset=UTF-8',
		)
	);
	return $sent ? lcc_vbf_message_reply(true, 200) : lcc_vbf_message_reply(false, 502, 'mail_failed');
}
