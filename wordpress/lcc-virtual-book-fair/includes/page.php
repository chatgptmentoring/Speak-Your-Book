<?php
/**
 * The fair as a page: a "Virtual Book Fair (full screen)" page template that replaces the theme
 * with the fair itself, served from this plugin's fair/ folder.
 */

if (!defined('ABSPATH')) {
	exit;
}

add_filter('theme_page_templates', function ($templates) {
	$templates[LCC_VBF_TEMPLATE] = 'Virtual Book Fair (full screen)';
	return $templates;
});

function lcc_vbf_is_fair_page($post) {
	$post = get_post($post);
	if (!$post || $post->post_type !== 'page') {
		return false;
	}
	$o = lcc_vbf_options();
	return get_page_template_slug($post) === LCC_VBF_TEMPLATE || ((int) $o['page_id'] && (int) $o['page_id'] === (int) $post->ID);
}

add_filter('template_include', function ($template) {
	if (is_page() && lcc_vbf_is_fair_page(get_queried_object()) && !post_password_required(get_queried_object())) {
		return LCC_VBF_DIR . 'templates/fair-page.php';
	}
	return $template;
}, 99);

/* Page optimisers must leave the fair's scripts alone: it loads them itself, in order. */
function lcc_vbf_no_optimising() {
	foreach (array('DONOTROCKETOPTIMIZE', 'DONOTMINIFY') as $flag) {
		if (!defined($flag)) {
			define($flag, true);
		}
	}
	add_filter('autoptimize_filter_noptimize', '__return_true');
	add_filter('perfmatters_delay_js', '__return_false');
	add_filter('rocket_delay_js_exclusions', function ($list) {
		$list[] = '/lcc-virtual-book-fair/';
		return $list;
	});
}

function lcc_vbf_render_page() {
	$html = @file_get_contents(LCC_VBF_DIR . 'fair/index.html'); // phpcs:ignore
	if (!$html) {
		wp_die('The fair\'s files are missing. Please install the Virtual Book Fair plugin again.', 'Virtual Book Fair', array('response' => 500));
	}
	lcc_vbf_no_optimising();

	$data     = lcc_vbf_data();
	$o        = lcc_vbf_options();
	$base     = LCC_VBF_URL . 'fair/';
	$ver      = rawurlencode($data['build']);
	$page_url = get_permalink(get_queried_object_id());
	$gh       = 'https://chatgptmentoring.github.io/Speak-Your-Book/';

	// addresses: the page's own, and the fair's files in this plugin
	$html = str_replace(array($gh . 'assets/', $gh), array($base . 'assets/', $page_url), $html);
	$html = preg_replace('#<script type="importmap">.*?</script>#s', lcc_vbf_importmap($base, $ver), $html, 1);
	$html = str_replace(
		array(
			'href="assets/css/style.css"',
			'<script src="assets/js/books.js"></script>',
			'<script type="module" src="assets/js/app.js"></script>',
		),
		array(
			'href="' . esc_url($base . 'assets/css/style.css?ver=' . $ver) . '"',
			'<script>window.FAIR_BASE = ' . wp_json_encode($base, JSON_UNESCAPED_SLASHES) . ';</script>'
				. "\n  " . '<script src="' . esc_url($base . 'assets/js/books.js?ver=' . $ver) . '"></script>'
				. "\n  " . lcc_vbf_config_script(),
			'<script type="module" src="' . esc_url($base . 'assets/js/app.js?ver=' . $ver) . '"></script>',
		),
		$html
	);
	$html = str_replace(array('src="assets/', 'href="assets/'), array('src="' . $base . 'assets/', 'href="' . $base . 'assets/'), $html);

	// the event as set in Settings > Virtual Book Fair, for search engines too
	$start = lcc_vbf_start_iso();
	if ($start && $data['event']['date']) {
		$html = str_replace('"startDate": "' . $data['event']['date'] . '"', '"startDate": "' . $start . '"', $html);
	}
	if ($o['register'] && $data['event']['register']) {
		$html = str_replace($data['event']['register'], esc_url_raw($o['register']), $html);
	}

	if (preg_match('/^G-[A-Z0-9]{4,20}$/', $o['ga'])) {
		$ga   = '<script async src="https://www.googletagmanager.com/gtag/js?id=' . $o['ga'] . '"></script>'
			. '<script>window.dataLayer = window.dataLayer || []; function gtag() { dataLayer.push(arguments); } gtag(\'js\', new Date()); gtag(\'config\', \'' . $o['ga'] . '\');</script>';
		$html = str_replace('</head>', $ga . "\n</head>", $html);
	}
	ob_start();
	do_action('lcc_vbf_head');
	$extra = ob_get_clean();
	if ($extra) {
		$html = str_replace('</head>', $extra . "\n</head>", $html);
	}

	// Cloudflare Rocket Loader and similar must not delay or reorder the fair's scripts
	$html = str_replace('<script', '<script data-cfasync="false" data-no-optimize="1" data-no-defer="1"', $html);

	status_header(200);
	header('Content-Type: text/html; charset=utf-8');
	echo $html; // phpcs:ignore WordPress.Security.EscapeOutput -- the fair's own page, with escaped settings
}

/*
 * three.js and the fair's modules, from this plugin. The fair's own modules get the build's
 * version, so an update reaches every visitor at once instead of waiting for browser caches.
 */
function lcc_vbf_importmap($base, $ver) {
	$imports = array(
		'three'         => $base . 'assets/vendor/three/three.module.min.js',
		'three/addons/' => $base . 'assets/vendor/three/addons/',
	);
	foreach (glob(LCC_VBF_DIR . 'fair/assets/js/*.js') ?: array() as $file) {
		$url           = $base . 'assets/js/' . basename($file);
		$imports[$url] = $url . '?ver=' . $ver;
	}
	return '<script type="importmap">' . wp_json_encode(array('imports' => $imports), JSON_UNESCAPED_SLASHES) . '</script>';
}

/* The settings from WordPress, applied on top of books.js before the fair starts. */
function lcc_vbf_config_script() {
	$o      = lcc_vbf_options();
	$data   = lcc_vbf_data();
	$start  = lcc_vbf_start_iso();
	$inbox  = array_keys(array_filter(lcc_vbf_inboxes()));
	$config = array(
		'event'    => array(
			'start'    => $start,
			'date'     => $start ? substr($o['start'], 0, 10) : '',
			'register' => $o['register'] ? esc_url_raw($o['register']) : '',
			'zoom'     => $o['zoom'] ? esc_url_raw($o['zoom']) : '',
			'stream'   => $o['stream'] ? esc_url_raw($o['stream']) : '',
			'schedule' => lcc_vbf_parse_schedule($o['schedule']),
		),
		'guide'    => lcc_vbf_openai_key() ? rest_url('lcc-fair/v1/guide') : '',
		'message'  => rest_url('lcc-fair/v1/message'),
		'inboxes'  => $inbox,
		'fallback' => is_email($o['fallback_inbox']) ? 1 : 0,
		'live'     => $o['live'] ? 1 : 0,
		'ga'       => preg_match('/^G-[A-Z0-9]{4,20}$/', $o['ga']) ? 1 : 0,
	);
	$json = wp_json_encode($config, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
	return <<<JS
<script>
  /* Settings > Virtual Book Fair */
  (function (o) {
    var e = window.FAIR_EVENT || {};
    if (o.event.start) { e.start = o.event.start; e.date = o.event.date; }
    if (o.event.register) e.register = o.event.register;
    e.stream = e.stream || {};
    if (o.event.zoom) e.stream.zoom = o.event.zoom;
    if (o.event.stream) e.stream.url = o.event.stream;
    if (o.event.schedule.length) e.schedule = o.event.schedule;
    window.FAIR_GUIDE = window.FAIR_GUIDE || {};
    window.FAIR_GUIDE.endpoint = o.guide;
    window.FAIR_LIVE = window.FAIR_LIVE || {};
    window.FAIR_LIVE.enabled = !!o.live;
    window.FAIR_CONTACT = window.FAIR_CONTACT || {};
    window.FAIR_CONTACT.via = 'site';
    window.FAIR_CONTACT.endpoint = o.message;
    window.FAIR_CONTACT.fallbackInbox = o.fallback ? 'site' : '';
    (window.FAIR_AUTHORS || []).forEach(function (a) { a.inbox = o.inboxes.indexOf(a.id) >= 0 ? 'site' : ''; });
    if (o.ga) window.FAIR_ANALYTICS = { enabled: true };
  })($json);
</script>
JS;
}
