# PRODUCT MASTER  
## ملف المنتجات الرئيسي – HAIROTICMEN

---

## 🎯 1. مصادر ملفات المنتجات

المنتجات تم استخراجها من المصادر التالية:

- HAIROTICMEN Product pdf  
- Product Description.pdf  
- Product How to Use.pdf  
- Unique Selling Propositions.pdf  
- product cv.csv  
- FINAL PRICE FINAL STOCK CSV  
- Packaging Master XLSX  

---

## 📦 2. الفئات الرئيسية للمنتجات

### 1) لائحة المنتجات (Beard Care)

- Beard Oil 50ml  
- Beard Oil 100ml  
- Beard Balm  
- Beard Shampoo  
- Beard Conditioner  
- Beard Styling Cream  

### 2) العناية بالشعر (Hair Care)

- Hair Wax  
- Hair Cream  
- Hair Gel  
- Hair Powder  
- Hair Serum  
- Hair Shampoo  
- Hair Conditioner  

### 3) العناية بالبشرة

- Face Scrub  
- Face Cream  
- Mask  
- 3in1  

### 4) منتجات الحلاقة

- Shaving Gel 1100ml  
- Shaving Gel 500ml  
- After Shave 175  
- After Shave 500ml  

### 5) الكتات

- Beard Kit 6in1  
- Beard Kit 3in1  
- Hair Kit  

---

## 🔢 3. تصنيف المنتجات حسب خطوط الإنتاج

- Premium Line  
- Professional Line  
- Barber Care Line  
- Home Use Line  

---

## 📊 4. ملف المنتج (Product Data Model)

كل منتج يحتوي على:

- SKU  
- Name  
- UPC  
- Category  
- Subcategory  
- Line  
- Status  
- Weight (g)  
- Net Content (ml)  
- Units Per Carton  
- Factory Price  
- Retail Price  
- Description  
- How to Use  
- USP  
- Image  
- Packaging Specs  
- Barcode  
- QR  

---

## 📦 5. ملفات مرجعية

### ملف CSV الأساسي:

`/mnt/data/product cv.csv`

### ملف الباركود والأسعار النهائية:

`/mnt/data/FINAL PRICE FINAL STOCK FINL BARCOD .csv`

### ملف التغليف:

`/mnt/data/HAIROTICMEN_Packaging_Master_Pro_DE_FinalGewicht.xlsx`

---

## 🔍 6. كيف يتم إدخال المنتجات في النظام؟

1. قراءة CSV  
2. إنشاء Categories  
3. إنشاء BrandProducts  
4. ملء Pricing  
5. ملء Packaging  
6. رفع الصور  
7. ربط USP  
8. ربط How to Use  
9. ربط Description  

يتم ذلك عبر:

- Seeders  
- أو لوحة تحكم Super Admin  
- أو عبر Codex مباشرة

---
