<?php
/**
 * Core plugin loader class
 *
 * Orchestrates all plugin components and initializes hooks.
 *
 * @package Hairoticmen_Affiliate
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

class HM_Affiliate_Loader {
    
    /**
     * The logger instance
     *
     * @var HM_Affiliate_Logger
     */
    protected $logger;
    
    /**
     * The API client instance
     *
     * @var HM_Affiliate_API_Client
     */
    protected $api_client;
    
    /**
     * The tracker instance
     *
     * @var HM_Affiliate_Tracker
     */
    protected $tracker;
    
    /**
     * The admin settings instance
     *
     * @var HM_Affiliate_Admin_Settings
     */
    protected $admin_settings;
    
    /**
     * Initialize the collections used to maintain the actions and filters.
     *
     * @since 1.0.0
     */
    public function __construct() {
        $this->load_dependencies();
        $this->define_admin_hooks();
        $this->define_public_hooks();
    }
    
    /**
     * Load the required dependencies for this plugin.
     *
     * @since 1.0.0
     * @access private
     */
    private function load_dependencies() {
        // Initialize core components
        $this->logger = new HM_Affiliate_Logger();
        $this->api_client = new HM_Affiliate_API_Client($this->logger);
        $this->tracker = new HM_Affiliate_Tracker($this->api_client, $this->logger);
        $this->admin_settings = new HM_Affiliate_Admin_Settings();
    }
    
    /**
     * Register all of the hooks related to the admin area functionality.
     *
     * @since 1.0.0
     * @access private
     */
    private function define_admin_hooks() {
        // Admin settings page
        add_action('admin_menu', array($this->admin_settings, 'add_settings_page'));
        add_action('admin_init', array($this->admin_settings, 'register_settings'));
        
        // Admin assets
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));
        
        // Add settings link on plugins page
        add_filter('plugin_action_links_' . HM_AFF_PLUGIN_BASENAME, array($this, 'add_settings_link'));
    }
    
    /**
     * Register all of the hooks related to the public-facing functionality.
     *
     * @since 1.0.0
     * @access private
     */
    private function define_public_hooks() {
        // Click tracking on init
        add_action('init', array($this->tracker, 'track_click'));
        
        // Conversion tracking on order completion
        add_action('woocommerce_payment_complete', array($this->tracker, 'track_conversion'), 10, 1);
        add_action('woocommerce_order_status_completed', array($this->tracker, 'track_conversion'), 10, 1);
        
        // Also track when order status changes to processing (for some payment methods)
        add_action('woocommerce_order_status_processing', array($this->tracker, 'track_conversion'), 10, 1);
    }
    
    /**
     * Enqueue admin assets
     *
     * @since 1.0.0
     * @param string $hook The current admin page hook
     */
    public function enqueue_admin_assets($hook) {
        // Only load on our settings page
        if ($hook !== 'settings_page_hairoticmen-affiliate') {
            return;
        }
        
        wp_enqueue_style(
            'hm-affiliate-admin',
            HM_AFF_PLUGIN_URL . 'assets/admin.css',
            array(),
            HM_AFF_VERSION
        );
        
        wp_enqueue_script(
            'hm-affiliate-admin',
            HM_AFF_PLUGIN_URL . 'assets/admin.js',
            array('jquery'),
            HM_AFF_VERSION,
            true
        );
    }
    
    /**
     * Add settings link on plugin page
     *
     * @since 1.0.0
     * @param array $links Existing plugin links
     * @return array Modified links
     */
    public function add_settings_link($links) {
        $settings_link = '<a href="' . admin_url('options-general.php?page=hairoticmen-affiliate') . '">' . 
                         esc_html__('Settings', 'hairoticmen-affiliate') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
    }
    
    /**
     * Run the loader to execute all hooks.
     *
     * @since 1.0.0
     */
    public function run() {
        // Plugin is now loaded and all hooks are registered
        $this->logger->log('Hairoticmen Affiliate plugin initialized', 'info');
    }
}
