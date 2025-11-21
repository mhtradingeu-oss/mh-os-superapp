User
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String?
  phone     String?
  role      Role     @default(USER)
  status    String?  // active - suspended - deleted

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  reps              SalesRepProfile?
  dealer            DealerProfile?
  partner           PartnerProfile?
  affiliate         AffiliateProfile?
  loyaltyAccount    LoyaltyAccount?
  activities        ActivityLog[]
  notifications     Notification[]
}

Role
enum Role {
  SUPERADMIN
  ADMIN
  MANAGER
  SALES_REP
  DEALER
  DISTRIBUTOR
  PARTNER
  STAND_PARTNER
  AFFILIATE
  CUSTOMER
  USER
}

⚡ 2. BRAND SYSTEM
Brand
model Brand {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?

  categories   BrandCategory[]
  products     BrandProduct[]
  identity     BrandIdentity?
  rules        BrandRules?
  pricing      BrandPricing?
  aiConfig     BrandAIConfig?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

⚡ 3. PRODUCT SYSTEM
BrandProduct
model BrandProduct {
  id             String        @id @default(cuid())
  name           String
  slug           String        @unique
  description    String?
  price          Float
  imageUrl       String?

  brandId        String
  brand          Brand         @relation(fields: [brandId], references: [id])

  categoryId     String?
  category       BrandCategory? @relation(fields: [categoryId], references: [id])

  sku            String        @unique
  upc            String?
  line           String?
  status         String?
  weightGrams    Float?
  netContentMl   Float?
  unitsPerCarton Int?
  qrUrl          String?

  pricing        ProductPricing?
  competitors    CompetitorPrice[]
  drafts         ProductPriceDraft[]
  aiHistory      AIPricingHistory[]
  aiLearning     AILearningJournal[]

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

BrandCategory
model BrandCategory {
  id      String   @id @default(cuid())
  name    String
  slug    String   @unique
  brandId String
  brand   Brand    @relation(fields: [brandId], references: [id])

  products BrandProduct[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

⚡ 4. PRICING SYSTEM
ProductPricing
model ProductPricing {
  id                    String       @id @default(cuid())
  productId             String       @unique
  product               BrandProduct @relation(fields: [productId], references: [id])

  factoryPriceUnit        Float?
  totalFactoryPriceCarton Float?
  eprLucidPerUnit         Float?
  shippingInboundPerUnit  Float?
  gs1PerUnit              Float?
  retailPackagingPerUnit  Float?
  qcPifPerUnit            Float?
  operationsPerUnit       Float?
  marketingPerUnit        Float?
  cogsEur                 Float?
  fullCostEur             Float?
  uvpNet                  Float?
  uvpInc                  Float?
  map                     Float?
  grundpreis              String?
  vatPct                  Float?
  b2cStoreNet             Float?
  b2cStoreInc             Float?
  b2cMarginPct            Float?
  amazonTierKey           String?
  amazonNet               Float?
  amazonInc               Float?
  amazonMarginPct         Float?
  dealerBasicNet          Float?
  dealerPlusNet           Float?
  standPartnerNet         Float?
  distributorNet          Float?

  updatedAt               DateTime @updatedAt
  createdAt               DateTime @default(now())
}

⚡ 5. COMPETITOR INTELLIGENCE
CompetitorPrice
model CompetitorPrice {
  id          String        @id @default(cuid())
  productId   String
  product     BrandProduct  @relation(fields: [productId], references: [id])

  competitor  String
  url         String?
  price       Float
  currency    String?
  source      String?   // Amazon, Google Shopping, Website
  confidence  Float?     // AI confidence %

  createdAt   DateTime @default(now())
}

⚡ 6. AI ENGINE
AIPricingHistory
model AIPricingHistory {
  id            String       @id @default(cuid())
  productId     String
  product       BrandProduct @relation(fields: [productId], references: [id])

  channel       String
  oldPrice      Float?
  newPrice      Float?
  changePct     Float?
  decision      String?
  reasoning     String?  // AI narrative
  confidence    Float?

  createdAt DateTime @default(now())
}

AILearningJournal
model AILearningJournal {
  id            String       @id @default(cuid())
  productId     String
  product       BrandProduct @relation(fields: [productId], references: [id])

  eventType     String
  inputData     Json
  outputData    Json
  result        String?
  effectiveness Float?    // AI self-evaluation
  notes         String?

  createdAt DateTime @default(now())
}

⚡ 7. SALES REP OS
SalesRepProfile
model SalesRepProfile {
  id        String  @id @default(cuid())
  userId    String  @unique
  user      User    @relation(fields: [userId], references: [id])

  region    String?
  target    Float?
  achieved  Float?

  clients   CRMClient[]
  visits    RepVisit[]
  quotes    SalesQuote[]
}

⚡ 8. CRM SYSTEM
CRMClient
model CRMClient {
  id         String   @id @default(cuid())
  name       String
  email      String?
  phone      String?
  source     String?  // Instagram, Website, TikTok, Dealer, Stand
  status     String?  // Lead, Prospect, Customer
  stage      String?  // Lead stages

  repId      String?
  rep        SalesRepProfile? @relation(fields: [repId], references: [id])

  interactions  CRMInteraction[]
  orders        Order[]

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

⚡ 9. ORDER SYSTEM
Order
model Order {
  id         String  @id @default(cuid())
  clientId   String?
  client     CRMClient? @relation(fields: [clientId], references: [id])

  type       String   // rep, dealer, stand, affiliate, online
  total      Float?
  status     String?
  items      OrderItem[]

  createdAt DateTime @default(now())
}

OrderItem
model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  productId String

  quantity  Int
  price     Float

  order     Order        @relation(fields: [orderId], references: [id])
  product   BrandProduct @relation(fields: [productId], references: [id])
}

⚡ 10. LOYALTY OS
LoyaltyAccount
model LoyaltyAccount {
  id        String  @id @default(cuid())
  userId    String  @unique
  points    Int     @default(0)
  level     String? // Silver, Gold, Platinum

  history   LoyaltyTransaction[]
}
