<?php
/**
 * Plugin Name: LCC Virtual Book Fair Guide
 * Description: Connects the AI guide of the Virtual Book Fair to OpenAI. The API key stays private on this site; the fair only ever talks to this plugin.
 * Version: 1.0.0
 * Author: Life Coach Code
 * License: GPL-2.0-or-later
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
	exit;
}

const LCC_FAIR_GUIDE_OPTION = 'lcc_fair_guide';

function lcc_fair_guide_options() {
	return wp_parse_args(get_option(LCC_FAIR_GUIDE_OPTION, array()), array(
		'api_key'  => '',
		'model'    => 'gpt-4o-mini',
		'origins'  => 'https://chatgptmentoring.github.io',
		'per_hour' => 40,
		'per_day'  => 3000,
	));
}

/* The key can also be set in wp-config.php: define('LCC_FAIR_OPENAI_KEY', 'sk-...'); */
function lcc_fair_guide_key() {
	if (defined('LCC_FAIR_OPENAI_KEY') && LCC_FAIR_OPENAI_KEY) {
		return LCC_FAIR_OPENAI_KEY;
	}
	$o = lcc_fair_guide_options();
	return $o['api_key'];
}

function lcc_fair_guide_origin_allowed($origin) {
	$o       = lcc_fair_guide_options();
	$allowed = array_filter(array_map('trim', preg_split('/[\s,]+/', (string) $o['origins'])));
	return $origin && in_array(untrailingslashit($origin), array_map('untrailingslashit', $allowed), true);
}

/* ---------- settings: Settings > Fair Guide ---------- */
add_action('admin_menu', function () {
	add_options_page('Virtual Book Fair Guide', 'Fair Guide', 'manage_options', 'lcc-fair-guide', 'lcc_fair_guide_settings_page');
});

add_action('admin_init', function () {
	register_setting('lcc_fair_guide', LCC_FAIR_GUIDE_OPTION, array(
		'type'              => 'array',
		'sanitize_callback' => function ($in) {
			$old = lcc_fair_guide_options();
			$key = isset($in['api_key']) ? trim((string) $in['api_key']) : '';
			return array(
				// an empty field keeps the saved key, so it never has to be shown again
				'api_key'  => $key !== '' ? sanitize_text_field($key) : $old['api_key'],
				'model'    => sanitize_text_field(isset($in['model']) && $in['model'] !== '' ? $in['model'] : 'gpt-4o-mini'),
				'origins'  => sanitize_textarea_field(isset($in['origins']) ? $in['origins'] : $old['origins']),
				'per_hour' => max(1, (int) (isset($in['per_hour']) ? $in['per_hour'] : 40)),
				'per_day'  => max(1, (int) (isset($in['per_day']) ? $in['per_day'] : 3000)),
			);
		},
	));
});

function lcc_fair_guide_settings_page() {
	if (!current_user_can('manage_options')) {
		return;
	}
	$o        = lcc_fair_guide_options();
	$key      = lcc_fair_guide_key();
	$endpoint = rest_url('lcc-fair/v1/guide');
	$today    = (int) get_option('lcc_fair_guide_day_' . gmdate('Ymd'), 0);
	?>
	<div class="wrap">
		<h1>Virtual Book Fair Guide</h1>
		<p>The AI guide in the fair sends visitors' questions here. This site adds the fair's facts and your OpenAI key, asks OpenAI, and sends the answer back. The key never leaves this site.</p>
		<p><strong>Paste this address into <code>FAIR_GUIDE.endpoint</code> in the fair's <code>assets/js/books.js</code>:</strong><br><code><?php echo esc_html($endpoint); ?></code></p>
		<form method="post" action="options.php">
			<?php settings_fields('lcc_fair_guide'); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="lccfg-key">OpenAI API key</label></th>
					<td>
						<input id="lccfg-key" type="password" name="<?php echo esc_attr(LCC_FAIR_GUIDE_OPTION); ?>[api_key]" value="" class="regular-text" autocomplete="off" placeholder="<?php echo $key ? 'Saved (ends in ' . esc_attr(substr($key, -4)) . '). Paste a new one to replace it.' : 'sk-...'; ?>">
						<p class="description">Tip: in your OpenAI account, set a monthly budget limit for this key's project.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="lccfg-model">Model</label></th>
					<td><input id="lccfg-model" type="text" name="<?php echo esc_attr(LCC_FAIR_GUIDE_OPTION); ?>[model]" value="<?php echo esc_attr($o['model']); ?>" class="regular-text"><p class="description">A small, low-cost model is plenty, for example gpt-4o-mini.</p></td>
				</tr>
				<tr>
					<th scope="row"><label for="lccfg-origins">Fair address(es)</label></th>
					<td><textarea id="lccfg-origins" name="<?php echo esc_attr(LCC_FAIR_GUIDE_OPTION); ?>[origins]" rows="2" class="large-text code"><?php echo esc_textarea($o['origins']); ?></textarea><p class="description">Only these sites may use the guide (one per line, no trailing path).</p></td>
				</tr>
				<tr>
					<th scope="row">Limits</th>
					<td>
						<label>Questions per visitor per hour <input type="number" min="1" name="<?php echo esc_attr(LCC_FAIR_GUIDE_OPTION); ?>[per_hour]" value="<?php echo esc_attr($o['per_hour']); ?>" class="small-text"></label><br>
						<label>Questions per day, for everyone <input type="number" min="1" name="<?php echo esc_attr(LCC_FAIR_GUIDE_OPTION); ?>[per_day]" value="<?php echo esc_attr($o['per_day']); ?>" class="small-text"></label>
						<p class="description">Answered today: <?php echo (int) $today; ?>. When a limit is reached the guide quietly falls back to its built-in answers.</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

/* ---------- the endpoint: POST /wp-json/lcc-fair/v1/guide ---------- */
add_action('rest_api_init', function () {
	register_rest_route('lcc-fair/v1', '/guide', array(
		'methods'             => 'POST',
		'callback'            => 'lcc_fair_guide_answer',
		'permission_callback' => '__return_true',
	));
});

add_filter('rest_pre_serve_request', function ($served, $result, $request) {
	if (strpos($request->get_route(), '/lcc-fair/v1/') === 0) {
		$origin = get_http_origin();
		if (lcc_fair_guide_origin_allowed($origin)) {
			header('Access-Control-Allow-Origin: ' . esc_url_raw($origin));
			header('Access-Control-Allow-Methods: POST, OPTIONS');
			header('Access-Control-Allow-Headers: Content-Type');
			header('Vary: Origin');
		}
	}
	return $served;
}, 15, 3);

function lcc_fair_guide_system_prompt() {
	return <<<'PROMPT'
You are the warm, elegant guide of The Virtual Book Fair, a walkable 3D book fair floating in space, hosted by Life Coach Code. You help visitors find books, meet the authors, join the live event, and learn how to create their own book with Life Coach Code (Speak Your Book).

Rules:
- Use ONLY the FAIR FACTS. If something is not in them (for example the exact time of a talk), say it has not been announced in the fair yet and suggest registering. Never invent times, facts, biographies, prices or links.
- Never mention prices or costs, except that the live event and the discovery call are free.
- Keep replies short: one to four sentences, or a short list. Under 110 words. Warm, clear, never pushy.
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

function lcc_fair_guide_answer(WP_REST_Request $request) {
	$key = lcc_fair_guide_key();
	if (!$key) {
		return new WP_REST_Response(array('error' => 'not_configured'), 503);
	}
	if (!lcc_fair_guide_origin_allowed(get_http_origin())) {
		return new WP_REST_Response(array('error' => 'origin_not_allowed'), 403);
	}
	$o = lcc_fair_guide_options();

	// limits: per visitor (hashed IP, nothing stored in clear) and per day for everyone
	$who   = 'lcc_fg_' . substr(hash('sha256', (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '') . wp_salt()), 0, 32);
	$count = (int) get_transient($who);
	if ($count >= (int) $o['per_hour']) {
		return new WP_REST_Response(array('error' => 'slow_down'), 429);
	}
	$day_key = 'lcc_fair_guide_day_' . gmdate('Ymd');
	$today   = (int) get_option($day_key, 0);
	if ($today >= (int) $o['per_day']) {
		return new WP_REST_Response(array('error' => 'daily_limit'), 429);
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

	set_transient($who, $count + 1, HOUR_IN_SECONDS);
	update_option($day_key, $today + 1, false);

	$response = wp_remote_post('https://api.openai.com/v1/chat/completions', array(
		'timeout' => 30,
		'headers' => array(
			'Authorization' => 'Bearer ' . $key,
			'Content-Type'  => 'application/json',
		),
		'body'    => wp_json_encode(array(
			'model'           => $o['model'],
			'temperature'     => 0.4,
			'max_tokens'      => 500,
			'response_format' => array('type' => 'json_object'),
			'messages'        => array_merge(array(
				array('role' => 'system', 'content' => lcc_fair_guide_system_prompt()),
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
	if (wp_remote_retrieve_response_code($response) !== 200 || $text === '') {
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
