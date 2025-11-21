# 🎨 MH Trading OS - Design Review Rubric

**الهدف:** ضمان جودة وتناسق التصميم عبر جميع صفحات التطبيق

## معايير المراجعة

### 1. نظام التصميم (Design System) ⭐⭐⭐

#### ✅ الاستخدام الصحيح للـ Design Tokens
- [ ] استخدام الألوان من `shared/designTokens.ts` أو CSS variables فقط
- [ ] عدم استخدام ألوان hard-coded (مثل `#ff0000` أو `bg-red-500`)
- [ ] استخدام spacing tokens من `SPACING` للتباعد
- [ ] استخدام `RADIUS` للحواف المنحنية
- [ ] استخدام `TYPOGRAPHY` للخطوط والأحجام

#### ✅ مكونات Shadcn/ui
- [ ] استخدام مكونات Shadcn الموجودة (`<Button>`, `<Card>`, `<Badge>`, إلخ)
- [ ] عدم إعادة إنشاء مكونات موجودة
- [ ] variants صحيحة (default, outline, ghost, etc.)
- [ ] sizes صحيحة (sm, md, lg, icon)

**درجة النجاح:** استخدام design tokens في ≥90% من الحالات

---

### 2. الوصولية (Accessibility) ⭐⭐⭐

#### ✅ Semantic HTML
- [ ] استخدام tags دلالية (`<main>`, `<nav>`, `<header>`, `<article>`)
- [ ] structure منطقي للصفحة (h1 → h2 → h3)
- [ ] لا يوجد تخطي في مستويات العناوين

#### ✅ ARIA & Roles
- [ ] `aria-label` أو `aria-labelledby` على العناصر التفاعلية
- [ ] `role` صحيح على العناصر المخصصة
- [ ] `aria-expanded`, `aria-selected` عند الحاجة
- [ ] لا يوجد `aria-*` غير ضروري

#### ✅ Keyboard Navigation
- [ ] جميع العناصر التفاعلية قابلة للوصول بـ Tab
- [ ] focus visible واضح ومميز
- [ ] Enter/Space يعمل على الأزرار
- [ ] Escape يغلق modals/dialogs

#### ✅ Color Contrast
- [ ] تباين ≥ 4.5:1 للنص العادي
- [ ] تباين ≥ 3:1 للنص الكبير (≥18px)
- [ ] تباين ≥ 3:1 للعناصر التفاعلية
- [ ] يعمل في Dark mode و Light mode

**درجة النجاح:** ≥90% تطابق + Lighthouse A11y ≥90

---

### 3. دعم RTL/LTR ⭐⭐

#### ✅ التخطيط (Layout)
- [ ] يعمل في كلا الاتجاهين بدون كسر
- [ ] padding/margin تتبدل تلقائياً (استخدام `px-4` بدلاً من `pl-4`)
- [ ] flex-row-reverse عند الحاجة
- [ ] الأيقونات تنعكس عند الحاجة (arrows, chevrons)

#### ✅ النصوص
- [ ] `dir="rtl"` أو `dir="ltr"` على العناصر الصحيحة
- [ ] محاذاة النصوص صحيحة (text-start بدلاً من text-left)
- [ ] لا توجد نصوص مقطوعة أو متداخلة

**درجة النجاح:** يعمل 100% في كلا الاتجاهين

---

### 4. الاستجابة (Responsiveness) ⭐⭐

#### ✅ Mobile-First
- [ ] يعمل على شاشات ≥320px
- [ ] breakpoints منطقية (sm, md, lg, xl)
- [ ] لا يوجد horizontal scroll غير مقصود
- [ ] touch targets ≥44px للأجهزة اللمسية

#### ✅ Tables & Data
- [ ] tables responsive (scroll أو stack)
- [ ] charts تتكيف مع حجم الشاشة
- [ ] modals/dialogs تعمل على mobile

**درجة النجاح:** يعمل على ≥3 أحجام شاشات مختلفة

---

### 5. Dark/Light Mode ⭐⭐

#### ✅ التناسق
- [ ] يعمل Dark mode على جميع الصفحات
- [ ] لا يوجد "white flash" عند التبديل
- [ ] التباين واضح في كلا الوضعين
- [ ] الصور/الأيقونات تتكيف (إن وجدت)

#### ✅ CSS Variables
- [ ] استخدام `hsl(var(--token))` بدلاً من قيم ثابتة
- [ ] dark: variants عند الحاجة
- [ ] لا يوجد ألوان hard-coded

**درجة النجاح:** يعمل 100% في كلا الوضعين

---

### 6. التفاعلية (Interactivity) ⭐⭐

#### ✅ Hover/Active States
- [ ] hover states واضحة (استخدام `hover-elevate`)
- [ ] active states واضحة (استخدام `active-elevate-2`)
- [ ] لا يوجد layout shift عند hover
- [ ] transitions سلسة (150-250ms)

#### ✅ Loading States
- [ ] Skeleton loaders عند تحميل البيانات
- [ ] Spinners على الأزرار عند العمليات
- [ ] disabled state واضح
- [ ] empty states واضحة ومفيدة

#### ✅ Error Handling
- [ ] رسائل خطأ واضحة ومفيدة
- [ ] toast notifications للنجاح/الخطأ
- [ ] validation errors على الحقول

**درجة النجاح:** ≥95% من التفاعلات لها feedback واضح

---

### 7. Data-testid ⭐

#### ✅ Testing Attributes
- [ ] `data-testid` على جميع العناصر التفاعلية
- [ ] naming convention واضح (`button-submit`, `input-email`)
- [ ] unique IDs للعناصر المتكررة (`card-product-${id}`)

**درجة النجاح:** 100% من العناصر التفاعلية

---

### 8. الأداء (Performance) ⭐

#### ✅ Bundle Size
- [ ] lazy loading للصفحات
- [ ] dynamic imports للمكونات الكبيرة
- [ ] code splitting منطقي
- [ ] tree shaking يعمل

#### ✅ Images
- [ ] srcset للصور responsive
- [ ] lazy loading للصور
- [ ] WebP format (مع fallback)
- [ ] compressed

#### ✅ Data Fetching
- [ ] TanStack Query للـ caching
- [ ] staleTime/cacheTime منطقية
- [ ] prefetching للروابط المهمة

**درجة النجاح:** Lighthouse Performance ≥85

---

## سلم التقييم

### ⭐⭐⭐ أساسي (Mandatory)
- **نظام التصميم** - يجب استخدام design tokens
- **الوصولية** - يجب تحقيق A11y ≥90%
- **RTL/LTR** - يجب أن يعمل في كلا الاتجاهين

### ⭐⭐ مهم (Important)
- **الاستجابة** - يجب أن يعمل على mobile/tablet/desktop
- **Dark/Light** - يجب أن يعمل في كلا الوضعين
- **التفاعلية** - loading/error/empty states

### ⭐ مستحسن (Nice to Have)
- **Data-testid** - يساعد في الاختبارات
- **الأداء** - يحسن التجربة

---

## عملية المراجعة

### 1. Self-Review (مراجعة ذاتية)
قبل تقديم PR، تحقق من:
- [ ] جميع معايير ⭐⭐⭐ مستوفاة
- [ ] ≥80% من معايير ⭐⭐ مستوفاة
- [ ] ≥50% من معايير ⭐ مستوفاة

### 2. Automated Checks
- [ ] ESLint pass (لا errors)
- [ ] TypeScript compile (لا errors)
- [ ] Jest tests pass
- [ ] Playwright E2E pass (إن وجدت)

### 3. Manual Testing
- [ ] اختبار على Chrome/Firefox/Safari
- [ ] اختبار على mobile device حقيقي
- [ ] اختبار RTL/LTR
- [ ] اختبار Dark/Light
- [ ] اختبار keyboard navigation

### 4. Accessibility Audit
- [ ] axe DevTools - لا يوجد critical issues
- [ ] WAVE - لا يوجد errors
- [ ] Lighthouse A11y ≥90%

### 5. Visual Review
- [ ] Screenshots لجميع الحالات (normal, hover, active, error, empty)
- [ ] Screenshots لـ RTL/LTR
- [ ] Screenshots لـ Dark/Light
- [ ] Screenshots لـ mobile/tablet/desktop

---

## Checklist سريع لكل صفحة

```markdown
## Page: [اسم الصفحة]

### Design System
- [ ] Colors من tokens ✅
- [ ] Spacing من tokens ✅
- [ ] Shadcn components ✅

### Accessibility
- [ ] Semantic HTML ✅
- [ ] ARIA ✅
- [ ] Keyboard nav ✅
- [ ] Color contrast ✅

### RTL/LTR
- [ ] Works in both ✅
- [ ] Icons flip ✅

### Responsive
- [ ] Mobile ✅
- [ ] Tablet ✅
- [ ] Desktop ✅

### Dark/Light
- [ ] Dark mode ✅
- [ ] Light mode ✅

### States
- [ ] Loading ✅
- [ ] Error ✅
- [ ] Empty ✅
- [ ] Hover/Active ✅

### Testing
- [ ] data-testid ✅
- [ ] E2E tests ✅
```

---

## أمثلة على المراجعة

### ✅ مثال جيد
```tsx
<Button
  variant="default"
  size="lg"
  onClick={handleSubmit}
  disabled={isPending}
  data-testid="button-submit-quote"
  className="w-full sm:w-auto"
>
  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
  {t("submit")}
</Button>
```

**لماذا جيد:**
- ✅ استخدام `<Button>` من Shadcn
- ✅ variant و size واضحان
- ✅ disabled state
- ✅ data-testid
- ✅ responsive (w-full sm:w-auto)
- ✅ loading state
- ✅ i18n

### ❌ مثال سيء
```tsx
<div
  style={{ backgroundColor: '#3b82f6', padding: '10px', borderRadius: '4px' }}
  onClick={handleSubmit}
>
  Submit
</div>
```

**لماذا سيء:**
- ❌ لم يستخدم `<Button>`
- ❌ ألوان hard-coded
- ❌ spacing hard-coded
- ❌ لا يوجد semantic HTML
- ❌ لا يوجد data-testid
- ❌ لا يوجد states
- ❌ لا يوجد i18n
- ❌ لا يوجد accessibility

---

## الخلاصة

**الأساسيات الذهبية:**
1. 🎨 استخدم design tokens - لا hard-coding
2. ♿ Accessibility أولاً - A11y ≥90%
3. 🌐 RTL/LTR يعمل - اختبر دائماً
4. 📱 Mobile-first - responsive دائماً
5. 🌓 Dark/Light - كلاهما يعمل
6. ✨ States واضحة - loading/error/empty
7. 🧪 data-testid دائماً - للاختبارات

**قاعدة الإبهام:**
> إذا كنت تكتب قيمة hard-coded (لون، spacing، size)، فأنت تفعلها خطأ!
