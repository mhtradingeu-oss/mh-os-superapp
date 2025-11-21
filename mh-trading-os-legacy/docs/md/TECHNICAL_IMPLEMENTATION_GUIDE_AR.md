# دليل التنفيذ التقني المتقدم
## نظام MH Trading OS - التكامل الشامل

**للمطورين:** دليل خطوة بخطوة لبناء كل نظام

---

## 📋 جدول المحتويات

1. [نظام الشركاء المتقدم](#partner-system)
2. [نظام الولاء والهدايا](#loyalty-system)
3. [وكلاء AI المتخصصون](#ai-agents)
4. [لوحات التحكم للموظفين](#employee-dashboards)
5. [واجهات المستخدم المتقدمة](#advanced-ui)
6. [التكامل الشامل](#integration)

---

<a name="partner-system"></a>
## 1️⃣ نظام الشركاء المتقدم

### 1.1 Google Sheets Schema

#### جدول: `PartnerPrograms`
```typescript
const PARTNER_PROGRAMS_HEADERS = [
  'ProgramID',           // PROG-001
  'ProgramName',         // 'Dealer Basic'
  'ProgramType',         // 'Dealer' | 'Affiliate' | 'SalesRep' | 'Stand'
  'CommissionRate',      // 0.05 (5%)
  'MinOrderValue',       // 500 EUR
  'MinOrderQty',         // 10 units
  'DiscountTier',        // 'Basic' | 'Plus' | 'Distributor'
  'PaymentTerms',        // 'Net30'
  'Active',              // TRUE/FALSE
  
  // للـ Affiliate فقط
  'CookieDays',          // 30
  'TrackingPrefix',      // 'AFF-'
  'PaymentThreshold',    // 100 EUR
  'PaymentMethod',       // 'Bank' | 'PayPal'
  
  // للـ Sales Rep فقط
  'TerritoryJSON',       // ["Berlin", "Munich"]
  'MonthlyTarget',       // 50000 EUR
  'BonusStructureJSON',  // [{target: 50000, bonus: 0.02}]
  
  // للـ Stand Partner فقط
  'InventoryLimit',      // 10000 EUR
  'RefillSchedule',      // 'Weekly' | 'BiWeekly' | 'Monthly'
  'AutoRefill',          // TRUE/FALSE
  
  // Metadata
  'CreatedAt',
  'UpdatedAt',
  'CreatedBy',
  'Notes'
];
```

#### جدول: `StandPolicies`
```typescript
const STAND_POLICIES_HEADERS = [
  'PolicyID',            // POL-001
  'PartnerID',           // PRT-001
  'StandID',             // STD-001
  
  // Inventory Policies
  'MaxInventoryValue',   // 10000 EUR
  'AutoRefill',          // TRUE
  'RefillThreshold',     // 30% (يعيد الطلب عند 30%)
  'AllowedCategoriesJSON', // ["Hair", "Beard", "Shaving"]
  
  // Sales Policies
  'CanDiscount',         // TRUE
  'MaxDiscountPct',      // 0.10 (10%)
  'RequiresApproval',    // TRUE
  'ApprovalThreshold',   // 1000 EUR
  
  // Returns Policies
  'AllowReturns',        // TRUE
  'ReturnWindowDays',    // 14
  'RestockingFeePct',    // 0.15 (15%)
  
  // Payment Policies
  'PaymentTerms',        // 'COD' | 'Net15' | 'Net30'
  'CreditLimit',         // 5000 EUR
  'RequireDeposit',      // FALSE
  'DepositPct',          // 0 (0%)
  
  'Active',
  'CreatedAt',
  'UpdatedAt'
];
```

### 1.2 Backend Implementation

#### `server/lib/partner-programs.ts`
```typescript
import { createLogger } from './logger';
import { sheetsService } from './sheets';

const logger = createLogger('PartnerPrograms');

export interface PartnerProgram {
  programID: string;
  programName: string;
  programType: 'Dealer' | 'Affiliate' | 'SalesRep' | 'Stand';
  commissionRate: number;
  minOrderValue: number;
  minOrderQty: number;
  discountTier: string;
  paymentTerms: string;
  active: boolean;
  
  // Affiliate specific
  cookieDays?: number;
  trackingPrefix?: string;
  paymentThreshold?: number;
  paymentMethod?: 'Bank' | 'PayPal';
  
  // Sales Rep specific
  territory?: string[];
  monthlyTarget?: number;
  bonusStructure?: { target: number; bonus: number }[];
  
  // Stand Partner specific
  inventoryLimit?: number;
  refillSchedule?: 'Weekly' | 'BiWeekly' | 'Monthly';
  autoRefill?: boolean;
}

export class PartnerProgramManager {
  /**
   * Get all partner programs
   */
  async getAllPrograms(): Promise<PartnerProgram[]> {
    const rows = await sheetsService.getRows('PartnerPrograms');
    return rows.map(row => this.parseProgram(row));
  }
  
  /**
   * Get program by type
   */
  async getProgramsByType(type: string): Promise<PartnerProgram[]> {
    const programs = await this.getAllPrograms();
    return programs.filter(p => p.programType === type && p.active);
  }
  
  /**
   * Calculate commission for an order
   */
  async calculateCommission(
    programID: string,
    orderValue: number,
    orderQty: number
  ): Promise<{
    commission: number;
    bonus?: number;
    total: number;
  }> {
    const program = await this.getProgram(programID);
    
    if (!program) {
      throw new Error(`Program ${programID} not found`);
    }
    
    // Base commission
    let commission = orderValue * program.commissionRate;
    let bonus = 0;
    
    // Check for bonus (Sales Rep)
    if (program.bonusStructure) {
      for (const tier of program.bonusStructure) {
        if (orderValue >= tier.target) {
          bonus = orderValue * tier.bonus;
        }
      }
    }
    
    const total = commission + bonus;
    
    logger.info({
      programID,
      orderValue,
      commission,
      bonus,
      total
    }, 'Commission calculated');
    
    return { commission, bonus, total };
  }
  
  /**
   * Check if partner meets minimum requirements
   */
  async validateOrder(
    programID: string,
    orderValue: number,
    orderQty: number
  ): Promise<{ valid: boolean; reason?: string }> {
    const program = await this.getProgram(programID);
    
    if (!program) {
      return { valid: false, reason: 'Program not found' };
    }
    
    if (!program.active) {
      return { valid: false, reason: 'Program is not active' };
    }
    
    if (orderValue < program.minOrderValue) {
      return { 
        valid: false, 
        reason: `Minimum order value is ${program.minOrderValue} EUR` 
      };
    }
    
    if (orderQty < program.minOrderQty) {
      return { 
        valid: false, 
        reason: `Minimum order quantity is ${program.minOrderQty} units` 
      };
    }
    
    return { valid: true };
  }
  
  private parseProgram(row: any): PartnerProgram {
    return {
      programID: row.ProgramID,
      programName: row.ProgramName,
      programType: row.ProgramType,
      commissionRate: parseFloat(row.CommissionRate),
      minOrderValue: parseFloat(row.MinOrderValue),
      minOrderQty: parseInt(row.MinOrderQty),
      discountTier: row.DiscountTier,
      paymentTerms: row.PaymentTerms,
      active: row.Active === 'TRUE',
      
      // Parse JSON fields
      ...(row.TerritoryJSON && { 
        territory: JSON.parse(row.TerritoryJSON) 
      }),
      ...(row.BonusStructureJSON && { 
        bonusStructure: JSON.parse(row.BonusStructureJSON) 
      }),
      ...(row.AllowedCategoriesJSON && {
        allowedCategories: JSON.parse(row.AllowedCategoriesJSON)
      })
    };
  }
}

export const partnerProgramManager = new PartnerProgramManager();
```

### 1.3 Frontend Component

#### `client/src/components/PartnerProgramSelector.tsx`
```typescript
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PartnerProgramSelectorProps {
  onSelect: (program: any) => void;
  selectedType?: string;
}

export function PartnerProgramSelector({
  onSelect,
  selectedType
}: PartnerProgramSelectorProps) {
  const { data: programs, isLoading } = useQuery({
    queryKey: ['/api/partner-programs'],
  });
  
  const [selected, setSelected] = useState<string>('');
  
  const filteredPrograms = selectedType
    ? programs?.filter((p: any) => p.programType === selectedType)
    : programs;
  
  const handleSelect = (programID: string) => {
    setSelected(programID);
    const program = programs?.find((p: any) => p.programID === programID);
    if (program) {
      onSelect(program);
    }
  };
  
  if (isLoading) {
    return <div>جاري التحميل...</div>;
  }
  
  const selectedProgram = programs?.find((p: any) => p.programID === selected);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">
          اختر برنامج الشراكة
        </label>
        <Tooltip>
          <TooltipTrigger>
            <InfoIcon className="w-4 h-4 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <p>البرنامج يحدد العمولة والخصومات وشروط الدفع</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      <Select value={selected} onValueChange={handleSelect}>
        <SelectTrigger>
          <SelectValue placeholder="اختر برنامج..." />
        </SelectTrigger>
        <SelectContent>
          {filteredPrograms?.map((program: any) => (
            <SelectItem key={program.programID} value={program.programID}>
              <div className="flex items-center gap-2">
                {program.programName}
                <Badge variant="secondary">
                  {(program.commissionRate * 100).toFixed(0)}% عمولة
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedProgram && (
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">نوع البرنامج:</span>
              <span className="font-medium ml-2">{selectedProgram.programType}</span>
            </div>
            <div>
              <span className="text-muted-foreground">العمولة:</span>
              <span className="font-medium ml-2">
                {(selectedProgram.commissionRate * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">الحد الأدنى للطلب:</span>
              <span className="font-medium ml-2">
                {selectedProgram.minOrderValue} €
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">شروط الدفع:</span>
              <span className="font-medium ml-2">{selectedProgram.paymentTerms}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
```

---

<a name="loyalty-system"></a>
## 2️⃣ نظام الولاء والهدايا

### 2.1 Google Sheets Schema

#### جدول: `LoyaltyPrograms`
```typescript
const LOYALTY_PROGRAMS_HEADERS = [
  'ProgramID',
  'ProgramName',
  'Active',
  
  // Earning Rules
  'PointsPerEuro',          // 10 نقطة لكل يورو
  'MinPurchase',            // 0 (لا يوجد حد أدنى)
  'BonusCategoriesJSON',    // [{"category": "Premium", "multiplier": 2}]
  'BirthdayBonus',          // 500 نقطة
  'ReferralBonus',          // 1000 نقطة
  
  // Redemption Rules
  'PointsToEuro',           // 100 نقطة = 1 يورو
  'MinRedemption',          // 1000 نقطة (10 يورو)
  'MaxPerOrder',            // 50% من قيمة الطلب
  'ExpiryDays',             // 365 يوم
  
  // Tiers
  'TiersJSON',              // [{"name": "Bronze", "minPoints": 0, ...}]
  
  'CreatedAt',
  'UpdatedAt'
];
```

#### جدول: `CustomerLoyalty`
```typescript
const CUSTOMER_LOYALTY_HEADERS = [
  'CustomerID',
  'ProgramID',
  'CurrentPoints',           // النقاط الحالية
  'LifetimePoints',          // إجمالي النقاط المكتسبة
  'PointsRedeemed',          // النقاط المستخدمة
  'CurrentTier',             // 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  'NextTierPoints',          // نقاط للوصول للمستوى التالي
  'MemberSince',             // تاريخ الانضمام
  'LastActivity',            // آخر نشاط
  'PointsExpiryDate',        // تاريخ انتهاء النقاط
  'ReferralCode',            // كود الإحالة الخاص
  'ReferralCount',           // عدد الإحالات الناجحة
  'Birthday',                // عيد الميلاد (للبونص)
  'BirthdayBonusUsed',       // TRUE/FALSE
  'Notes'
];
```

#### جدول: `LoyaltyTransactions`
```typescript
const LOYALTY_TRANSACTIONS_HEADERS = [
  'TransactionID',           // LTX-001
  'CustomerID',
  'TransactionType',         // 'Earn' | 'Redeem' | 'Expire' | 'Bonus'
  'Points',                  // +100 أو -100
  'RelatedOrderID',          // رابط بالطلب (إن وجد)
  'Description',             // 'Earned from order ORD-123'
  'CreatedAt',
  'ExpiryDate'
];
```

#### جدول: `GiftsCatalog`
```typescript
const GIFTS_CATALOG_HEADERS = [
  'GiftID',                  // GFT-001
  'GiftSKU',                 // SKU المنتج
  'GiftName',
  'GiftType',                // 'FreeWithOrder' | 'PointsRedemption' | 'Seasonal'
  
  // For FreeWithOrder
  'MinOrderValue',           // 50 EUR
  
  // For PointsRedemption
  'PointsCost',              // 5000 نقطة
  
  // For Seasonal
  'Season',                  // 'Ramadan' | 'Eid' | 'Christmas'
  'StartDate',
  'EndDate',
  
  'StockAvailable',          // 100
  'ImageURL',
  'Description',
  'Active',
  'CreatedAt'
];
```

### 2.2 Backend Implementation

#### `server/lib/loyalty-engine.ts`
```typescript
import { createLogger } from './logger';
import { sheetsService } from './sheets';

const logger = createLogger('LoyaltyEngine');

export interface LoyaltyProgram {
  programID: string;
  programName: string;
  active: boolean;
  
  earningRules: {
    pointsPerEuro: number;
    minPurchase: number;
    bonusCategories: { category: string; multiplier: number }[];
    birthdayBonus: number;
    referralBonus: number;
  };
  
  redemptionRules: {
    pointsToEuro: number;
    minRedemption: number;
    maxPerOrder: number;
    expiryDays: number;
  };
  
  tiers: {
    name: string;
    minPoints: number;
    benefits: {
      pointsMultiplier: number;
      freeShipping: boolean;
      exclusiveOffers: boolean;
      prioritySupport: boolean;
    };
  }[];
}

export class LoyaltyEngine {
  /**
   * Calculate points earned from an order
   */
  async calculatePointsEarned(
    customerID: string,
    orderValue: number,
    orderCategories: string[]
  ): Promise<{
    basePoints: number;
    bonusPoints: number;
    totalPoints: number;
  }> {
    const program = await this.getCustomerProgram(customerID);
    const customer = await this.getCustomerLoyalty(customerID);
    
    // Base points
    let basePoints = Math.floor(
      orderValue * program.earningRules.pointsPerEuro
    );
    
    // Bonus for categories
    let bonusPoints = 0;
    for (const cat of orderCategories) {
      const bonus = program.earningRules.bonusCategories.find(
        b => b.category === cat
      );
      if (bonus) {
        bonusPoints += Math.floor(
          basePoints * (bonus.multiplier - 1)
        );
      }
    }
    
    // Tier multiplier
    const tier = this.getTierByName(program, customer.currentTier);
    if (tier) {
      const tierBonus = Math.floor(
        basePoints * (tier.benefits.pointsMultiplier - 1)
      );
      bonusPoints += tierBonus;
    }
    
    const totalPoints = basePoints + bonusPoints;
    
    logger.info({
      customerID,
      orderValue,
      basePoints,
      bonusPoints,
      totalPoints
    }, 'Points calculated');
    
    return { basePoints, bonusPoints, totalPoints };
  }
  
  /**
   * Redeem points for discount
   */
  async redeemPoints(
    customerID: string,
    pointsToRedeem: number,
    orderValue: number
  ): Promise<{
    success: boolean;
    discountAmount: number;
    remainingPoints: number;
    reason?: string;
  }> {
    const program = await this.getCustomerProgram(customerID);
    const customer = await this.getCustomerLoyalty(customerID);
    
    // Validate minimum redemption
    if (pointsToRedeem < program.redemptionRules.minRedemption) {
      return {
        success: false,
        discountAmount: 0,
        remainingPoints: customer.currentPoints,
        reason: `Minimum ${program.redemptionRules.minRedemption} points required`
      };
    }
    
    // Validate sufficient points
    if (pointsToRedeem > customer.currentPoints) {
      return {
        success: false,
        discountAmount: 0,
        remainingPoints: customer.currentPoints,
        reason: 'Insufficient points'
      };
    }
    
    // Calculate discount
    const discountAmount = pointsToRedeem / program.redemptionRules.pointsToEuro;
    
    // Validate max per order
    const maxDiscount = orderValue * (program.redemptionRules.maxPerOrder / 100);
    if (discountAmount > maxDiscount) {
      return {
        success: false,
        discountAmount: 0,
        remainingPoints: customer.currentPoints,
        reason: `Maximum ${program.redemptionRules.maxPerOrder}% discount allowed`
      };
    }
    
    // Deduct points
    const newPoints = customer.currentPoints - pointsToRedeem;
    await this.updateCustomerPoints(customerID, newPoints);
    
    // Log transaction
    await this.logTransaction({
      customerID,
      type: 'Redeem',
      points: -pointsToRedeem,
      description: `Redeemed for ${discountAmount.toFixed(2)} EUR discount`
    });
    
    logger.info({
      customerID,
      pointsToRedeem,
      discountAmount,
      remainingPoints: newPoints
    }, 'Points redeemed');
    
    return {
      success: true,
      discountAmount,
      remainingPoints: newPoints
    };
  }
  
  /**
   * Check and upgrade tier
   */
  async checkTierUpgrade(customerID: string): Promise<{
    upgraded: boolean;
    newTier?: string;
    oldTier?: string;
  }> {
    const program = await this.getCustomerProgram(customerID);
    const customer = await this.getCustomerLoyalty(customerID);
    
    const currentTierIndex = program.tiers.findIndex(
      t => t.name === customer.currentTier
    );
    
    // Check if eligible for next tier
    if (currentTierIndex < program.tiers.length - 1) {
      const nextTier = program.tiers[currentTierIndex + 1];
      if (customer.lifetimePoints >= nextTier.minPoints) {
        await this.updateCustomerTier(customerID, nextTier.name);
        
        logger.info({
          customerID,
          oldTier: customer.currentTier,
          newTier: nextTier.name
        }, 'Tier upgraded');
        
        return {
          upgraded: true,
          newTier: nextTier.name,
          oldTier: customer.currentTier
        };
      }
    }
    
    return { upgraded: false };
  }
  
  /**
   * Get eligible gifts for order
   */
  async getEligibleGifts(
    orderValue: number,
    season?: string
  ): Promise<any[]> {
    const allGifts = await sheetsService.getRows('GiftsCatalog');
    
    const eligible = allGifts.filter(gift => {
      if (!gift.Active || gift.StockAvailable <= 0) return false;
      
      if (gift.GiftType === 'FreeWithOrder') {
        return orderValue >= parseFloat(gift.MinOrderValue);
      }
      
      if (gift.GiftType === 'Seasonal') {
        if (!season || gift.Season !== season) return false;
        const now = new Date();
        const start = new Date(gift.StartDate);
        const end = new Date(gift.EndDate);
        return now >= start && now <= end;
      }
      
      return false;
    });
    
    return eligible;
  }
}

export const loyaltyEngine = new LoyaltyEngine();
```

---

## 🎨 ملخص الميزات / Features Summary

### ما سيحصل عليه المستخدم:

✅ **نظام شركاء متقدم** - 7 أنواع من برامج الشراكة  
✅ **سياسات مخصصة** - لكل شريك سياساته الخاصة  
✅ **نظام ولاء متكامل** - نقاط، مستويات، مكافآت  
✅ **هدايا ذكية** - تلقائية حسب قيمة الطلب  
✅ **16 وكيل AI** - متخصص في كل مجال  
✅ **لوحات تحكم** - لكل موظف ولكل قسم  
✅ **تكامل شامل** - كل شيء متصل ببعضه  
✅ **واجهات جميلة** - UI/UX متقدمة جداً  

---

**الحالة:** 📘 دليل تقني جاهز  
**التالي:** البدء بالتنفيذ الفعلي! 🚀
