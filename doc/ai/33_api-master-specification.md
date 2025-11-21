# API MASTER SPECIFICATION  
## المواصفات الكاملة لجميع الـ Endpoints في SUPERAPP OS

---

# 1. AUTH API
## 1.1 POST /auth/login
- email
- password

**Returns:** token + user profile + role

---

## 1.2 POST /auth/register
Fields:
- name
- email
- password
- role (admin, rep, dealer, partner…)

---

## 1.3 GET /auth/me
Authentication: Bearer Token  
Returns user profile + permissions.

---

# 2. USER MANAGEMENT API  
## 2.1 GET /users  
Admin only: list users  
Filters: role, status, date

## 2.2 POST /users  
Create new user

## 2.3 PATCH /users/:id  
Update user

## 2.4 DELETE /users/:id  
Soft delete

---

# 3. PRODUCT API  
## 3.1 GET /products
Filters:
- brand
- category
- line
- search
- minPrice
- sortBy
- includePricing

---

## 3.2 GET /products/:slug  
Return full product data with pricing, competitors, insights.

---

## 3.3 POST /products  
Create product (Admin only)

---

## 3.4 PATCH /products/:id  
Update product

---

## 3.5 DELETE /products/:id  
Archive product

---

# 4. CATEGORY API  
- CRUD كامل
- مرتبط بـ Brand

---

# 5. BRAND API  
- الهوية  
- القواعد  
- الذكاء  
- التسعير  

---

# 6. PRICING API  
## 6.1 GET /pricing/simulate  
Params:
- sku OR productId
- channel

Returns:
- base cost  
- channel net  
- margin %  
- price curve  

---

## 6.2 GET /pricing/insights  
AI insights:
- risks  
- opportunities  
- suggestions  
- AI narrative  

---

## 6.3 POST /pricing/draft  
Save draft price (with audit).

---

## 6.4 GET /pricing/compare  
Compare across channels.

---

# 7. COMPETITOR API  
## 7.1 GET /competitors/:productId  
Return competitor list.

## 7.2 POST /competitors/scan  
Run AI competitor scan.

---

# 8. AI ENGINE API  
## 8.1 POST /ai/pricing-agent  
Run AI pricing recommendations.

## 8.2 POST /ai/repricing  
Autonomous price updates.

## 8.3 POST /ai/competitor-strategy  
Generate competitive strategy.

## 8.4 POST /ai/learning-loop  
Store AI decision + result.

---

# 9. SALES REP API  
- تسجيل العملاء  
- إنشاء الطلبات  
- الفواتير  
- GPS Tracking  
- الأداء  

---

# 10. DEALER API  
- التسجيل  
- الشروط  
- الطلبات  
- الأسعار الخاصة  
- العقود  

---

# 11. STAND PROGRAM API  
- التسجيل  
- تقييم المحل  
- برنامج الولاء للستاند  
- متابعة الأداء  
- المواد الدعائية  

---

# 12. AFFILIATE API  
- تسجيل  
- كود الخصم  
- الروابط  
- لوحة الأداء  
- العمولات  

---

# 13. LOYALTY API  
- النقاط  
- المستويات  
- المكافآت  
- سجل الشراء  

---

# 14. FINANCE API  
- الفواتير  
- العمولات  
- المصاريف  
- التقارير  
- التدفقات النقدية  

---

# 15. AUTOMATION API  
- إنشاء Automation Rule  
- Triggers  
- Actions  
- Conditions  

---

# 16. NOTIFICATION API  
- create template  
- send notification  
- batch notifications  
- AI notification suggestions  

---

# 17. ADMIN / SUPERADMIN API  
- إدارة الصلاحيات  
- Logs  
- Monitoring  
- Global settings  
- AI control  
