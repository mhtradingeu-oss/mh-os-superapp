/**
 * Admin JavaScript for Hairoticmen Affiliate Plugin
 *
 * @package Hairoticmen_Affiliate
 * @since 1.0.0
 */

(function($) {
    'use strict';

    /**
     * Test API connection
     */
    function testConnection() {
        const $button = $('#hm-aff-test-connection-btn');
        const $result = $('#hm-aff-test-result');
        const backendUrl = $('#hm_aff_backend_url').val();
        const apiSecret = $('#hm_aff_api_secret').val();

        // Validate inputs
        if (!backendUrl) {
            showResult('error', 'Please enter a Backend API URL first.');
            return;
        }

        // Show loading state
        $button.prop('disabled', true).text('Testing...');
        showResult('loading', 'Testing connection to backend...');

        // Test connection using WordPress AJAX
        $.ajax({
            url: ajaxurl || '/wp-admin/admin-ajax.php',
            method: 'POST',
            data: {
                action: 'hm_aff_test_connection',
                backend_url: backendUrl,
                api_secret: apiSecret,
                nonce: hmAffAdminNonce || ''
            },
            timeout: 10000,
            success: function(response) {
                if (response.success) {
                    showResult('success', '✓ ' + response.data.message);
                } else {
                    showResult('error', '✗ ' + (response.data ? response.data.message : 'Connection test failed'));
                }
            },
            error: function(xhr, status, error) {
                let message = 'Connection failed: ';
                if (status === 'timeout') {
                    message += 'Request timed out. Check if your backend is running.';
                } else {
                    message += error || 'Unknown error occurred';
                }
                showResult('error', '✗ ' + message);
            },
            complete: function() {
                $button.prop('disabled', false).text('Test API Connection');
            }
        });
    }

    /**
     * Show test result
     */
    function showResult(type, message) {
        const $result = $('#hm-aff-test-result');
        const icons = {
            success: 'yes-alt',
            error: 'dismiss',
            loading: 'update'
        };

        $result
            .removeClass('success error loading')
            .addClass(type)
            .html('<span class="dashicons dashicons-' + icons[type] + '"></span>' + message)
            .show();
    }

    /**
     * Initialize
     */
    $(document).ready(function() {
        // Test connection button
        $('#hm-aff-test-connection-btn').on('click', testConnection);

        // Show/hide password
        let passwordVisible = false;
        const $apiSecretField = $('#hm_aff_api_secret');
        
        // Add toggle button next to password field
        $apiSecretField.after(
            '<button type="button" class="button button-secondary" id="hm-aff-toggle-password" style="margin-left: 5px;">' +
            'Show' +
            '</button>'
        );

        $('#hm-aff-toggle-password').on('click', function(e) {
            e.preventDefault();
            passwordVisible = !passwordVisible;
            $apiSecretField.attr('type', passwordVisible ? 'text' : 'password');
            $(this).text(passwordVisible ? 'Hide' : 'Show');
        });

        // Validate URL format
        $('#hm_aff_backend_url').on('blur', function() {
            const url = $(this).val();
            if (url && !url.match(/^https?:\/\/.+/)) {
                alert('Backend URL must start with http:// or https://');
                $(this).focus();
            }
        });

        // Auto-remove trailing slash
        $('#hm_aff_backend_url').on('change', function() {
            const url = $(this).val();
            if (url.endsWith('/')) {
                $(this).val(url.slice(0, -1));
            }
        });

        // Cookie lifetime validation
        $('#hm_aff_cookie_lifetime').on('change', function() {
            const value = parseInt($(this).val());
            if (value < 1) {
                $(this).val(1);
            } else if (value > 365) {
                $(this).val(365);
            }
        });
    });

})(jQuery);
