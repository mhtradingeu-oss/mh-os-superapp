=== Hairoticmen Affiliate Integration ===
Contributors: mhtrading
Tags: affiliate, woocommerce, tracking, conversions, marketing
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Production-grade affiliate tracking for WooCommerce. Tracks clicks and conversions, syncs with MH Trading OS backend.

== Description ==

Hairoticmen Affiliate Integration is a production-grade WordPress plugin designed for WooCommerce stores to track affiliate clicks and conversions. It seamlessly integrates with the MH Trading OS backend and Affiliate Intelligence System (AIS).

= Key Features =

* **Click Tracking**: Automatically track affiliate clicks via URL parameters (?hm_aff=CODE)
* **Conversion Tracking**: Track WooCommerce order completions as conversions
* **Cookie-Based Attribution**: Configurable cookie lifetime (default 30 days)
* **GDPR Compliant**: Built-in IP anonymization for privacy compliance
* **Device Detection**: Automatically detects mobile, tablet, and desktop devices
* **Secure API Communication**: HTTPS with API secret authentication
* **Detailed Logging**: Debug mode for troubleshooting and monitoring
* **Clean Admin Interface**: WordPress Settings API integration
* **WooCommerce Native**: Uses official WooCommerce hooks and filters

= How It Works =

1. Affiliate shares link with ?hm_aff=CODE parameter
2. Plugin stores affiliate code in browser cookie (30 days)
3. Click data is sent to your MH Trading OS backend
4. When customer completes order, conversion is tracked
5. Backend receives full order details and calculates commissions

= Backend Integration =

This plugin communicates with your MH Trading OS backend via two endpoints:
* POST /api/affiliate/track-click
* POST /api/affiliate/track-conversion

Make sure your backend is running and these endpoints are accessible.

= Security & Privacy =

* IP addresses are anonymized (GDPR compliant)
* Secure HTTPS communication with API secret
* HttpOnly cookies prevent JavaScript access
* Input sanitization and validation
* CSRF protection on all admin actions

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/hairoticmen-affiliate/` directory
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Go to Settings → Hairoticmen Affiliate to configure
4. Enter your Backend API URL and API Secret
5. Test the connection and enable tracking

== Frequently Asked Questions ==

= Does this work without WooCommerce? =

No, WooCommerce is required as this plugin tracks WooCommerce orders.

= How long do affiliate cookies last? =

By default, 30 days. This is configurable in the plugin settings (1-365 days).

= Is this GDPR compliant? =

Yes, the plugin anonymizes IP addresses before sending data to your backend.

= What if the backend is down? =

The plugin fails gracefully and won't break your checkout process. Errors are logged if debug mode is enabled.

= Can I test the connection? =

Yes! Go to Settings → Hairoticmen Affiliate and click "Test API Connection".

= Where are debug logs stored? =

Logs are stored in: wp-content/uploads/hm-affiliate-logs/

= Does this slow down my site? =

No, tracking is done in a non-blocking way and won't affect page load times or checkout performance.

== Screenshots ==

1. Admin settings page with API configuration
2. Connection test interface
3. Usage instructions and examples
4. Plugin status overview

== Changelog ==

= 1.0.0 =
* Initial release
* Click tracking with URL parameter detection
* Conversion tracking on WooCommerce order completion
* WordPress Settings API integration
* Debug logging system
* API client with error handling
* GDPR-compliant IP anonymization
* Device type detection
* Admin connection testing

== Upgrade Notice ==

= 1.0.0 =
Initial release of the Hairoticmen Affiliate Integration plugin.

== Privacy Policy ==

This plugin collects the following data when affiliate tracking is enabled:

* Affiliate code (from URL parameter)
* Landing page URL
* Referrer URL
* User agent string
* Device type (mobile/tablet/desktop)
* Anonymized IP address (last octet set to 0)
* Order details (when conversion occurs)

All data is transmitted securely to your own MH Trading OS backend. No third-party services are involved.

== Support ==

For support, please:
1. Check debug logs in wp-content/uploads/hm-affiliate-logs/
2. Verify backend connectivity using "Test API Connection"
3. Ensure WooCommerce is active and up to date
4. Confirm backend endpoints are accessible
