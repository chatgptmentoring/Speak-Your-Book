<?php
/**
 * The AI guide: POST /wp-json/lcc-fair/v1/guide
 * The fair sends the visitor's question and its own facts; this site adds the OpenAI key, asks
 * OpenAI, and sends the answer back. The key never leaves this site.
 */

if (!defined('ABSPATH')) {
	exit;
}

// registered after (and over) the earlier Fair Guide plugin's endpoint, should it still be active
add_action('rest_api_init', function () {
	register_rest_route('lcc-fair/v1', '/guide', array(
		'methods'             => 'POST',
		'callback'            => 'lcc_vbf_guide_answer',
		'permission_callback' => '__return_true',
	), true);
}, 20);

function lcc_vbf_guide_system_prompt() {
	return <<<'PROMPT'
You are the warm, elegant guide of The Virtual Book Fair, a walkable 3D book fair floating in space, hosted by Life Coach Code. You help visitors find books, meet the authors, join the live event, and learn how to create their own book with Life Coach Code (Speak Your Book).

Rules:
- Use ONLY the FAIR FACTS. If something is not in them (for example the exact time of a talk), say it has not been announced in the fair yet and suggest registering. Never invent times, facts, biographies, prices or links.
- Never mention prices or costs, except that the live event and the discovery call are free.
- Keep replies short and visual: one to three sentences, or a short list of a few words per line. Under 70 words. Warm, clear, never pushy.
- To join the live event, point visitors to the Join on Zoom link from the facts (it opens in a new window or the Zoom app).
- Format with light Markdown: **bold**, *italic*, "- " bullet lists, and [label](url) links using only URLs that appear in the facts.
- Refer to people by name and do not guess anyone's pronouns.
- Stay on the fair, its books, authors, the event and Life Coach Code; kindly steer anything else back.
- Reply in the visitor's language.

Respond with a JSON object: {"reply": "<markdown>", "actions": [ ... ]} with at most 3 actions, each one of:
{"type":"goto","place":"<a place id from places>"}   walks the visitor there
{"type":"book","slug":"<book slug>"}   opens the book
{"type":"author","id":"<author id>"}   opens the author's panel
{"type":"message","id":"<author id>"}   opens a form to email that author (only if canReceiveMessages is true)
{"type":"link","label":"<short label>","url":"<a url from the facts>"}
{"type":"event"}   opens the live event panel (registration, calendar, speakers)
{"type":"creator"}   lets the visitor design a cover for their own book
{"type":"tour"}   starts the guided tour
{"type":"watch"}   opens the live stream (only if event.streamInTheFair is true)
When the visitor wants to go somewhere or see a booth, include a goto action.
PROMPT;
}

function lcc_vbf_guide_answer(WP_REST_Request $request) {
	$key = lcc_vbf_openai_key();
	if (!$key) {
		return new WP_REST_Response(array('error' => 'not_configured'), 503);
	}
	if (!lcc_vbf_request_origin_allowed()) {
		return new WP_REST_Response(array('error' => 'origin_not_allowed'), 403);
	}

	// the fair sends plain text (no preflight); it is JSON inside
	$body = json_decode($request->get_body(), true);
	if (!is_array($body) || empty($body['messages']) || !is_array($body['messages'])) {
		return new WP_REST_Response(array('error' => 'bad_request'), 400);
	}
	$messages = array();
	foreach (array_slice($body['messages'], -10) as $m) {
		if (!is_array($m) || !isset($m['content']) || !is_string($m['content'])) {
			continue;
		}
		$text = trim(mb_substr($m['content'], 0, 1500));
		if ($text !== '') {
			$messages[] = array('role' => (isset($m['role']) && $m['role'] === 'assistant') ? 'assistant' : 'user', 'content' => $text);
		}
	}
	if (!$messages) {
		return new WP_REST_Response(array('error' => 'bad_request'), 400);
	}
	$facts = isset($body['knowledge']) && is_string($body['knowledge']) ? mb_substr($body['knowledge'], 0, 60000) : '{}';
	$zone  = isset($body['zone']) && is_string($body['zone']) ? sanitize_text_field(mb_substr($body['zone'], 0, 80)) : '';

	// limits: per visitor and per day for everyone; past them the fair answers on its own
	$o = lcc_vbf_options();
	if (!lcc_vbf_take('guide', max(1, (int) $o['per_hour']), max(1, (int) $o['per_day']))) {
		return new WP_REST_Response(array('error' => 'slow_down'), 429);
	}

	$response = wp_remote_post(apply_filters('lcc_vbf_openai_url', 'https://api.openai.com/v1/chat/completions'), array(
		'timeout' => 30,
		'headers' => array(
			'Authorization' => 'Bearer ' . $key,
			'Content-Type'  => 'application/json',
		),
		'body'    => wp_json_encode(array(
			'model'           => $o['model'] ? $o['model'] : 'gpt-4o-mini',
			'temperature'     => 0.4,
			'max_tokens'      => 500,
			'response_format' => array('type' => 'json_object'),
			'messages'        => array_merge(array(
				array('role' => 'system', 'content' => lcc_vbf_guide_system_prompt()),
				array('role' => 'system', 'content' => "FAIR FACTS (JSON):\n" . $facts),
				array('role' => 'system', 'content' => 'The visitor is currently at: ' . ($zone ? $zone : 'the entrance')),
			), $messages),
		)),
	));
	if (is_wp_error($response)) {
		return new WP_REST_Response(array('error' => 'upstream_unreachable'), 502);
	}
	$data = json_decode(wp_remote_retrieve_body($response), true);
	$text = isset($data['choices'][0]['message']['content']) ? $data['choices'][0]['message']['content'] : '';
	if ((int) wp_remote_retrieve_response_code($response) !== 200 || $text === '') {
		return new WP_REST_Response(array('error' => 'upstream_error'), 502);
	}
	$out = json_decode($text, true);
	if (!is_array($out) || !isset($out['reply'])) {
		$out = array('reply' => $text, 'actions' => array());
	}
	return new WP_REST_Response(array(
		'reply'   => (string) $out['reply'],
		'actions' => (isset($out['actions']) && is_array($out['actions'])) ? array_slice($out['actions'], 0, 3) : array(),
	), 200);
}
