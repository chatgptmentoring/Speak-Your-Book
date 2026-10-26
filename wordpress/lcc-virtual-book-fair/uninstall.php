<?php
/**
 * Deleting the plugin removes its settings. The fair's page stays, as an ordinary page.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
	exit;
}

delete_option('lcc_vbf');
