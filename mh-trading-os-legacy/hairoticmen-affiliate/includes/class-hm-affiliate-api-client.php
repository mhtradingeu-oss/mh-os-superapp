<?php
/**
 * API Client for MH Trading OS Backend
 *
 * Handles all API communication with the MH Trading OS backend.
 *
 * @package Hairoticmen_Affiliate
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

class HM_Affiliate_API_Client {
    
    /**
     * The logger instance
     *
     * @var HM_Affiliate_Logger
     */
    private $logger;
    
    /**
     * The backend API URL
     *
     * @var string
     */
    private $backend_url;
    
    /**
     * The API secret key
     *
     * @var string
     */
    private $api_secret;
    
    /**
     * Request timeout in seconds
     *
     * @var int
     */
    private $timeout = 10;
    
    /**
     * Initialize the API client
     *
     * @since 1.0.0
     * @param HM_Affiliate_Logger $logger The logger instance
     */
    public function __construct($logger) {
        $this->logger = $logger;
        $this->backend_url = rtrim(get_option('hm_aff_backend_url', ''), '/');
        $this->api_secret = get_option('hm_aff_api_secret', '');
    }
    
    /**
     * Track an affiliate click
     *
     * @since 1.0.0
     * @param array $click_data Click tracking data
     * @return bool|WP_Error True on success, WP_Error on failure
     */
    public function track_click($click_data) {
        $endpoint = '/api/affiliate/track-click';
        return $this->send_request($endpoint, $click_data, 'track_click');
    }
    
    /**
     * Track an affiliate conversion
     *
     * @since 1.0.0
     * @param array $conversion_data Conversion tracking data
     * @return bool|WP_Error True on success, WP_Error on failure
     */
    public function track_conversion($conversion_data) {
        $endpoint = '/api/affiliate/track-conversion';
        return $this->send_request($endpoint, $conversion_data, 'track_conversion');
    }
    
    /**
     * Send a request to the backend API
     *
     * @since 1.0.0
     * @param string $endpoint The API endpoint
     * @param array $data The request payload
     * @param string $action The action name for logging
     * @return bool|WP_Error True on success, WP_Error on failure
     */
    private function send_request($endpoint, $data, $action) {
        // Validate configuration
        if (empty($this->backend_url)) {
            $this->logger->error("Backend URL not configured for {$action}");
            return new WP_Error('config_error', 'Backend URL not configured');
        }
        
        if (empty($this->api_secret)) {
            $this->logger->warning("API secret not configured for {$action}");
        }
        
        $url = $this->backend_url . $endpoint;
        
        // Prepare request
        $headers = array(
            'Content-Type' => 'application/json',
            'User-Agent' => 'Hairoticmen-Affiliate-WP/' . HM_AFF_VERSION,
        );
        
        // Add API secret to headers if configured
        if (!empty($this->api_secret)) {
            $headers['X-API-Secret'] = $this->api_secret;
        }
        
        $args = array(
            'method' => 'POST',
            'timeout' => $this->timeout,
            'headers' => $headers,
            'body' => wp_json_encode($data),
            'sslverify' => true, // Always verify SSL in production
        );
        
        $this->logger->debug("Sending {$action} request to: {$url}");
        $this->logger->debug("Request data: " . wp_json_encode($data));
        
        // Send request
        $response = wp_remote_post($url, $args);
        
        // Handle errors
        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();
            $this->logger->error("API request failed for {$action}: {$error_message}");
            return $response;
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        
        $this->logger->debug("Response code: {$response_code}");
        $this->logger->debug("Response body: {$response_body}");
        
        // Check response code
        if ($response_code < 200 || $response_code >= 300) {
            $this->logger->error("API returned error code {$response_code} for {$action}: {$response_body}");
            return new WP_Error('api_error', "API returned code {$response_code}", array('body' => $response_body));
        }
        
        // Parse response
        $response_data = json_decode($response_body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->logger->error("Invalid JSON response for {$action}: {$response_body}");
            return new WP_Error('json_error', 'Invalid JSON response');
        }
        
        $this->logger->info("Successfully sent {$action} to backend");
        
        return true;
    }
    
    /**
     * Test the API connection
     *
     * @since 1.0.0
     * @return array Result with success status and message
     */
    public function test_connection() {
        if (empty($this->backend_url)) {
            return array(
                'success' => false,
                'message' => 'Backend URL not configured',
            );
        }
        
        // Try to ping a health endpoint if it exists, or just verify the URL format
        $url = $this->backend_url . '/api/admin/health';
        
        $response = wp_remote_get($url, array(
            'timeout' => 5,
            'sslverify' => true,
        ));
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => 'Connection failed: ' . $response->get_error_message(),
            );
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        
        if ($response_code === 200) {
            return array(
                'success' => true,
                'message' => 'Connection successful',
            );
        }
        
        return array(
            'success' => false,
            'message' => "Backend responded with code {$response_code}",
        );
    }
}
