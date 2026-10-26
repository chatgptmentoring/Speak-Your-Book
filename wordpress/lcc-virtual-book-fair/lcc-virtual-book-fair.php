<?php
/**
 * Plugin Name: LCC Virtual Book Fair
 * Description: The Virtual Book Fair of Life Coach Code as a full-screen page on this site, with its AI guide, the live event's programme and messages to the authors. Set it up in Settings > Virtual Book Fair.
 * Version: 1.2.0
 * Author: Life Coach Code
 * Author URI: https://www.lifecoachcode.com
 * License: GPL-2.0-or-later
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
	exit;
}

define('LCC_VBF_VERSION', '1.2.0');
define('LCC_VBF_DIR', plugin_dir_path(__FILE__));
define('LCC_VBF_URL', plugin_dir_url(__FILE__));
define('LCC_VBF_BASENAME', plugin_basename(__FILE__));
const LCC_VBF_OPTION   = 'lcc_vbf';
const LCC_VBF_TEMPLATE = 'lcc-virtual-book-fair';

require_once LCC_VBF_DIR . 'includes/core.php';
require_once LCC_VBF_DIR . 'includes/page.php';
require_once LCC_VBF_DIR . 'includes/guide.php';
if (is_admin()) {
	require_once LCC_VBF_DIR . 'includes/admin.php';
}

register_activation_hook(__FILE__, function () {
	set_transient('lcc_vbf_activated', 1, MINUTE_IN_SECONDS * 10);
});
