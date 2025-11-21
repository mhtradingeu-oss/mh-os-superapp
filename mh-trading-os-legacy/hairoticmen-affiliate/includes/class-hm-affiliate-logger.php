<?php
/**
 * Logger class for debugging and tracking
 *
 * Handles file-based logging with severity levels.
 *
 * @package Hairoticmen_Affiliate
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

class HM_Affiliate_Logger {
    
    /**
     * The log file path
     *
     * @var string
     */
    private $log_file;
    
    /**
     * Whether debug logging is enabled
     *
     * @var bool
     */
    private $debug_enabled;
    
    /**
     * Initialize the logger
     *
     * @since 1.0.0
     */
    public function __construct() {
        $upload_dir = wp_upload_dir();
        $log_dir = $upload_dir['basedir'] . '/hm-affiliate-logs';
        $this->log_file = $log_dir . '/hm-affiliate-' . date('Y-m-d') . '.log';
        $this->debug_enabled = get_option('hm_aff_debug_log', '0') === '1';
    }
    
    /**
     * Log a message
     *
     * @since 1.0.0
     * @param string $message The message to log
     * @param string $severity The severity level (info, warning, error, debug)
     */
    public function log($message, $severity = 'info') {
        // Skip debug messages if debug is disabled
        if ($severity === 'debug' && !$this->debug_enabled) {
            return;
        }
        
        $timestamp = date('Y-m-d H:i:s');
        $severity_upper = strtoupper($severity);
        $log_entry = sprintf("[%s] [%s] %s\n", $timestamp, $severity_upper, $message);
        
        // Ensure log directory exists
        $log_dir = dirname($this->log_file);
        if (!file_exists($log_dir)) {
            wp_mkdir_p($log_dir);
        }
        
        // Write to log file
        error_log($log_entry, 3, $this->log_file);
        
        // Also log errors to PHP error log
        if ($severity === 'error') {
            error_log('HM Affiliate: ' . $message);
        }
    }
    
    /**
     * Log an info message
     *
     * @since 1.0.0
     * @param string $message The message to log
     */
    public function info($message) {
        $this->log($message, 'info');
    }
    
    /**
     * Log a warning message
     *
     * @since 1.0.0
     * @param string $message The message to log
     */
    public function warning($message) {
        $this->log($message, 'warning');
    }
    
    /**
     * Log an error message
     *
     * @since 1.0.0
     * @param string $message The message to log
     */
    public function error($message) {
        $this->log($message, 'error');
    }
    
    /**
     * Log a debug message
     *
     * @since 1.0.0
     * @param string $message The message to log
     */
    public function debug($message) {
        $this->log($message, 'debug');
    }
    
    /**
     * Get recent log entries
     *
     * @since 1.0.0
     * @param int $lines Number of lines to retrieve
     * @return array Log entries
     */
    public function get_recent_logs($lines = 50) {
        if (!file_exists($this->log_file)) {
            return array();
        }
        
        $file = new SplFileObject($this->log_file, 'r');
        $file->seek(PHP_INT_MAX);
        $last_line = $file->key();
        $start_line = max(0, $last_line - $lines);
        
        $log_entries = array();
        $file->seek($start_line);
        
        while (!$file->eof()) {
            $line = $file->current();
            if (!empty(trim($line))) {
                $log_entries[] = $line;
            }
            $file->next();
        }
        
        return $log_entries;
    }
    
    /**
     * Clear old log files (keep last 30 days)
     *
     * @since 1.0.0
     */
    public function cleanup_old_logs() {
        $upload_dir = wp_upload_dir();
        $log_dir = $upload_dir['basedir'] . '/hm-affiliate-logs';
        
        if (!is_dir($log_dir)) {
            return;
        }
        
        $files = glob($log_dir . '/hm-affiliate-*.log');
        $cutoff_time = time() - (30 * 24 * 60 * 60); // 30 days ago
        
        foreach ($files as $file) {
            if (filemtime($file) < $cutoff_time) {
                unlink($file);
            }
        }
    }
}
