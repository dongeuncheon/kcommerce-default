import { PrismaClient, UserRole, ProductStatus, ProductType } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create admin users
  const hashedAdminPassword = await bcrypt.hash('admin123', 12)
  const hashedUserPassword = await bcrypt.hash('user123', 12)
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      password: hashedAdminPassword,
      role: UserRole.ADMIN,
      isActive: true,
      isVerified: true,
    },
  })

  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      firstName: 'Regular',
      lastName: 'User',
      password: hashedUserPassword,
      role: UserRole.USER,
      isActive: true,
      isVerified: true,
    },
  })

  console.log('✅ Admin user created:', adminUser.email)
  console.log('✅ Regular user created:', regularUser.email)

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'electronics' },
      update: {},
      create: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices and gadgets',
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'clothing' },
      update: {},
      create: {
        name: 'Clothing',
        slug: 'clothing',
        description: 'Fashion and apparel',
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'books' },
      update: {},
      create: {
        name: 'Books',
        slug: 'books',
        description: 'Books and literature',
        sortOrder: 3,
      },
    }),
  ])

  console.log('✅ Categories created:', categories.length)

  // Create subcategories
  const subcategories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'smartphones' },
      update: {},
      create: {
        name: 'Smartphones',
        slug: 'smartphones',
        description: 'Mobile phones and accessories',
        parentId: categories[0].id,
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'laptops' },
      update: {},
      create: {
        name: 'Laptops',
        slug: 'laptops',
        description: 'Portable computers',
        parentId: categories[0].id,
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 't-shirts' },
      update: {},
      create: {
        name: 'T-Shirts',
        slug: 't-shirts',
        description: 'Casual t-shirts',
        parentId: categories[1].id,
        sortOrder: 1,
      },
    }),
  ])

  console.log('✅ Subcategories created:', subcategories.length)

  // Create tags
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { slug: 'bestseller' },
      update: {},
      create: { name: 'Bestseller', slug: 'bestseller' },
    }),
    prisma.tag.upsert({
      where: { slug: 'new-arrival' },
      update: {},
      create: { name: 'New Arrival', slug: 'new-arrival' },
    }),
    prisma.tag.upsert({
      where: { slug: 'sale' },
      update: {},
      create: { name: 'Sale', slug: 'sale' },
    }),
    prisma.tag.upsert({
      where: { slug: 'premium' },
      update: {},
      create: { name: 'Premium', slug: 'premium' },
    }),
  ])

  console.log('✅ Tags created:', tags.length)

  // Create sample products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { slug: 'iphone-15-pro' },
      update: {},
      create: {
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        description: 'Latest iPhone with Pro features',
        shortDescription: 'Premium smartphone with advanced camera system',
        sku: 'IPH15PRO001',
        status: ProductStatus.PUBLISHED,
        type: ProductType.VARIABLE,
        price: 999.00,
        comparePrice: 1099.00,
        costPrice: 650.00,
        quantity: 50,
        lowStockThreshold: 5,
        weight: 0.221,
        metaTitle: 'iPhone 15 Pro - Premium Smartphone',
        metaDescription: 'Experience the latest iPhone 15 Pro with advanced features',
        isFeatured: true,
        categoryId: subcategories[0].id,
        publishedAt: new Date(),
        images: {
          create: [
            {
              url: '/images/iphone-15-pro-main.jpg',
              alt: 'iPhone 15 Pro main image',
              isMain: true,
              sortOrder: 1,
            },
            {
              url: '/images/iphone-15-pro-side.jpg',
              alt: 'iPhone 15 Pro side view',
              sortOrder: 2,
            },
          ],
        },
        variants: {
          create: [
            {
              name: 'iPhone 15 Pro 128GB Natural Titanium',
              sku: 'IPH15PRO128NT',
              price: 999.00,
              quantity: 20,
              attributes: {
                storage: '128GB',
                color: 'Natural Titanium',
              },
            },
            {
              name: 'iPhone 15 Pro 256GB Natural Titanium',
              sku: 'IPH15PRO256NT',
              price: 1099.00,
              quantity: 15,
              attributes: {
                storage: '256GB',
                color: 'Natural Titanium',
              },
            },
          ],
        },
        attributes: {
          create: [
            { name: 'Brand', value: 'Apple' },
            { name: 'Operating System', value: 'iOS 17' },
            { name: 'Display Size', value: '6.1 inches' },
          ],
        },
        tags: {
          create: [
            { tagId: tags[0].id }, // Bestseller
            { tagId: tags[1].id }, // New Arrival
            { tagId: tags[3].id }, // Premium
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { slug: 'macbook-air-m3' },
      update: {},
      create: {
        name: 'MacBook Air M3',
        slug: 'macbook-air-m3',
        description: 'Powerful and lightweight laptop with M3 chip',
        shortDescription: 'Ultra-thin laptop with exceptional performance',
        sku: 'MBA-M3-001',
        status: ProductStatus.PUBLISHED,
        type: ProductType.SIMPLE,
        price: 1299.00,
        comparePrice: 1399.00,
        costPrice: 900.00,
        quantity: 25,
        lowStockThreshold: 3,
        weight: 1.24,
        metaTitle: 'MacBook Air M3 - Powerful Laptop',
        metaDescription: 'Experience the new MacBook Air with M3 chip',
        isFeatured: true,
        categoryId: subcategories[1].id,
        publishedAt: new Date(),
        images: {
          create: [
            {
              url: '/images/macbook-air-m3-main.jpg',
              alt: 'MacBook Air M3 main image',
              isMain: true,
              sortOrder: 1,
            },
          ],
        },
        attributes: {
          create: [
            { name: 'Brand', value: 'Apple' },
            { name: 'Processor', value: 'M3 Chip' },
            { name: 'RAM', value: '8GB' },
            { name: 'Storage', value: '256GB SSD' },
          ],
        },
        tags: {
          create: [
            { tagId: tags[1].id }, // New Arrival
            { tagId: tags[3].id }, // Premium
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { slug: 'premium-cotton-tshirt' },
      update: {},
      create: {
        name: 'Premium Cotton T-Shirt',
        slug: 'premium-cotton-tshirt',
        description: 'High-quality 100% organic cotton t-shirt',
        shortDescription: 'Comfortable and sustainable t-shirt',
        sku: 'TSH-PREM-001',
        status: ProductStatus.PUBLISHED,
        type: ProductType.VARIABLE,
        price: 29.99,
        comparePrice: 39.99,
        costPrice: 15.00,
        quantity: 100,
        lowStockThreshold: 10,
        weight: 0.2,
        metaTitle: 'Premium Cotton T-Shirt - Organic & Comfortable',
        metaDescription: 'Sustainable and comfortable organic cotton t-shirt',
        categoryId: subcategories[2].id,
        publishedAt: new Date(),
        images: {
          create: [
            {
              url: '/images/tshirt-white-main.jpg',
              alt: 'Premium cotton t-shirt white',
              isMain: true,
              sortOrder: 1,
            },
          ],
        },
        variants: {
          create: [
            {
              name: 'Premium Cotton T-Shirt White M',
              sku: 'TSH-PREM-WHT-M',
              price: 29.99,
              quantity: 25,
              attributes: {
                color: 'White',
                size: 'M',
              },
            },
            {
              name: 'Premium Cotton T-Shirt White L',
              sku: 'TSH-PREM-WHT-L',
              price: 29.99,
              quantity: 30,
              attributes: {
                color: 'White',
                size: 'L',
              },
            },
            {
              name: 'Premium Cotton T-Shirt Black M',
              sku: 'TSH-PREM-BLK-M',
              price: 29.99,
              quantity: 20,
              attributes: {
                color: 'Black',
                size: 'M',
              },
            },
          ],
        },
        attributes: {
          create: [
            { name: 'Material', value: '100% Organic Cotton' },
            { name: 'Care Instructions', value: 'Machine wash cold' },
            { name: 'Origin', value: 'Made in USA' },
          ],
        },
        tags: {
          create: [
            { tagId: tags[2].id }, // Sale
          ],
        },
      },
    }),
  ])

  console.log('✅ Products created:', products.length)

  // Create coupons
  const coupons = await Promise.all([
    prisma.coupon.upsert({
      where: { code: 'WELCOME10' },
      update: {},
      create: {
        code: 'WELCOME10',
        name: 'Welcome Discount',
        description: '10% off for new customers',
        type: 'PERCENTAGE',
        value: 10.00,
        usageLimit: 1000,
        minOrderValue: 50.00,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    }),
    prisma.coupon.upsert({
      where: { code: 'FREESHIP' },
      update: {},
      create: {
        code: 'FREESHIP',
        name: 'Free Shipping',
        description: 'Free shipping on all orders',
        type: 'FREE_SHIPPING',
        value: 0.00,
        usageLimit: 500,
        minOrderValue: 100.00,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      },
    }),
  ])

  console.log('✅ Coupons created:', coupons.length)

  // Create system settings
  const settings = await Promise.all([
    prisma.setting.upsert({
      where: { key: 'site_name' },
      update: {},
      create: {
        key: 'site_name',
        value: 'Commerce Base Plugin',
        category: 'general',
        isPublic: true,
      },
    }),
    prisma.setting.upsert({
      where: { key: 'default_currency' },
      update: {},
      create: {
        key: 'default_currency',
        value: 'USD',
        category: 'general',
        isPublic: true,
      },
    }),
    prisma.setting.upsert({
      where: { key: 'tax_rate' },
      update: {},
      create: {
        key: 'tax_rate',
        value: 8.25,
        category: 'tax',
        isPublic: false,
      },
    }),
    prisma.setting.upsert({
      where: { key: 'shipping_rates' },
      update: {},
      create: {
        key: 'shipping_rates',
        value: {
          standard: 5.99,
          express: 12.99,
          overnight: 24.99,
        },
        category: 'shipping',
        isPublic: true,
      },
    }),
  ])

  console.log('✅ Settings created:', settings.length)

  console.log('🎉 Database seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })