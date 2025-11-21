<?php
/**
 * Plugin Name: Hairoticmen Affiliate Integration
 * Plugin URI: https://hairoticmen.de
 * Description: Production-grade affiliate tracking plugin for WooCommerce. Tracks clicks and conversions, syncs with MH Trading OS backend and Affiliate Intelligence System.
 * Version: 1.0.0
 * Author: MH Trading
 * Author URI: https://hairoticmen.de
 * Text Domain: hairoticmen-affiliate
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 8.5
 * License: GPLv2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

/**
 * Currently plugin version.
 * Start at version 1.0.0
 */
define('HM_AFF_VERSION', '1.0.0');
define('HM_AFF_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('HM_AFF_PLUGIN_URL', plugin_dir_url(__FILE__));
define('HM_AFF_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * The code that runs during plugin activation.
 */
function activate_hm_affiliate() {
    // Set default options on activation
    $defaults = array(
        'hm_aff_backend_url' => 'https://your-replit-app.replit.dev',
        'hm_aff_api_secret' => '',
        'hm_aff_enable_click_tracking' => '1',
        'hm_aff_enable_conversion_tracking' => '1',
        'hm_aff_cookie_lifetime' => '30',
        'hm_aff_debug_log' => '0',
    );
    
    foreach ($defaults as $key => $value) {
        if (get_option($key) === false) {
            add_option($key, $value);
        }
    }
    
    // Create log directory
    $upload_dir = wp_upload_dir();
    $log_dir = $upload_dir['basedir'] . '/hm-affiliate-logs';
    if (!file_exists($log_dir)) {
        wp_mkdir_p($log_dir);
        // Add .htaccess to protect log files
        $htaccess = $log_dir . '/.htaccess';
        if (!file_exists($htaccess)) {
            file_put_contents($htaccess, 'Deny from all');
        }
    }
}

/**
 * The code that runs during plugin deactivation.
 */
function deactivate_hm_affiliate() {
    // Clear any scheduled events if we add them in the future
    wp_clear_scheduled_hook('hm_aff_daily_cleanup');
}

register_activation_hook(__FILE__, 'activate_hm_affiliate');
register_deactivation_hook(__FILE__, 'deactivate_hm_affiliate');

/**
 * Load plugin core classes
 */
require_once HM_AFF_PLUGIN_DIR . 'includes/class-hm-affiliate-logger.php';
require_once HM_AFF_PLUGIN_DIR . 'includes/class-hm-affiliate-api-client.php';
require_once HM_AFF_PLUGIN_DIR . 'includes/class-hm-affiliate-tracker.php';
require_once HM_AFF_PLUGIN_DIR . 'includes/class-hm-affiliate-admin-settings.php';
require_once HM_AFF_PLUGIN_DIR . 'includes/class-hm-affiliate-loader.php';

/**
 * Begins execution of the plugin.
 *
 * @since 1.0.0
 */
function run_hm_affiliate() {
    $plugin = new HM_Affiliate_Loader();
    $plugin->run();
}

/**
 * AJAX handler for connection test
 *
 * @since 1.0.0
 */
function hm_aff_ajax_test_connection() {
    // Verify nonce for CSRF protection
    check_ajax_referer('hm_aff_admin_nonce', 'nonce');
    
    // Verify user capabilities
    if (!current_user_can('manage_options')) {
        wp_send_json_error(array('message' => 'Unauthorized'));
        return;
    }
    
    // Get parameters
    $backend_url = isset($_POST['backend_url']) ? sanitize_text_field($_POST['backend_url']) : '';
    $api_secret = isset($_POST['api_secret']) ? sanitize_text_field($_POST['api_secret']) : '';
    
    if (empty($backend_url)) {
        wp_send_json_error(array('message' => 'Backend URL is required'));
        return;
    }
    
    // Test connection
    $logger = new HM_Affiliate_Logger();
    $test_api_client = new HM_Affiliate_API_Client($logger);
    
    // Temporarily update options for testing
    $old_url = get_option('hm_aff_backend_url');
    $old_secret = get_option('hm_aff_api_secret');
    
    update_option('hm_aff_backend_url', $backend_url);
    update_option('hm_aff_api_secret', $api_secret);
    
    // Perform test
    $result = $test_api_client->test_connection();
    
    // Restore old values
    update_option('hm_aff_backend_url', $old_url);
    update_option('hm_aff_api_secret', $old_secret);
    
    // Return result
    if ($result['success']) {
        wp_send_json_success($result);
    } else {
        wp_send_json_error($result);
    }
}

add_action('wp_ajax_hm_aff_test_connection', 'hm_aff_ajax_test_connection');

/**
 * Enqueue admin scripts with nonce
 *
 * @since 1.0.0
 */
function hm_aff_admin_scripts($hook) {
    if ($hook !== 'settings_page_hairoticmen-affiliate') {
        return;
    }
    
    wp_localize_script('hm-affiliate-admin', 'hmAffAdminNonce', wp_create_nonce('hm_aff_admin_nonce'));
}

add_action('admin_enqueue_scripts', 'hm_aff_admin_scripts', 20);

// Check if WooCommerce is active
if (in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')))) {
    run_hm_affiliate();
} else {
    // Show admin notice if WooCommerce is not active
    add_action('admin_notices', function() {
        ?>
        <div class="notice notice-error">
            <p><?php esc_html_e('Hairoticmen Affiliate Integration requires WooCommerce to be installed and active.', 'hairoticmen-affiliate'); ?></p>
        </div>
        <?php
    });
}
