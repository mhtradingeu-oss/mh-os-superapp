<?php
/**
 * Affiliate Tracker
 *
 * Handles click and conversion tracking.
 *
 * @package Hairoticmen_Affiliate
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

class HM_Affiliate_Tracker {
    
    /**
     * The API client instance
     *
     * @var HM_Affiliate_API_Client
     */
    private $api_client;
    
    /**
     * The logger instance
     *
     * @var HM_Affiliate_Logger
     */
    private $logger;
    
    /**
     * The cookie name for affiliate code
     *
     * @var string
     */
    private $cookie_name = 'hm_affiliate_code';
    
    /**
     * The URL parameter for affiliate code
     *
     * @var string
     */
    private $url_param = 'hm_aff';
    
    /**
     * Tracked conversions cache (prevent duplicate tracking)
     *
     * @var array
     */
    private static $tracked_orders = array();
    
    /**
     * Initialize the tracker
     *
     * @since 1.0.0
     * @param HM_Affiliate_API_Client $api_client The API client instance
     * @param HM_Affiliate_Logger $logger The logger instance
     */
    public function __construct($api_client, $logger) {
        $this->api_client = $api_client;
        $this->logger = $logger;
    }
    
    /**
     * Track affiliate click
     *
     * Runs on WordPress 'init' hook
     *
     * @since 1.0.0
     */
    public function track_click() {
        // Check if click tracking is enabled
        if (get_option('hm_aff_enable_click_tracking', '1') !== '1') {
            return;
        }
        
        // Check if affiliate code is in URL
        $affiliate_code = isset($_GET[$this->url_param]) ? sanitize_text_field($_GET[$this->url_param]) : '';
        
        if (empty($affiliate_code)) {
            return; // No affiliate code in URL
        }
        
        // Validate affiliate code format (alphanumeric, dashes, underscores)
        if (!preg_match('/^[a-zA-Z0-9_-]+$/', $affiliate_code)) {
            $this->logger->warning("Invalid affiliate code format: {$affiliate_code}");
            return;
        }
        
        $this->logger->debug("Detected affiliate code in URL: {$affiliate_code}");
        
        // Set cookie
        $cookie_lifetime = intval(get_option('hm_aff_cookie_lifetime', '30'));
        $expiry = time() + ($cookie_lifetime * 24 * 60 * 60);
        
        setcookie(
            $this->cookie_name,
            $affiliate_code,
            $expiry,
            '/',
            $this->get_cookie_domain(),
            is_ssl(),
            true // HttpOnly
        );
        
        // Prepare click data
        $click_data = array(
            'affiliateCode' => $affiliate_code,
            'landingUrl' => $this->get_current_url(),
            'referrer' => isset($_SERVER['HTTP_REFERER']) ? esc_url_raw($_SERVER['HTTP_REFERER']) : '',
            'userAgent' => isset($_SERVER['HTTP_USER_AGENT']) ? sanitize_text_field($_SERVER['HTTP_USER_AGENT']) : '',
            'deviceType' => $this->get_device_type(),
            'ip' => $this->get_anonymized_ip(),
            'timestamp' => current_time('mysql'),
            'source' => 'wordpress',
        );
        
        $this->logger->debug("Tracking click for affiliate: {$affiliate_code}");
        
        // Send to backend (async to not block page load)
        $this->send_tracking_async('click', $click_data);
    }
    
    /**
     * Track affiliate conversion
     *
     * Runs on WooCommerce order completion hooks
     *
     * @since 1.0.0
     * @param int $order_id The WooCommerce order ID
     */
    public function track_conversion($order_id) {
        // Check if conversion tracking is enabled
        if (get_option('hm_aff_enable_conversion_tracking', '1') !== '1') {
            return;
        }
        
        // Prevent duplicate tracking
        if (in_array($order_id, self::$tracked_orders)) {
            $this->logger->debug("Order {$order_id} already tracked, skipping");
            return;
        }
        
        // Check if we already tracked this order (via order meta)
        if (get_post_meta($order_id, '_hm_aff_tracked', true) === '1') {
            $this->logger->debug("Order {$order_id} already tracked (meta check), skipping");
            return;
        }
        
        // Get affiliate code from cookie
        $affiliate_code = isset($_COOKIE[$this->cookie_name]) ? sanitize_text_field($_COOKIE[$this->cookie_name]) : '';
        
        if (empty($affiliate_code)) {
            $this->logger->debug("No affiliate cookie found for order {$order_id}");
            return;
        }
        
        // Get WooCommerce order
        $order = wc_get_order($order_id);
        
        if (!$order) {
            $this->logger->error("Could not load order {$order_id}");
            return;
        }
        
        // Prepare order items
        $items = array();
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            $items[] = array(
                'id' => $product ? $product->get_id() : 0,
                'sku' => $product ? $product->get_sku() : '',
                'name' => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'price' => floatval($item->get_total()),
            );
        }
        
        // Prepare conversion data
        $conversion_data = array(
            'affiliateCode' => $affiliate_code,
            'orderId' => strval($order_id),
            'orderNumber' => $order->get_order_number(),
            'total' => floatval($order->get_total()),
            'subtotal' => floatval($order->get_subtotal()),
            'currency' => $order->get_currency(),
            'customerEmail' => $order->get_billing_email(),
            'customerName' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
            'items' => $items,
            'country' => $order->get_billing_country(),
            'state' => $order->get_billing_state(),
            'city' => $order->get_billing_city(),
            'timestamp' => current_time('mysql'),
            'source' => 'wordpress',
        );
        
        $this->logger->info("Tracking conversion for order {$order_id}, affiliate: {$affiliate_code}, total: {$order->get_total()}");
        
        // Mark as tracked in memory
        self::$tracked_orders[] = $order_id;
        
        // Mark as tracked in database
        update_post_meta($order_id, '_hm_aff_tracked', '1');
        update_post_meta($order_id, '_hm_aff_code', $affiliate_code);
        update_post_meta($order_id, '_hm_aff_tracked_at', current_time('mysql'));
        
        // Send to backend
        $result = $this->api_client->track_conversion($conversion_data);
        
        if (is_wp_error($result)) {
            $this->logger->error("Failed to track conversion for order {$order_id}: " . $result->get_error_message());
            // Don't unmark as tracked - we don't want to retry and potentially double-count
        } else {
            $this->logger->info("Successfully tracked conversion for order {$order_id}");
        }
    }
    
    /**
     * Send tracking data asynchronously (non-blocking)
     *
     * @since 1.0.0
     * @param string $type The tracking type (click or conversion)
     * @param array $data The tracking data
     */
    private function send_tracking_async($type, $data) {
        if ($type === 'click') {
            // Send click tracking in non-blocking mode
            $this->send_click_non_blocking($data);
        }
    }
    
    /**
     * Send click tracking in non-blocking mode
     *
     * @since 1.0.0
     * @param array $data The click data
     */
    private function send_click_non_blocking($data) {
        $backend_url = rtrim(get_option('hm_aff_backend_url', ''), '/');
        $api_secret = get_option('hm_aff_api_secret', '');
        
        if (empty($backend_url)) {
            return;
        }
        
        $url = $backend_url . '/api/affiliate/track-click';
        
        $headers = array(
            'Content-Type' => 'application/json',
            'User-Agent' => 'Hairoticmen-Affiliate-WP/' . HM_AFF_VERSION,
        );
        
        if (!empty($api_secret)) {
            $headers['X-API-Secret'] = $api_secret;
        }
        
        // Non-blocking request with very short timeout
        $args = array(
            'method' => 'POST',
            'timeout' => 0.5, // Very short timeout for non-blocking
            'blocking' => false, // Non-blocking - fire and forget
            'headers' => $headers,
            'body' => wp_json_encode($data),
            'sslverify' => true,
        );
        
        $this->logger->debug("Sending non-blocking click tracking to: {$url}");
        
        // Fire and forget
        wp_remote_post($url, $args);
    }
    
    /**
     * Get the current full URL
     *
     * @since 1.0.0
     * @return string The current URL
     */
    private function get_current_url() {
        $protocol = is_ssl() ? 'https://' : 'http://';
        $host = isset($_SERVER['HTTP_HOST']) ? sanitize_text_field($_SERVER['HTTP_HOST']) : '';
        $uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field($_SERVER['REQUEST_URI']) : '';
        return $protocol . $host . $uri;
    }
    
    /**
     * Get device type from user agent
     *
     * @since 1.0.0
     * @return string Device type (mobile, tablet, desktop)
     */
    private function get_device_type() {
        if (!isset($_SERVER['HTTP_USER_AGENT'])) {
            return 'unknown';
        }
        
        $user_agent = $_SERVER['HTTP_USER_AGENT'];
        
        // Check for mobile
        if (preg_match('/mobile|android|iphone|ipod|blackberry|iemobile/i', $user_agent)) {
            return 'mobile';
        }
        
        // Check for tablet
        if (preg_match('/tablet|ipad|playbook|silk/i', $user_agent)) {
            return 'tablet';
        }
        
        return 'desktop';
    }
    
    /**
     * Get anonymized IP address (GDPR compliant)
     *
     * @since 1.0.0
     * @return string Anonymized IP address
     */
    private function get_anonymized_ip() {
        if (!isset($_SERVER['REMOTE_ADDR'])) {
            return '';
        }
        
        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR']);
        
        // IPv4: Set last octet to 0
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            $parts[3] = '0';
            return implode('.', $parts);
        }
        
        // IPv6: Set last 80 bits to 0
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $parts = explode(':', $ip);
            for ($i = 4; $i < 8; $i++) {
                $parts[$i] = '0';
            }
            return implode(':', $parts);
        }
        
        return '';
    }
    
    /**
     * Get cookie domain
     *
     * @since 1.0.0
     * @return string Cookie domain
     */
    private function get_cookie_domain() {
        $domain = isset($_SERVER['HTTP_HOST']) ? sanitize_text_field($_SERVER['HTTP_HOST']) : '';
        
        // Remove port if present
        $domain = preg_replace('/:\d+$/', '', $domain);
        
        // For subdomains, use parent domain (e.g., .example.com instead of shop.example.com)
        $parts = explode('.', $domain);
        if (count($parts) > 2) {
            $domain = '.' . implode('.', array_slice($parts, -2));
        }
        
        return $domain;
    }
}
