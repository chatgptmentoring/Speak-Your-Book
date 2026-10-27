<?php
/**
 * Shared pieces: the fair's data, the settings, who may call the fair's endpoints, and limits.
 */

if (!defined('ABSPATH')) {
	exit;
}

/* What the build took from the fair's books.js (authors, their inboxes, the event). */
function lcc_vbf_data() {
	static $data = null;
	if ($data === null) {
		$file = LCC_VBF_DIR . 'fair-data.php';
		$data = is_readable($file) ? include $file : array();
		$data = wp_parse_args(is_array($data) ? $data : array(), array(
			'build'   => LCC_VBF_VERSION,
			'authors' => array(),
			'event'   => array(),
		));
		$data['event'] = wp_parse_args($data['event'], array('date' => '', 'register' => '', 'registerEmbed' => '', 'zoom' => ''));
	}
	return $data;
}

function lcc_vbf_authors() {
	$out = array();
	foreach (lcc_vbf_data()['authors'] as $a) {
		$out[$a['id']] = $a;
	}
	return $out;
}

function lcc_vbf_defaults() {
	return array(
		'page_id'        => 0,
		'start'          => '', // local date and time in the site's time zone, Y-m-d\TH:i
		'register'       => '', // the registration form's link
		'register_embed' => '', // and its embed address, when it is a Google Form
		'zoom'           => '',
		'schedule'       => '',
		'live'           => 1,
		'show_count'     => 1, // the "here now" counter in the top bar
		'ga'             => '',
		'openai_key'     => '',
		'model'          => 'gpt-4o-mini',
		'per_hour'       => 40,
		'per_day'        => 3000,
		'origins'        => 'https://chatgptmentoring.github.io',
		'inboxes'        => array(), // author id => email; authors not listed keep the address from the fair
		'fallback_inbox' => '',
	);
}

function lcc_vbf_options() {
	$saved = get_option(LCC_VBF_OPTION, array());
	return wp_parse_args(is_array($saved) ? $saved : array(), lcc_vbf_defaults());
}

/* Where each author's messages go: author id => email, or '' when they have none. */
function lcc_vbf_inboxes() {
	$o   = lcc_vbf_options();
	$out = array();
	foreach (lcc_vbf_authors() as $id => $a) {
		$email    = array_key_exists($id, (array) $o['inboxes']) ? $o['inboxes'][$id] : (isset($a['inbox']) ? $a['inbox'] : '');
		$out[$id] = is_email($email) ? $email : '';
	}
	return $out;
}

/* The key can also be set in wp-config.php: define('LCC_FAIR_OPENAI_KEY', 'sk-...'); */
function lcc_vbf_openai_key() {
	if (defined('LCC_FAIR_OPENAI_KEY') && LCC_FAIR_OPENAI_KEY) {
		return LCC_FAIR_OPENAI_KEY;
	}
	$o = lcc_vbf_options();
	if ($o['openai_key']) {
		return $o['openai_key'];
	}
	// a key saved in the earlier Fair Guide plugin carries over
	$old = get_option('lcc_fair_guide');
	return is_array($old) && !empty($old['api_key']) ? $old['api_key'] : '';
}

/* The event start as an ISO 8601 time with its offset, or '' while it is not set. */
function lcc_vbf_start_iso() {
	$o = lcc_vbf_options();
	if (!$o['start']) {
		return '';
	}
	$dt = date_create_immutable_from_format('Y-m-d\TH:i', $o['start'], wp_timezone());
	return $dt ? $dt->format('c') : '';
}

/*
 * The programme, one line per talk or break: "time | who | title | minutes", for example
 *   5:00 pm | Chuck Barnard | Raising resilient teens | 20
 *   5:20 pm | Break | Lanterns and a breathing minute
 * Times are in the site's time zone unless the line names one (5:00 pm GMT). Minutes is optional:
 * without it a talk lasts until the next line.
 */
function lcc_vbf_parse_schedule($raw, &$problems = null) {
	$problems = array();
	$out      = array();
	$o        = lcc_vbf_options();
	$day      = $o['start'] ? substr($o['start'], 0, 10) : lcc_vbf_data()['event']['date'];
	foreach (preg_split('/\r\n|\r|\n/', (string) $raw) as $line) {
		$line = trim($line);
		if ($line === '') {
			continue;
		}
		$parts   = array_map('trim', explode('|', $line));
		$at      = count($parts) >= 2 ? lcc_vbf_time_on($day, $parts[0]) : '';
		$break   = isset($parts[1]) && preg_match('/^(break|pause|intermission)$/i', $parts[1]);
		$id      = $break || !isset($parts[1]) ? '' : lcc_vbf_find_author($parts[1]);
		$minutes = isset($parts[3]) && preg_match('/^(\d{1,3})/', $parts[3], $m) ? (int) $m[1] : 0;
		if (!$at || (!$break && !$id)) {
			$problems[] = $line;
			continue;
		}
		$entry = array('at' => $at, 'time' => $parts[0], 'title' => isset($parts[2]) ? $parts[2] : '');
		if ($break) {
			$entry['break'] = true;
		} else {
			$entry['author'] = $id;
		}
		if ($minutes) {
			$entry['minutes'] = $minutes;
		}
		$out[] = $entry;
	}
	return $out;
}

/* "5:00 pm", "17:00", "5pm" or "5:00 pm GMT" on the event's day, as an ISO 8601 time; '' if unreadable. */
function lcc_vbf_time_on($day, $time) {
	$time = preg_replace('/\b([ap])\.?m\.?/i', '$1m', trim((string) $time));
	$time = preg_replace('/^(\d{1,2})\.(\d{2})/', '$1:$2', $time);
	if (!$day || !preg_match('/^\d{1,2}(:\d{2})?\s*(am|pm)?(\s+[a-z][a-z\/_+\-0-9:]*)?$/i', $time)) {
		return '';
	}
	try {
		$dt = new DateTimeImmutable($day . ' ' . $time, wp_timezone());
	} catch (Exception $e) {
		return '';
	}
	return $dt->format('c');
}

function lcc_vbf_find_author($name) {
	$fold = function ($s) {
		return trim(preg_replace('/[^a-z0-9]+/', ' ', strtolower(remove_accents((string) $s))));
	};
	$want = $fold($name);
	if ($want === '') {
		return '';
	}
	$partial = array();
	foreach (lcc_vbf_authors() as $id => $a) {
		if ($want === $fold($id) || $want === $fold($a['name'])) {
			return $id;
		}
		if (strpos(' ' . $fold($a['name']) . ' ', ' ' . $want . ' ') !== false) {
			$partial[] = $id;
		}
	}
	return count($partial) === 1 ? $partial[0] : '';
}

/* The page that shows the fair: the one chosen in the settings, or any page using the template. */
function lcc_vbf_page_id() {
	$o = lcc_vbf_options();
	if ($o['page_id'] && get_post_status((int) $o['page_id'])) {
		return (int) $o['page_id'];
	}
	$found = get_posts(array(
		'post_type'      => 'page',
		'post_status'    => array('publish', 'draft', 'pending', 'private', 'future'),
		'meta_key'       => '_wp_page_template',
		'meta_value'     => LCC_VBF_TEMPLATE,
		'posts_per_page' => 1,
		'fields'         => 'ids',
	));
	return $found ? (int) $found[0] : 0;
}

/* ---------- who may call the fair's endpoints ---------- */

function lcc_vbf_origin_of($url) {
	$p = wp_parse_url((string) $url);
	if (empty($p['scheme']) || empty($p['host'])) {
		return '';
	}
	return strtolower($p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : ''));
}

function lcc_vbf_allowed_origins() {
	$o       = lcc_vbf_options();
	$allowed = array();
	foreach (array(home_url(), site_url()) as $url) {
		$origin    = lcc_vbf_origin_of($url);
		$allowed[] = $origin;
		// the same site with and without www
		$allowed[] = strpos($origin, '://www.') !== false ? str_replace('://www.', '://', $origin) : str_replace('://', '://www.', $origin);
	}
	foreach (preg_split('/[\s,]+/', (string) $o['origins']) as $url) {
		if (lcc_vbf_origin_of($url)) {
			$allowed[] = lcc_vbf_origin_of($url);
		}
	}
	return array_values(array_unique(array_filter($allowed)));
}

/* Requests must come from the fair's own page (or another address allowed in the settings). */
function lcc_vbf_request_origin_allowed() {
	$origin = get_http_origin();
	if (!$origin && !empty($_SERVER['HTTP_REFERER'])) {
		$origin = lcc_vbf_origin_of(wp_unslash($_SERVER['HTTP_REFERER']));
	}
	return $origin && in_array(lcc_vbf_origin_of($origin), lcc_vbf_allowed_origins(), true);
}

add_filter('rest_pre_serve_request', function ($served, $result, $request) {
	if (strpos($request->get_route(), '/lcc-fair/v1/') === 0) {
		$origin = get_http_origin();
		if ($origin && in_array(lcc_vbf_origin_of($origin), lcc_vbf_allowed_origins(), true)) {
			header('Access-Control-Allow-Origin: ' . esc_url_raw($origin));
			header('Access-Control-Allow-Methods: POST, OPTIONS');
			header('Access-Control-Allow-Headers: Content-Type');
			header('Vary: Origin');
		}
		header('Cache-Control: no-store');
	}
	return $served;
}, 15, 3);

/* ---------- limits ---------- */

/* A visitor, without storing their address: a salted hash of it. */
function lcc_vbf_visitor() {
	$ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
	// behind Cloudflare every visitor would otherwise share a handful of addresses
	if (!empty($_SERVER['HTTP_CF_CONNECTING_IP']) && filter_var(wp_unslash($_SERVER['HTTP_CF_CONNECTING_IP']), FILTER_VALIDATE_IP)) {
		$ip = wp_unslash($_SERVER['HTTP_CF_CONNECTING_IP']);
	}
	return substr(hash('sha256', $ip . wp_salt('nonce')), 0, 24);
}

/* Counts one use of $what; false once the visitor's hourly or everyone's daily limit is reached. */
function lcc_vbf_take($what, $per_hour, $per_day) {
	$mine  = 'lcc_vbf_' . $what . '_' . lcc_vbf_visitor();
	$day   = 'lcc_vbf_' . $what . '_day_' . gmdate('Ymd');
	$count = (int) get_transient($mine);
	$today = (int) get_transient($day);
	if ($count >= $per_hour || $today >= $per_day) {
		return false;
	}
	set_transient($mine, $count + 1, HOUR_IN_SECONDS);
	set_transient($day, $today + 1, DAY_IN_SECONDS * 2);
	return true;
}

function lcc_vbf_used_today($what) {
	return (int) get_transient('lcc_vbf_' . $what . '_day_' . gmdate('Ymd'));
}

/* ---------- after the settings change, ask page caches to show the new version ---------- */

add_action('update_option_' . LCC_VBF_OPTION, 'lcc_vbf_purge_page_cache');
add_action('add_option_' . LCC_VBF_OPTION, 'lcc_vbf_purge_page_cache');

function lcc_vbf_purge_page_cache() {
	$id = lcc_vbf_page_id();
	if (!$id) {
		return;
	}
	clean_post_cache($id);
	if (function_exists('rocket_clean_post')) {
		rocket_clean_post($id);
	}
	do_action('litespeed_purge_post', $id);
	do_action('lcc_vbf_purge_page_cache', $id);
}

/*
 * The registration form, given as a link or as the embed code Google Forms offers (Send > <>).
 * Returns its link and, for a Google Form, the address that shows it inside the fair.
 */
function lcc_vbf_form_urls($given) {
	$given = trim((string) $given);
	if ($given === '') {
		return array('link' => '', 'embed' => '');
	}
	if (stripos($given, '<iframe') !== false) {
		if (!preg_match('/\ssrc\s*=\s*["\']([^"\']+)["\']/i', $given, $m)) {
			return array('link' => '', 'embed' => '');
		}
		$given = html_entity_decode($m[1]);
	}
	if (!filter_var($given, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $given)) {
		return array('link' => '', 'embed' => '');
	}
	// a forms.gle short link: ask Google where it leads, once, when the settings are saved
	if (preg_match('#^https?://forms\.gle/#i', $given)) {
		$r   = wp_remote_head($given, array('redirection' => 0, 'timeout' => 8));
		$loc = is_wp_error($r) ? '' : wp_remote_retrieve_header($r, 'location');
		$full = is_string($loc) && preg_match('#^https://docs\.google\.com/forms/#', $loc) ? $loc : '';
		return array('link' => esc_url_raw($given), 'embed' => $full ? lcc_vbf_form_embed($full) : '');
	}
	if (preg_match('#^https://docs\.google\.com/forms/#', $given)) {
		$link = remove_query_arg('embedded', $given);
		return array('link' => esc_url_raw($link), 'embed' => lcc_vbf_form_embed($given));
	}
	return array('link' => esc_url_raw($given), 'embed' => '');
}

function lcc_vbf_form_embed($url) {
	$url = preg_replace('#/(viewform|formResponse)?(\?.*)?$#', '/viewform', strtok($url, '#'));
	return esc_url_raw(add_query_arg('embedded', 'true', $url));
}

