<?php
/**
 * Settings > Virtual Book Fair: the fair's page, the live event, the AI guide, messages to
 * authors and visitors. Everything the fair needs to change on the day, without touching code.
 */

if (!defined('ABSPATH')) {
	exit;
}

add_action('admin_menu', function () {
	add_options_page('Virtual Book Fair', 'Virtual Book Fair', 'manage_options', 'lcc-virtual-book-fair', 'lcc_vbf_settings_page');
});

add_filter('plugin_action_links_' . LCC_VBF_BASENAME, function ($links) {
	array_unshift($links, '<a href="' . esc_url(admin_url('options-general.php?page=lcc-virtual-book-fair')) . '">Settings</a>');
	return $links;
});

add_action('admin_init', function () {
	register_setting('lcc_vbf', LCC_VBF_OPTION, array(
		'type'              => 'array',
		'sanitize_callback' => 'lcc_vbf_sanitize',
	));
});

function lcc_vbf_sanitize($in) {
	$old = lcc_vbf_options();
	$in  = is_array($in) ? $in : array();
	// saved from code (such as "Create the fair's page") rather than the form: keep everything else
	$from_form = !empty($in['_form']);
	if (!$from_form) {
		$in = array_merge($old, $in);
	}
	$str = function ($k) use ($in) {
		return isset($in[$k]) ? trim((string) wp_unslash($in[$k])) : '';
	};
	$url = function ($k, $label) use ($str) {
		$v = $str($k);
		if ($v !== '' && (!filter_var($v, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $v))) {
			add_settings_error(LCC_VBF_OPTION, 'lcc_vbf_' . $k, sprintf('%s does not look like a web address, so it was left empty.', $label));
			return '';
		}
		return esc_url_raw($v);
	};

	$start = $str('start');
	if ($start !== '' && !date_create_immutable_from_format('Y-m-d\TH:i', $start, wp_timezone())) {
		add_settings_error(LCC_VBF_OPTION, 'lcc_vbf_start', 'The start time could not be read, so it was left empty.');
		$start = '';
	}

	$schedule = sanitize_textarea_field($str('schedule'));
	lcc_vbf_parse_schedule($schedule, $problems);
	if ($problems) {
		add_settings_error(LCC_VBF_OPTION, 'lcc_vbf_schedule', 'These programme lines could not be read and are not shown (write them as "5:00 pm | Author name | Title", with the name as it appears in the fair, or "5:20 pm | Break"): ' . esc_html(implode(' / ', $problems)), 'warning');
	}

	// authors left out keep the address from the fair
	$inboxes = array();
	$given   = isset($in['inboxes']) && is_array($in['inboxes']) ? $in['inboxes'] : array();
	foreach (lcc_vbf_authors() as $id => $a) {
		if (!isset($given[$id])) {
			continue;
		}
		$email = sanitize_email(wp_unslash($given[$id]));
		if (trim($given[$id]) !== '' && !is_email($email)) {
			add_settings_error(LCC_VBF_OPTION, 'lcc_vbf_inbox_' . $id, sprintf('The email for %s does not look right, so it was left empty.', $a['name']));
			$email = '';
		}
		$inboxes[$id] = $email;
	}

	$key = $str('openai_key');
	if (!empty($in['forget_key'])) {
		$key = '';
	} elseif ($key === '') {
		$key = $old['openai_key']; // an empty field keeps the saved key, so it never has to be shown again
	}

	$ga = strtoupper($str('ga'));
	if ($ga !== '' && !preg_match('/^G-[A-Z0-9]{4,20}$/', $ga)) {
		add_settings_error(LCC_VBF_OPTION, 'lcc_vbf_ga', 'The Google Analytics ID should look like G-ABC123XYZ, so it was left empty.');
		$ga = '';
	}
	$fallback = sanitize_email($str('fallback_inbox'));
	$number   = function ($k) use ($str) {
		$d = lcc_vbf_defaults();
		return $str($k) === '' ? $d[$k] : max(1, (int) $str($k));
	};

	return array(
		'page_id'        => absint($str('page_id')),
		'start'          => $start,
		'register'       => $url('register', 'The registration link'),
		'zoom'           => $url('zoom', 'The Zoom link'),
		'stream'         => $url('stream', 'The live stream link'),
		'schedule'       => $schedule,
		'live'           => empty($in['live']) ? 0 : 1,
		'ga'             => $ga,
		'openai_key'     => sanitize_text_field($key),
		'model'          => sanitize_text_field($str('model') !== '' ? $str('model') : 'gpt-4o-mini'),
		'per_hour'       => $number('per_hour'),
		'per_day'        => $number('per_day'),
		'origins'        => sanitize_textarea_field($str('origins')),
		'inboxes'        => $inboxes,
		'fallback_inbox' => is_email($fallback) ? $fallback : '',
	);
}

/* ---------- one-click action: create the page ---------- */

add_action('admin_post_lcc_vbf_create_page', function () {
	if (!current_user_can('manage_options')) {
		wp_die('Sorry, you are not allowed to do that.');
	}
	check_admin_referer('lcc_vbf_create_page');
	$id = wp_insert_post(array(
		'post_type'    => 'page',
		'post_status'  => 'draft',
		'post_title'   => 'Virtual Book Fair',
		'post_name'    => 'virtual-book-fair',
		'post_content' => '<!-- wp:paragraph --><p>This page shows the Virtual Book Fair. Its settings are in Settings &gt; Virtual Book Fair.</p><!-- /wp:paragraph -->',
	), true);
	if (is_wp_error($id)) {
		lcc_vbf_back('page_failed');
	}
	update_post_meta($id, '_wp_page_template', LCC_VBF_TEMPLATE);
	$o            = get_option(LCC_VBF_OPTION, array());
	$o            = is_array($o) ? $o : array();
	$o['page_id'] = $id;
	update_option(LCC_VBF_OPTION, $o);
	lcc_vbf_back('page_created');
});

function lcc_vbf_back($notice) {
	wp_safe_redirect(add_query_arg('lcc-vbf', $notice, admin_url('options-general.php?page=lcc-virtual-book-fair')));
	exit;
}

/* ---------- notices ---------- */

add_action('admin_notices', function () {
	if (!current_user_can('manage_options')) {
		return;
	}
	$settings = admin_url('options-general.php?page=lcc-virtual-book-fair');
	if (get_transient('lcc_vbf_activated')) {
		delete_transient('lcc_vbf_activated');
		if (!lcc_vbf_page_id()) {
			echo '<div class="notice notice-success is-dismissible"><p><strong>The Virtual Book Fair is installed.</strong> Next: <a href="' . esc_url($settings) . '">create the fair\'s page</a> in Settings &gt; Virtual Book Fair.</p></div>';
		}
	}
	if (function_exists('lcc_fair_guide_answer')) {
		echo '<div class="notice notice-warning"><p><strong>Virtual Book Fair:</strong> the earlier <em>LCC Virtual Book Fair Guide</em> plugin is no longer needed, because the guide is now part of this plugin (its OpenAI key carries over). Please deactivate and delete it in <a href="' . esc_url(admin_url('plugins.php')) . '">Plugins</a>.</p></div>';
	}
});

/* ---------- the settings page ---------- */

function lcc_vbf_settings_page() {
	if (!current_user_can('manage_options')) {
		return;
	}
	$o        = lcc_vbf_options();
	$data     = lcc_vbf_data();
	$ev       = $data['event'];
	$authors  = lcc_vbf_authors();
	$inboxes  = lcc_vbf_inboxes();
	$page_id  = lcc_vbf_page_id();
	$key      = lcc_vbf_openai_key();
	$name     = function ($k) {
		return esc_attr(LCC_VBF_OPTION . '[' . $k . ']');
	};
	$notices  = array(
		'page_created' => array('success', 'The fair\'s page is ready as a draft. Preview it, then publish it when you are happy.'),
		'page_failed'  => array('error', 'The page could not be created. You can also add a page yourself and choose the template "Virtual Book Fair (full screen)".'),
	);
	$notice   = isset($_GET['lcc-vbf']) ? sanitize_key($_GET['lcc-vbf']) : ''; // phpcs:ignore WordPress.Security.NonceVerification
	$tz       = wp_timezone_string();
	$schedule_example = '';
	foreach (array_slice(array_values($authors), 0, 2) as $i => $a) {
		$schedule_example .= ($i ? "\n5:20 pm | Break | Lanterns and a breathing minute\n" : '') . ($i ? '5:30 pm' : '5:00 pm') . ' | ' . $a['name'] . ' | ' . (isset($a['books'][0]) ? $a['books'][0] : 'Talk title') . ($i ? '' : ' | 20');
	}
	?>
	<div class="wrap lcc-vbf">
		<style>
			.lcc-vbf .card { max-width: 920px; padding: 8px 24px 16px; }
			.lcc-vbf h2 { margin-top: 1.2em; }
			.lcc-vbf .lcc-vbf-status { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0; }
			.lcc-vbf .lcc-vbf-pill { display: inline-block; padding: 2px 10px; border-radius: 99px; background: #f0f0f1; font-weight: 600; }
			.lcc-vbf .lcc-vbf-pill.is-live { background: #d1f2d9; color: #0a5c1f; }
			.lcc-vbf .lcc-vbf-pill.is-draft { background: #fff3cd; color: #6b4e00; }
			.lcc-vbf .lcc-vbf-inboxes td, .lcc-vbf .lcc-vbf-inboxes th { padding: 6px 10px 6px 0; }
			.lcc-vbf textarea.code { font-size: 12px; }
		</style>
		<h1>Virtual Book Fair</h1>
		<?php if ($notice && isset($notices[$notice])) : ?>
			<div class="notice notice-<?php echo esc_attr($notices[$notice][0]); ?> is-dismissible"><p><?php echo esc_html($notices[$notice][1]); ?></p></div>
		<?php endif; ?>

		<div class="card">
			<h2>1. The fair's page</h2>
			<?php if ($page_id) :
				$status = get_post_status($page_id);
				?>
				<div class="lcc-vbf-status">
					<strong><?php echo esc_html(get_the_title($page_id)); ?></strong>
					<span class="lcc-vbf-pill <?php echo $status === 'publish' ? 'is-live' : 'is-draft'; ?>"><?php echo $status === 'publish' ? 'Live' : esc_html(ucfirst($status)); ?></span>
					<a class="button button-primary" href="<?php echo esc_url($status === 'publish' ? get_permalink($page_id) : get_preview_post_link($page_id)); ?>" target="_blank" rel="noopener"><?php echo $status === 'publish' ? 'Open the fair' : 'Preview the fair'; ?></a>
					<a class="button" href="<?php echo esc_url(get_edit_post_link($page_id)); ?>"><?php echo $status === 'publish' ? 'Edit page (title, address)' : 'Edit and publish'; ?></a>
				</div>
				<?php if ($status === 'publish') : ?>
					<p>The fair is live at <a href="<?php echo esc_url(get_permalink($page_id)); ?>" target="_blank" rel="noopener"><?php echo esc_html(get_permalink($page_id)); ?></a></p>
				<?php endif; ?>
			<?php else : ?>
				<p>The fair fills a whole page of this site, without the theme's header and footer.</p>
				<p><a class="button button-primary button-hero" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=lcc_vbf_create_page'), 'lcc_vbf_create_page')); ?>">Create the fair's page</a></p>
				<p class="description">Or add any page yourself and choose the template <strong>Virtual Book Fair (full screen)</strong> in the page's settings.</p>
			<?php endif; ?>
		</div>

		<form method="post" action="options.php">
			<?php settings_fields('lcc_vbf'); ?>
			<input type="hidden" name="<?php echo $name('_form'); ?>" value="1">
			<input type="hidden" name="<?php echo $name('page_id'); ?>" value="<?php echo esc_attr($o['page_id'] ? $o['page_id'] : $page_id); ?>">

			<div class="card">
				<h2>2. The live event</h2>
				<p>Leave a field empty to keep what the fair already shows.</p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="lcc-vbf-start">Start date and time</label></th>
						<td>
							<input id="lcc-vbf-start" type="datetime-local" name="<?php echo $name('start'); ?>" value="<?php echo esc_attr($o['start']); ?>">
							<p class="description">In this site's time zone (<?php echo esc_html($tz); ?>, see Settings &gt; General). Visitors see it in their own time zone, with a countdown to the minute. <?php echo $o['start'] ? '' : esc_html('Until it is set, the fair counts the days to ' . ($ev['date'] ? date_i18n('l j F', strtotime($ev['date'])) : 'the event') . '.'); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lcc-vbf-register">Registration link</label></th>
						<td><input id="lcc-vbf-register" type="url" class="large-text" name="<?php echo $name('register'); ?>" value="<?php echo esc_attr($o['register']); ?>" placeholder="<?php echo esc_attr($ev['register']); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="lcc-vbf-zoom">Zoom link</label></th>
						<td><input id="lcc-vbf-zoom" type="url" class="large-text" name="<?php echo $name('zoom'); ?>" value="<?php echo esc_attr($o['zoom']); ?>" placeholder="<?php echo esc_attr($ev['zoom']); ?>"><p class="description">The <em>Join on Zoom</em> buttons. On the day of the event it becomes the main button.</p></td>
					</tr>
					<tr>
						<th scope="row"><label for="lcc-vbf-stream">Live stream (YouTube or Vimeo)</label></th>
						<td>
							<input id="lcc-vbf-stream" type="url" class="large-text" name="<?php echo $name('stream'); ?>" value="<?php echo esc_attr($o['stream']); ?>" placeholder="https://www.youtube.com/watch?v=...">
							<p class="description">Visitors watch the talks in a window while they walk the fair. Zoom can't be shown inside a website, so stream the Zoom to YouTube Live (Zoom: Settings &gt; In Meeting (Advanced) &gt; Allow livestreaming, then More &gt; Live on YouTube) and paste the YouTube link here.</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lcc-vbf-schedule">Who speaks when</label></th>
						<td>
							<textarea id="lcc-vbf-schedule" class="large-text code" rows="5" name="<?php echo $name('schedule'); ?>" placeholder="<?php echo esc_attr($schedule_example); ?>"><?php echo esc_textarea($o['schedule']); ?></textarea>
							<p class="description">One line per talk or break: <code>time | author | title | minutes</code>, or <code>time | Break | title</code>. Times are in this site's time zone (<?php echo esc_html($tz); ?>) unless you add one, like <code>5:00 pm GMT</code>; minutes is optional (without it a talk lasts until the next line). Visitors see each time in their own time zone, can set reminders 30, 10 and 5 minutes before a talk, and between the talks the fair suggests things to do.</p>
						</td>
					</tr>
				</table>
			</div>

			<div class="card">
				<h2>3. The AI guide</h2>
				<p>The guide always answers on its own from the fair's content. With an OpenAI key it can hold real conversations. The key stays on this site; visitors never see it.</p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="lcc-vbf-key">OpenAI API key</label></th>
						<td>
							<?php if (defined('LCC_FAIR_OPENAI_KEY') && LCC_FAIR_OPENAI_KEY) : ?>
								<p><span class="lcc-vbf-pill is-live">Connected</span> The key is set in wp-config.php.</p>
							<?php else : ?>
								<input id="lcc-vbf-key" type="password" class="regular-text" name="<?php echo $name('openai_key'); ?>" value="" autocomplete="off" placeholder="<?php echo $key ? esc_attr('Saved (ends in ' . substr($key, -4) . '). Paste a new one to replace it.') : 'sk-...'; ?>">
								<?php if ($key) : ?>
									<p><span class="lcc-vbf-pill is-live">Connected</span> <label><input type="checkbox" name="<?php echo $name('forget_key'); ?>" value="1"> Remove the key (the guide goes back to its own answers)</label></p>
								<?php endif; ?>
								<p class="description">In your OpenAI account, set a monthly budget limit for this key's project.</p>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lcc-vbf-model">Model</label></th>
						<td><input id="lcc-vbf-model" type="text" class="regular-text" name="<?php echo $name('model'); ?>" value="<?php echo esc_attr($o['model']); ?>"><p class="description">A small, low-cost model is plenty, for example gpt-4o-mini.</p></td>
					</tr>
					<tr>
						<th scope="row">Limits</th>
						<td>
							<label>Questions per visitor per hour <input type="number" min="1" class="small-text" name="<?php echo $name('per_hour'); ?>" value="<?php echo esc_attr($o['per_hour']); ?>"></label><br>
							<label>Questions per day, for everyone <input type="number" min="1" class="small-text" name="<?php echo $name('per_day'); ?>" value="<?php echo esc_attr($o['per_day']); ?>"></label>
							<p class="description">Answered today: <?php echo (int) lcc_vbf_used_today('guide'); ?>. Past a limit the guide quietly answers on its own again.</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lcc-vbf-origins">Other fair addresses</label></th>
						<td><textarea id="lcc-vbf-origins" class="large-text code" rows="2" name="<?php echo $name('origins'); ?>"><?php echo esc_textarea($o['origins']); ?></textarea><p class="description">The fair on this site can always use the guide. Other copies of the fair allowed to use it, one address per line (for example the GitHub Pages copy). Its endpoint: <code><?php echo esc_html(rest_url('lcc-fair/v1/guide')); ?></code></p></td>
					</tr>
				</table>
			</div>

			<div class="card">
				<h2>4. Messages to authors</h2>
				<p>Each author's panel has a <em>Send a message</em> button. It opens a new email in Gmail (or the visitor's own email app), addressed to the author and already begun; the visitor sends it from their own email and the author simply replies. Visitors see the address they write to. Leave an address empty to hide the button for that author.</p>
				<table class="lcc-vbf-inboxes" role="presentation">
					<?php foreach ($authors as $id => $a) : ?>
						<tr>
							<th scope="row" style="text-align:left;font-weight:normal"><label for="lcc-vbf-inbox-<?php echo esc_attr($id); ?>"><?php echo esc_html($a['name']); ?></label></th>
							<td><input id="lcc-vbf-inbox-<?php echo esc_attr($id); ?>" type="email" class="regular-text" name="<?php echo esc_attr(LCC_VBF_OPTION . '[inboxes][' . $id . ']'); ?>" value="<?php echo esc_attr($inboxes[$id]); ?>"></td>
						</tr>
					<?php endforeach; ?>
				</table>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="lcc-vbf-fallback">For authors without an address</label></th>
						<td><input id="lcc-vbf-fallback" type="email" class="regular-text" name="<?php echo $name('fallback_inbox'); ?>" value="<?php echo esc_attr($o['fallback_inbox']); ?>" placeholder="optional"><p class="description">If set, those authors get the button too, and their messages come to this address for Life Coach Code to pass along.</p></td>
					</tr>
				</table>
			</div>

			<div class="card">
				<h2>5. Visitors</h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row">Live presence</th>
						<td><label><input type="checkbox" name="<?php echo $name('live'); ?>" value="1" <?php checked($o['live']); ?>> Visitors see each other in the fair, wave and send reactions</label><p class="description">Only a first name, a colour and a position are shared, through a public relay; nothing is stored. Authors appear in gold through their private links.</p></td>
					</tr>
					<tr>
						<th scope="row"><label for="lcc-vbf-ga">Google Analytics</label></th>
						<td><input id="lcc-vbf-ga" type="text" class="regular-text" name="<?php echo $name('ga'); ?>" value="<?php echo esc_attr($o['ga']); ?>" placeholder="G-XXXXXXXXXX"><p class="description">Optional. The fair page doesn't use the theme, so the site's usual tracking doesn't run there. With an ID, page views and the fair's actions (booths opened, Amazon and registration clicks, messages) are recorded.</p></td>
					</tr>
				</table>
			</div>

			<?php submit_button('Save the fair\'s settings'); ?>
			<p class="description">If this site uses a page cache, it is cleared for the fair's page when you save. If visitors still see the old version, purge the cache in your host's or cache plugin's settings.</p>
		</form>
	</div>
	<?php
}
