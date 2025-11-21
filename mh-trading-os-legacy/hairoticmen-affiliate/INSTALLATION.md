# Installation Guide for Hairoticmen Affiliate Integration

## Prerequisites

- WordPress 5.8 or higher
- WooCommerce 6.0 or higher  
- PHP 7.4 or higher
- Active MH Trading OS backend (Replit app)
- HTTPS enabled on your WordPress site (recommended)

## Step 1: Prepare the Plugin

### Option A: Create ZIP File

```bash
# From the project root directory
zip -r hairoticmen-affiliate.zip hairoticmen-affiliate/
```

### Option B: Use FTP/SFTP

Upload the entire `hairoticmen-affiliate` folder to your WordPress installation:
```
/wp-content/plugins/hairoticmen-affiliate/
```

## Step 2: Install via WordPress Admin

1. Log in to your WordPress Admin Panel
2. Navigate to **Plugins → Add New**
3. Click **Upload Plugin** button (top of page)
4. Choose the `hairoticmen-affiliate.zip` file
5. Click **Install Now**
6. Wait for the upload and installation to complete
7. Click **Activate Plugin**

## Step 3: Configure the Plugin

1. Navigate to **Settings → Hairoticmen Affiliate**

2. **API Configuration Section:**
   - **Backend API URL**: Enter your Replit app URL
     - Example: `https://your-app-name.replit.dev`
     - **Important**: No trailing slash!
   - **API Secret Key**: Enter the secret key from your backend
     - Find this in your Replit Secrets: `API_SECRET_KEY`
     - This is used for secure authentication

3. **Tracking Settings Section:**
   - ✅ **Enable Click Tracking**: Keep enabled
   - ✅ **Enable Conversion Tracking**: Keep enabled  
   - **Cookie Lifetime**: Leave at 30 days (or customize)

4. **Advanced Settings Section:**
   - **Enable Debug Logging**: Turn ON for initial testing
   - Turn OFF once everything is working in production

5. Click **Save Changes**

## Step 4: Test the Connection

1. On the settings page, scroll to **Test Connection** section
2. Click **Test API Connection** button
3. You should see: ✓ "Connection successful"
4. If you see an error:
   - Verify your backend URL is correct
   - Check that your backend is running on Replit
   - Verify the API secret matches
   - Check WordPress error logs

## Step 5: Verify Tracking

### Test Click Tracking

1. Open your store in a new browser (or incognito mode)
2. Add `?hm_aff=TEST123` to any URL
   - Example: `https://your-store.com/?hm_aff=TEST123`
3. Check debug logs: `wp-content/uploads/hm-affiliate-logs/`
4. You should see: "Tracking click for affiliate: TEST123"

### Test Conversion Tracking

1. Keep the same browser session (cookie is set)
2. Add a product to cart
3. Complete checkout and pay
4. After order completion, check debug logs
5. You should see: "Successfully tracked conversion for order XXX"

## Step 6: Create Test Affiliate Links

For affiliates to use, create links like:

```
https://your-store.com/?hm_aff=AFFILIATE_CODE
https://your-store.com/shop/?hm_aff=JOHN123
https://your-store.com/product/beard-oil/?hm_aff=PARTNER001
```

**Affiliate Code Format:**
- Alphanumeric characters (a-z, A-Z, 0-9)
- Dashes and underscores allowed (-, _)
- No spaces or special characters

## Troubleshooting

### Plugin Won't Activate

**Error**: "Plugin could not be activated because it triggered a fatal error"

**Solution**:
1. Check PHP version (must be 7.4+)
2. Verify WooCommerce is active
3. Check file permissions
4. Review PHP error logs

### Click Tracking Not Working

**Check:**
1. Is click tracking enabled in settings?
2. Is the affiliate code format valid? (alphanumeric, dashes, underscores)
3. Are cookies enabled in the browser?
4. Check debug logs for errors

### Conversion Tracking Not Working

**Check:**
1. Is conversion tracking enabled in settings?
2. Was a click tracked first? (check for cookie)
3. Is the order status "completed" or "processing"?
4. Check WooCommerce order notes for affiliate info
5. Review debug logs

### Backend Connection Fails

**Check:**
1. Is your Replit app running? (check Replit dashboard)
2. Is the URL correct? (no trailing slash)
3. Is the API secret correct?
4. Can your WordPress server make outbound HTTPS requests?
5. Check firewall settings

### No Logs Appearing

**Check:**
1. Is debug logging enabled in settings?
2. Does `wp-content/uploads/hm-affiliate-logs/` exist?
3. Check folder permissions (should be writable)
4. Look in main WordPress debug log if enabled

## Backend Setup

Ensure your MH Trading OS backend has these endpoints active:

```
POST /api/affiliate/track-click
POST /api/affiliate/track-conversion
GET /api/admin/health
```

All endpoints should:
- Accept JSON payloads
- Verify `X-API-Secret` header
- Return appropriate status codes (200 for success)

## Security Checklist

- ✅ HTTPS enabled on WordPress site
- ✅ API secret configured and matches backend
- ✅ IP anonymization enabled (automatic)
- ✅ Debug logging disabled in production
- ✅ Log directory protected (.htaccess added automatically)
- ✅ Strong admin password
- ✅ WordPress and plugins up to date

## Production Deployment

Before going live:

1. **Test thoroughly** with test orders
2. **Disable debug logging** (performance)
3. **Verify API secret** is strong and secret
4. **Check GDPR compliance** (privacy policy)
5. **Monitor logs** for first few days
6. **Set up alerts** in backend for tracking issues

## Monitoring

### Daily Checks
- Review debug logs (if enabled)
- Check affiliate dashboard in MH Trading OS
- Verify conversions are being tracked

### Weekly Checks
- Review error logs
- Check cookie lifetime settings
- Verify backend uptime

### Monthly Checks
- Clean up old logs (auto-deleted after 30 days)
- Review plugin updates
- Update WordPress and WooCommerce

## Support Checklist

If you need to troubleshoot:

1. **Enable debug logging**
2. **Reproduce the issue**
3. **Collect log file** from `wp-content/uploads/hm-affiliate-logs/`
4. **Check WordPress error log**
5. **Test API connection**
6. **Verify WooCommerce order flow**
7. **Check browser console** (F12) for JavaScript errors

## Useful Commands

### View recent logs (SSH)
```bash
tail -f /path/to/wordpress/wp-content/uploads/hm-affiliate-logs/hm-affiliate-*.log
```

### Test backend endpoint (curl)
```bash
curl -X POST https://your-app.replit.dev/api/affiliate/track-click \
  -H "Content-Type: application/json" \
  -H "X-API-Secret: YOUR_SECRET" \
  -d '{"affiliateCode":"TEST","landingUrl":"https://test.com"}'
```

### Check WooCommerce version
```bash
wp plugin list --name=woocommerce
```

---

**Need Help?**
- Review the main README.md
- Check debug logs
- Verify backend is running
- Ensure WooCommerce is working properly

**Ready to Go Live? ✅**
- Test click tracking works
- Test conversion tracking works
- API connection successful
- Debug logging disabled
- Privacy policy updated
- Affiliate links generated
