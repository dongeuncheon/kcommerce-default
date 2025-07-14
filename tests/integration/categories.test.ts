import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/index';

const prisma = new PrismaClient();

describe('Category API', () => {
  let createdCategoryId: string;
  let parentCategoryId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.category.deleteMany({
      where: {
        slug: {
          in: ['test-category', 'test-parent-category', 'test-child-category']
        }
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.category.deleteMany({
      where: {
        slug: {
          in: ['test-category', 'test-parent-category', 'test-child-category']
        }
      }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/categories', () => {
    it('should create a new category', async () => {
      const categoryData = {
        name: 'Test Category',
        slug: 'test-category',
        description: 'This is a test category',
        sortOrder: 1,
        isActive: true
      };

      const response = await request(app)
        .post('/api/v1/categories')
        .send(categoryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(categoryData.name);
      expect(response.body.data.slug).toBe(categoryData.slug);

      createdCategoryId = response.body.data.id;
    });

    it('should not create category with duplicate slug', async () => {
      const categoryData = {
        name: 'Another Test Category',
        slug: 'test-category',
        description: 'This should fail'
      };

      await request(app)
        .post('/api/v1/categories')
        .send(categoryData)
        .expect(400);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/categories')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/v1/categories', () => {
    it('should get all categories', async () => {
      const response = await request(app)
        .get('/api/v1/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should include inactive categories when requested', async () => {
      const response = await request(app)
        .get('/api/v1/categories?includeInactive=true')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('should get category by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/categories/${createdCategoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdCategoryId);
    });

    it('should return 404 for non-existent category', async () => {
      const response = await request(app)
        .get('/api/v1/categories/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/categories/slug/:slug', () => {
    it('should get category by slug', async () => {
      const response = await request(app)
        .get('/api/v1/categories/slug/test-category')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('test-category');
    });
  });

  describe('PUT /api/v1/categories/:id', () => {
    it('should update category', async () => {
      const updateData = {
        name: 'Updated Test Category',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/v1/categories/${createdCategoryId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
    });
  });

  describe('Category Hierarchy', () => {
    beforeAll(async () => {
      // Create parent category
      const parentData = {
        name: 'Test Parent Category',
        slug: 'test-parent-category',
        description: 'Parent category for testing'
      };

      const parentResponse = await request(app)
        .post('/api/v1/categories')
        .send(parentData);
      
      parentCategoryId = parentResponse.body.data.id;
    });

    it('should create child category', async () => {
      const childData = {
        name: 'Test Child Category',
        slug: 'test-child-category',
        parentId: parentCategoryId
      };

      const response = await request(app)
        .post('/api/v1/categories')
        .send(childData)
        .expect(201);

      expect(response.body.data.parentId).toBe(parentCategoryId);
    });

    it('should get category tree', async () => {
      const response = await request(app)
        .get(`/api/v1/categories/${parentCategoryId}/tree`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('children');
    });

    it('should get category breadcrumb', async () => {
      // Get child category first
      const categories = await request(app)
        .get('/api/v1/categories')
        .expect(200);

      const childCategory = categories.body.data.find((cat: any) => 
        cat.slug === 'test-child-category'
      );

      if (childCategory) {
        const response = await request(app)
          .get(`/api/v1/categories/${childCategory.id}/breadcrumb`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('GET /api/v1/categories/search', () => {
    it('should search categories', async () => {
      const response = await request(app)
        .get('/api/v1/categories/search?q=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/v1/categories/search')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/categories/reorder', () => {
    it('should reorder categories', async () => {
      const reorderData = [
        { id: createdCategoryId, sortOrder: 10 },
        { id: parentCategoryId, sortOrder: 5 }
      ];

      const response = await request(app)
        .post('/api/v1/categories/reorder')
        .send(reorderData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should not delete category with children', async () => {
      const response = await request(app)
        .delete(`/api/v1/categories/${parentCategoryId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('children');
    });

    it('should delete category without children', async () => {
      // First delete child category
      const categories = await request(app)
        .get('/api/v1/categories')
        .expect(200);

      const childCategory = categories.body.data.find((cat: any) => 
        cat.slug === 'test-child-category'
      );

      if (childCategory) {
        await request(app)
          .delete(`/api/v1/categories/${childCategory.id}`)
          .expect(200);
      }

      // Then delete parent
      const response = await request(app)
        .delete(`/api/v1/categories/${parentCategoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});