<?php
/**
 * Admin Settings Page
 *
 * Handles the WordPress admin settings page for plugin configuration.
 *
 * @package Hairoticmen_Affiliate
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

class HM_Affiliate_Admin_Settings {
    
    /**
     * Settings page slug
     *
     * @var string
     */
    private $page_slug = 'hairoticmen-affiliate';
    
    /**
     * Settings option group
     *
     * @var string
     */
    private $option_group = 'hm_aff_settings';
    
    /**
     * Initialize the admin settings
     *
     * @since 1.0.0
     */
    public function __construct() {
        // Constructor can be empty since hooks are registered in the loader
    }
    
    /**
     * Add settings page to WordPress admin menu
     *
     * @since 1.0.0
     */
    public function add_settings_page() {
        add_options_page(
            esc_html__('Hairoticmen Affiliate Settings', 'hairoticmen-affiliate'),
            esc_html__('Hairoticmen Affiliate', 'hairoticmen-affiliate'),
            'manage_options',
            $this->page_slug,
            array($this, 'render_settings_page')
        );
    }
    
    /**
     * Register plugin settings
     *
     * @since 1.0.0
     */
    public function register_settings() {
        // Register settings
        $settings = array(
            'hm_aff_backend_url',
            'hm_aff_api_secret',
            'hm_aff_enable_click_tracking',
            'hm_aff_enable_conversion_tracking',
            'hm_aff_cookie_lifetime',
            'hm_aff_debug_log',
        );
        
        foreach ($settings as $setting) {
            register_setting(
                $this->option_group,
                $setting,
                array($this, 'sanitize_' . str_replace('hm_aff_', '', $setting))
            );
        }
        
        // Add settings sections
        add_settings_section(
            'hm_aff_api_section',
            esc_html__('API Configuration', 'hairoticmen-affiliate'),
            array($this, 'render_api_section'),
            $this->page_slug
        );
        
        add_settings_section(
            'hm_aff_tracking_section',
            esc_html__('Tracking Settings', 'hairoticmen-affiliate'),
            array($this, 'render_tracking_section'),
            $this->page_slug
        );
        
        add_settings_section(
            'hm_aff_advanced_section',
            esc_html__('Advanced Settings', 'hairoticmen-affiliate'),
            array($this, 'render_advanced_section'),
            $this->page_slug
        );
        
        // Add settings fields
        add_settings_field(
            'hm_aff_backend_url',
            esc_html__('Backend API URL', 'hairoticmen-affiliate'),
            array($this, 'render_backend_url_field'),
            $this->page_slug,
            'hm_aff_api_section'
        );
        
        add_settings_field(
            'hm_aff_api_secret',
            esc_html__('API Secret Key', 'hairoticmen-affiliate'),
            array($this, 'render_api_secret_field'),
            $this->page_slug,
            'hm_aff_api_section'
        );
        
        add_settings_field(
            'hm_aff_enable_click_tracking',
            esc_html__('Enable Click Tracking', 'hairoticmen-affiliate'),
            array($this, 'render_enable_click_tracking_field'),
            $this->page_slug,
            'hm_aff_tracking_section'
        );
        
        add_settings_field(
            'hm_aff_enable_conversion_tracking',
            esc_html__('Enable Conversion Tracking', 'hairoticmen-affiliate'),
            array($this, 'render_enable_conversion_tracking_field'),
            $this->page_slug,
            'hm_aff_tracking_section'
        );
        
        add_settings_field(
            'hm_aff_cookie_lifetime',
            esc_html__('Cookie Lifetime (days)', 'hairoticmen-affiliate'),
            array($this, 'render_cookie_lifetime_field'),
            $this->page_slug,
            'hm_aff_tracking_section'
        );
        
        add_settings_field(
            'hm_aff_debug_log',
            esc_html__('Enable Debug Logging', 'hairoticmen-affiliate'),
            array($this, 'render_debug_log_field'),
            $this->page_slug,
            'hm_aff_advanced_section'
        );
    }
    
    /**
     * Render the settings page
     *
     * @since 1.0.0
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions to access this page.', 'hairoticmen-affiliate'));
        }
        
        ?>
        <div class="wrap hm-affiliate-settings">
            <h1>
                <?php echo esc_html(get_admin_page_title()); ?>
                <span class="hm-aff-version">v<?php echo esc_html(HM_AFF_VERSION); ?></span>
            </h1>
            
            <?php settings_errors(); ?>
            
            <div class="hm-aff-settings-header">
                <p><?php esc_html_e('Configure the Hairoticmen Affiliate Integration plugin to track affiliate clicks and conversions.', 'hairoticmen-affiliate'); ?></p>
                <p><strong><?php esc_html_e('Note:', 'hairoticmen-affiliate'); ?></strong> <?php esc_html_e('This plugin integrates with the MH Trading OS backend. Make sure your backend is running and accessible.', 'hairoticmen-affiliate'); ?></p>
            </div>
            
            <?php $this->render_status_box(); ?>
            
            <form method="post" action="options.php" class="hm-aff-settings-form">
                <?php
                settings_fields($this->option_group);
                do_settings_sections($this->page_slug);
                submit_button();
                ?>
            </form>
            
            <?php $this->render_test_connection_box(); ?>
            
            <?php $this->render_usage_instructions(); ?>
        </div>
        <?php
    }
    
    /**
     * Render status box
     *
     * @since 1.0.0
     */
    private function render_status_box() {
        $backend_url = get_option('hm_aff_backend_url', '');
        $api_secret = get_option('hm_aff_api_secret', '');
        $click_tracking = get_option('hm_aff_enable_click_tracking', '1') === '1';
        $conversion_tracking = get_option('hm_aff_enable_conversion_tracking', '1') === '1';
        
        $is_configured = !empty($backend_url) && !empty($api_secret);
        
        ?>
        <div class="notice notice-<?php echo $is_configured ? 'success' : 'warning'; ?> inline">
            <h3><?php esc_html_e('Plugin Status', 'hairoticmen-affiliate'); ?></h3>
            <ul>
                <li>
                    <span class="dashicons dashicons-<?php echo !empty($backend_url) ? 'yes-alt' : 'warning'; ?>"></span>
                    <?php esc_html_e('Backend URL:', 'hairoticmen-affiliate'); ?>
                    <strong><?php echo !empty($backend_url) ? esc_html__('Configured', 'hairoticmen-affiliate') : esc_html__('Not Configured', 'hairoticmen-affiliate'); ?></strong>
                </li>
                <li>
                    <span class="dashicons dashicons-<?php echo !empty($api_secret) ? 'yes-alt' : 'warning'; ?>"></span>
                    <?php esc_html_e('API Secret:', 'hairoticmen-affiliate'); ?>
                    <strong><?php echo !empty($api_secret) ? esc_html__('Configured', 'hairoticmen-affiliate') : esc_html__('Not Configured', 'hairoticmen-affiliate'); ?></strong>
                </li>
                <li>
                    <span class="dashicons dashicons-<?php echo $click_tracking ? 'yes-alt' : 'dismiss'; ?>"></span>
                    <?php esc_html_e('Click Tracking:', 'hairoticmen-affiliate'); ?>
                    <strong><?php echo $click_tracking ? esc_html__('Enabled', 'hairoticmen-affiliate') : esc_html__('Disabled', 'hairoticmen-affiliate'); ?></strong>
                </li>
                <li>
                    <span class="dashicons dashicons-<?php echo $conversion_tracking ? 'yes-alt' : 'dismiss'; ?>"></span>
                    <?php esc_html_e('Conversion Tracking:', 'hairoticmen-affiliate'); ?>
                    <strong><?php echo $conversion_tracking ? esc_html__('Enabled', 'hairoticmen-affiliate') : esc_html__('Disabled', 'hairoticmen-affiliate'); ?></strong>
                </li>
            </ul>
        </div>
        <?php
    }
    
    /**
     * Render test connection box
     *
     * @since 1.0.0
     */
    private function render_test_connection_box() {
        ?>
        <div class="hm-aff-test-connection">
            <h2><?php esc_html_e('Test Connection', 'hairoticmen-affiliate'); ?></h2>
            <p><?php esc_html_e('Click the button below to test the connection to your MH Trading OS backend.', 'hairoticmen-affiliate'); ?></p>
            <button type="button" id="hm-aff-test-connection-btn" class="button button-secondary">
                <?php esc_html_e('Test API Connection', 'hairoticmen-affiliate'); ?>
            </button>
            <div id="hm-aff-test-result" style="margin-top: 10px;"></div>
        </div>
        <?php
    }
    
    /**
     * Render usage instructions
     *
     * @since 1.0.0
     */
    private function render_usage_instructions() {
        $site_url = get_site_url();
        ?>
        <div class="hm-aff-usage-instructions">
            <h2><?php esc_html_e('Usage Instructions', 'hairoticmen-affiliate'); ?></h2>
            
            <h3><?php esc_html_e('1. Affiliate Links', 'hairoticmen-affiliate'); ?></h3>
            <p><?php esc_html_e('Affiliates should use URLs with the affiliate code parameter:', 'hairoticmen-affiliate'); ?></p>
            <code><?php echo esc_url($site_url); ?>?hm_aff=AFFILIATE_CODE</code>
            <p><?php esc_html_e('Example:', 'hairoticmen-affiliate'); ?></p>
            <code><?php echo esc_url($site_url); ?>/shop/?hm_aff=JOHN123</code>
            
            <h3><?php esc_html_e('2. Tracking Flow', 'hairoticmen-affiliate'); ?></h3>
            <ol>
                <li><?php esc_html_e('Customer clicks affiliate link with ?hm_aff=CODE parameter', 'hairoticmen-affiliate'); ?></li>
                <li><?php esc_html_e('Plugin stores affiliate code in a cookie (30 days default)', 'hairoticmen-affiliate'); ?></li>
                <li><?php esc_html_e('Click event is sent to MH Trading OS backend', 'hairoticmen-affiliate'); ?></li>
                <li><?php esc_html_e('When customer completes an order, conversion is tracked', 'hairoticmen-affiliate'); ?></li>
                <li><?php esc_html_e('Conversion data (order total, items, etc.) is sent to backend', 'hairoticmen-affiliate'); ?></li>
            </ol>
            
            <h3><?php esc_html_e('3. Backend Integration', 'hairoticmen-affiliate'); ?></h3>
            <p><?php esc_html_e('This plugin sends data to two endpoints:', 'hairoticmen-affiliate'); ?></p>
            <ul>
                <li><code>POST /api/affiliate/track-click</code></li>
                <li><code>POST /api/affiliate/track-conversion</code></li>
            </ul>
            <p><?php esc_html_e('Make sure these endpoints are available in your MH Trading OS backend.', 'hairoticmen-affiliate'); ?></p>
        </div>
        <?php
    }
    
    // Section render callbacks
    public function render_api_section() {
        echo '<p>' . esc_html__('Configure the connection to your MH Trading OS backend API.', 'hairoticmen-affiliate') . '</p>';
    }
    
    public function render_tracking_section() {
        echo '<p>' . esc_html__('Configure click and conversion tracking settings.', 'hairoticmen-affiliate') . '</p>';
    }
    
    public function render_advanced_section() {
        echo '<p>' . esc_html__('Advanced settings for debugging and troubleshooting.', 'hairoticmen-affiliate') . '</p>';
    }
    
    // Field render callbacks
    public function render_backend_url_field() {
        $value = get_option('hm_aff_backend_url', '');
        ?>
        <input type="url" 
               name="hm_aff_backend_url" 
               id="hm_aff_backend_url" 
               value="<?php echo esc_attr($value); ?>" 
               class="regular-text"
               placeholder="https://your-replit-app.replit.dev">
        <p class="description">
            <?php esc_html_e('The full URL to your MH Trading OS backend (without trailing slash).', 'hairoticmen-affiliate'); ?>
            <br><strong><?php esc_html_e('Example:', 'hairoticmen-affiliate'); ?></strong> https://your-app.replit.dev
        </p>
        <?php
    }
    
    public function render_api_secret_field() {
        $value = get_option('hm_aff_api_secret', '');
        ?>
        <input type="password" 
               name="hm_aff_api_secret" 
               id="hm_aff_api_secret" 
               value="<?php echo esc_attr($value); ?>" 
               class="regular-text"
               autocomplete="off">
        <p class="description">
            <?php esc_html_e('The API secret key for authenticating with your backend. This is sent in the X-API-Secret header.', 'hairoticmen-affiliate'); ?>
        </p>
        <?php
    }
    
    public function render_enable_click_tracking_field() {
        $value = get_option('hm_aff_enable_click_tracking', '1');
        ?>
        <label>
            <input type="checkbox" 
                   name="hm_aff_enable_click_tracking" 
                   id="hm_aff_enable_click_tracking" 
                   value="1" 
                   <?php checked($value, '1'); ?>>
            <?php esc_html_e('Track affiliate clicks', 'hairoticmen-affiliate'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('Enable tracking of affiliate clicks via URL parameter (?hm_aff=CODE).', 'hairoticmen-affiliate'); ?>
        </p>
        <?php
    }
    
    public function render_enable_conversion_tracking_field() {
        $value = get_option('hm_aff_enable_conversion_tracking', '1');
        ?>
        <label>
            <input type="checkbox" 
                   name="hm_aff_enable_conversion_tracking" 
                   id="hm_aff_enable_conversion_tracking" 
                   value="1" 
                   <?php checked($value, '1'); ?>>
            <?php esc_html_e('Track order conversions', 'hairoticmen-affiliate'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('Enable tracking of WooCommerce order completions as conversions.', 'hairoticmen-affiliate'); ?>
        </p>
        <?php
    }
    
    public function render_cookie_lifetime_field() {
        $value = get_option('hm_aff_cookie_lifetime', '30');
        ?>
        <input type="number" 
               name="hm_aff_cookie_lifetime" 
               id="hm_aff_cookie_lifetime" 
               value="<?php echo esc_attr($value); ?>" 
               min="1" 
               max="365" 
               class="small-text">
        <span><?php esc_html_e('days', 'hairoticmen-affiliate'); ?></span>
        <p class="description">
            <?php esc_html_e('How long to store the affiliate code in the customer\'s browser (1-365 days).', 'hairoticmen-affiliate'); ?>
        </p>
        <?php
    }
    
    public function render_debug_log_field() {
        $value = get_option('hm_aff_debug_log', '0');
        ?>
        <label>
            <input type="checkbox" 
                   name="hm_aff_debug_log" 
                   id="hm_aff_debug_log" 
                   value="1" 
                   <?php checked($value, '1'); ?>>
            <?php esc_html_e('Enable debug logging', 'hairoticmen-affiliate'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('Enable detailed logging for debugging. Logs are stored in wp-content/uploads/hm-affiliate-logs/', 'hairoticmen-affiliate'); ?>
            <br><strong><?php esc_html_e('Warning:', 'hairoticmen-affiliate'); ?></strong> <?php esc_html_e('Only enable this for troubleshooting as it may affect performance.', 'hairoticmen-affiliate'); ?>
        </p>
        <?php
    }
    
    // Sanitization callbacks
    public function sanitize_backend_url($value) {
        return esc_url_raw(rtrim($value, '/'));
    }
    
    public function sanitize_api_secret($value) {
        return sanitize_text_field($value);
    }
    
    public function sanitize_enable_click_tracking($value) {
        return $value === '1' ? '1' : '0';
    }
    
    public function sanitize_enable_conversion_tracking($value) {
        return $value === '1' ? '1' : '0';
    }
    
    public function sanitize_cookie_lifetime($value) {
        $value = intval($value);
        return max(1, min(365, $value));
    }
    
    public function sanitize_debug_log($value) {
        return $value === '1' ? '1' : '0';
    }
}
