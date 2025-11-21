# Hairoticmen Affiliate Integration for WooCommerce

**Version:** 1.0.0  
**Requires at least:** WordPress 5.8  
**Tested up to:** WordPress 6.4  
**Requires PHP:** 7.4  
**WooCommerce compatibility:** 6.0+  
**License:** GPLv2 or later

## Description

Production-grade WordPress plugin for tracking affiliate clicks and conversions in WooCommerce stores. Seamlessly integrates with the MH Trading OS backend and Affiliate Intelligence System (AIS).

### Features

- ✅ **Click Tracking**: Automatically track affiliate clicks via URL parameters
- ✅ **Conversion Tracking**: Track WooCommerce order completions as conversions
- ✅ **Cookie-Based Attribution**: 30-day cookie lifetime (configurable)
- ✅ **GDPR Compliant**: IP anonymization built-in
- ✅ **Device Detection**: Tracks mobile, tablet, and desktop devices
- ✅ **Secure API Communication**: HTTPS with API secret authentication
- ✅ **Detailed Logging**: Debug mode for troubleshooting
- ✅ **WordPress Settings API**: Clean admin interface
- ✅ **WooCommerce Hooks**: Native integration with order lifecycle

## Installation

### Method 1: Upload Plugin ZIP

1. Download the plugin as a ZIP file
2. Go to WordPress Admin → Plugins → Add New
3. Click "Upload Plugin"
4. Choose the ZIP file and click "Install Now"
5. Activate the plugin

### Method 2: Manual Installation

1. Upload the `hairoticmen-affiliate` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings → Hairoticmen Affiliate to configure

## Configuration

### Backend API Settings

1. Navigate to **Settings → Hairoticmen Affiliate**
2. Enter your **Backend API URL** (e.g., `https://your-replit-app.replit.dev`)
3. Enter your **API Secret Key** (from your MH Trading OS backend)
4. Click "Test API Connection" to verify the connection
5. Save changes

### Tracking Settings

- **Enable Click Tracking**: Track affiliate clicks (recommended: enabled)
- **Enable Conversion Tracking**: Track order conversions (recommended: enabled)
- **Cookie Lifetime**: How long to attribute orders to affiliates (default: 30 days)

### Advanced Settings

- **Enable Debug Logging**: Turn on detailed logging for troubleshooting
- Logs are stored in: `wp-content/uploads/hm-affiliate-logs/`

## Usage

### For Affiliates

Affiliates should use URLs with the `?hm_aff=CODE` parameter:

```
https://your-store.com/?hm_aff=AFFILIATE_CODE
https://your-store.com/shop/?hm_aff=JOHN123
https://your-store.com/product/beard-oil/?hm_aff=PARTNER001
```

### Tracking Flow

1. **Customer clicks affiliate link** with `?hm_aff=CODE` parameter
2. **Plugin stores affiliate code** in a cookie (30 days default)
3. **Click event is sent** to MH Trading OS backend
4. **Customer browses and shops** (affiliate code persists in cookie)
5. **Order is completed** (payment successful)
6. **Conversion is tracked** with full order details
7. **Backend calculates commission** and updates affiliate metrics

### Backend Integration

This plugin sends data to two API endpoints:

#### Click Tracking
```http
POST /api/affiliate/track-click
Content-Type: application/json
X-API-Secret: YOUR_SECRET_KEY

{
  "affiliateCode": "JOHN123",
  "landingUrl": "https://store.com/shop/",
  "referrer": "https://google.com",
  "userAgent": "Mozilla/5.0...",
  "deviceType": "mobile",
  "ip": "192.168.1.0",
  "timestamp": "2025-11-16 19:00:00",
  "source": "wordpress"
}
```

#### Conversion Tracking
```http
POST /api/affiliate/track-conversion
Content-Type: application/json
X-API-Secret: YOUR_SECRET_KEY

{
  "affiliateCode": "JOHN123",
  "orderId": "12345",
  "orderNumber": "WC-12345",
  "total": 129.99,
  "subtotal": 119.99,
  "currency": "EUR",
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "items": [
    {
      "id": 789,
      "sku": "BAR-BEARDOIL50-003",
      "name": "Beard Oil 50ml",
      "quantity": 2,
      "price": 59.99
    }
  ],
  "country": "DE",
  "state": "BY",
  "city": "Munich",
  "timestamp": "2025-11-16 19:30:00",
  "source": "wordpress"
}
```

## Security Features

- ✅ **API Secret Authentication**: Secure communication with backend
- ✅ **IP Anonymization**: GDPR-compliant IP masking (last octet set to 0)
- ✅ **HttpOnly Cookies**: Prevent JavaScript cookie access
- ✅ **SSL/TLS Verification**: HTTPS enforced for API calls
- ✅ **Input Sanitization**: All user inputs sanitized
- ✅ **Nonce Verification**: CSRF protection on admin actions
- ✅ **Capability Checks**: Admin pages restricted to authorized users

## Troubleshooting

### Plugin Not Tracking Clicks

1. Check if click tracking is enabled in settings
2. Verify backend URL is correct (no trailing slash)
3. Test API connection using the "Test API Connection" button
4. Enable debug logging and check log files
5. Verify affiliate code format (alphanumeric, dashes, underscores only)

### Conversions Not Being Tracked

1. Check if conversion tracking is enabled in settings
2. Verify WooCommerce is active and orders are completing successfully
3. Check if cookie is being set (inspect browser cookies for `hm_affiliate_code`)
4. Enable debug logging and review logs for errors
5. Verify backend endpoints are accessible

### API Connection Fails

1. Verify backend is running and accessible from your WordPress server
2. Check if firewall is blocking outbound HTTPS requests
3. Verify API secret matches between plugin and backend
4. Test backend health endpoint directly: `GET /api/admin/health`
5. Check WordPress error logs for connection errors

### Debug Logging

Enable debug logging in **Settings → Hairoticmen Affiliate → Advanced Settings**

Log files location:
```
wp-content/uploads/hm-affiliate-logs/hm-affiliate-YYYY-MM-DD.log
```

Log files are automatically cleaned up after 30 days.

## Requirements

- WordPress 5.8 or higher
- WooCommerce 6.0 or higher
- PHP 7.4 or higher
- HTTPS (SSL certificate) recommended
- Outbound HTTPS access to your MH Trading OS backend

## Backend Requirements

Your MH Trading OS backend must expose these endpoints:

- `POST /api/affiliate/track-click`
- `POST /api/affiliate/track-conversion`
- `GET /api/admin/health` (for connection testing)

All endpoints should accept the `X-API-Secret` header for authentication.

## Privacy & GDPR

This plugin is designed with privacy in mind:

- **IP Anonymization**: IP addresses are anonymized before sending to backend
- **Cookie Consent**: Cookie is first-party and used solely for affiliate attribution
- **Data Minimization**: Only necessary data is collected and transmitted
- **Secure Transmission**: All data sent over HTTPS
- **No Third-Party Services**: Data flows only to your own backend

Ensure your privacy policy mentions affiliate tracking and cookie usage.

## Support

For issues related to:
- **Plugin functionality**: Check debug logs, test API connection
- **Backend integration**: Verify MH Trading OS backend is running
- **WooCommerce compatibility**: Ensure WooCommerce 6.0+ is active

## Changelog

### 1.0.0 (2025-11-16)
- Initial release
- Click tracking with URL parameter detection
- Conversion tracking on WooCommerce order completion
- WordPress Settings API integration
- Debug logging system
- API client with retry logic
- GDPR-compliant IP anonymization
- Device type detection
- Admin settings page with connection testing

## License

This plugin is licensed under the GPLv2 or later.

## Credits

Developed for MH Trading / HAIROTICMEN  
Integrates with the Affiliate Intelligence System (AIS)

---

**Made with ❤️ for affiliate marketing excellence**
