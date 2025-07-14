import { PrismaClient } from '@prisma/client';
import { CategoryService } from '../../../src/services/categoryService';

// Mock Prisma Client
jest.mock('@prisma/client');
const mockPrisma = {
  category: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  product: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('CategoryService', () => {
  let categoryService: CategoryService;

  beforeEach(() => {
    categoryService = new CategoryService();
    // Replace the prisma instance in the service with our mock
    (categoryService as any).prisma = mockPrisma;
    jest.clearAllMocks();
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      const categoryData = {
        name: 'Test Category',
        slug: 'test-category',
        description: 'Test description',
      };

      const expectedCategory = {
        id: '1',
        ...categoryData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.category.create.mockResolvedValue(expectedCategory);

      const result = await categoryService.createCategory(categoryData);

      expect(mockPrisma.category.create).toHaveBeenCalledWith({
        data: categoryData,
        include: {
          parent: true,
          children: true,
        },
      });
      expect(result).toEqual(expectedCategory);
    });

    it('should handle creation errors', async () => {
      const categoryData = {
        name: 'Test Category',
        slug: 'test-category',
      };

      const error = new Error('Database error');
      mockPrisma.category.create.mockRejectedValue(error);

      await expect(categoryService.createCategory(categoryData)).rejects.toThrow('Database error');
    });
  });

  describe('getAllCategories', () => {
    it('should return all active categories by default', async () => {
      const mockCategories = [
        {
          id: '1',
          name: 'Category 1',
          slug: 'category-1',
          isActive: true,
          children: [],
        },
        {
          id: '2',
          name: 'Category 2',
          slug: 'category-2',
          isActive: true,
          children: [],
        },
      ];

      mockPrisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await categoryService.getAllCategories();

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should include inactive categories when requested', async () => {
      const mockCategories = [
        {
          id: '1',
          name: 'Category 1',
          slug: 'category-1',
          isActive: true,
          children: [],
        },
        {
          id: '2',
          name: 'Category 2',
          slug: 'category-2',
          isActive: false,
          children: [],
        },
      ];

      mockPrisma.category.findMany.mockResolvedValue(mockCategories);

      await categoryService.getAllCategories(true);

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          children: {
            where: {},
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('getCategoryById', () => {
    it('should return category by ID', async () => {
      const mockCategory = {
        id: '1',
        name: 'Test Category',
        slug: 'test-category',
        parent: null,
        children: [],
        products: [],
      };

      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);

      const result = await categoryService.getCategoryById('1');

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          products: {
            where: { status: 'PUBLISHED' },
            take: 10,
          },
        },
      });
      expect(result).toEqual(mockCategory);
    });

    it('should return null for non-existent category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const result = await categoryService.getCategoryById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateCategory', () => {
    it('should update category successfully', async () => {
      const updateData = {
        name: 'Updated Category',
        description: 'Updated description',
      };

      const updatedCategory = {
        id: '1',
        ...updateData,
        slug: 'test-category',
      };

      mockPrisma.category.update.mockResolvedValue(updatedCategory);

      const result = await categoryService.updateCategory('1', updateData);

      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
        include: {
          parent: true,
          children: true,
        },
      });
      expect(result).toEqual(updatedCategory);
    });

    it('should validate parent category when updating parentId', async () => {
      const updateData = { parentId: '2' };

      // Mock getCategoryById for parent validation
      const mockParent = {
        id: '2',
        name: 'Parent Category',
        parentId: null,
      };

      mockPrisma.category.findUnique.mockResolvedValue(mockParent);
      mockPrisma.category.update.mockResolvedValue({});

      await categoryService.updateCategory('1', updateData);

      // Should call findUnique to validate parent
      expect(mockPrisma.category.findUnique).toHaveBeenCalled();
    });
  });

  describe('deleteCategory', () => {
    it('should delete category without children or products', async () => {
      mockPrisma.category.count.mockResolvedValueOnce(0); // No children
      mockPrisma.product.count.mockResolvedValueOnce(0); // No products
      mockPrisma.category.delete.mockResolvedValue({});

      await categoryService.deleteCategory('1');

      expect(mockPrisma.category.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should not delete category with children', async () => {
      mockPrisma.category.count.mockResolvedValueOnce(1); // Has children

      await expect(categoryService.deleteCategory('1')).rejects.toThrow(
        'Cannot delete category with children'
      );

      expect(mockPrisma.category.delete).not.toHaveBeenCalled();
    });

    it('should not delete category with products', async () => {
      mockPrisma.category.count.mockResolvedValueOnce(0); // No children
      mockPrisma.product.count.mockResolvedValueOnce(1); // Has products

      await expect(categoryService.deleteCategory('1')).rejects.toThrow(
        'Cannot delete category with products'
      );

      expect(mockPrisma.category.delete).not.toHaveBeenCalled();
    });
  });

  describe('searchCategories', () => {
    it('should search categories by name and description', async () => {
      const mockCategories = [
        {
          id: '1',
          name: 'Electronics',
          slug: 'electronics',
          description: 'Electronic devices',
        },
      ];

      mockPrisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await categoryService.searchCategories('electronic');

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'electronic', mode: 'insensitive' } },
            { description: { contains: 'electronic', mode: 'insensitive' } },
          ],
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(mockCategories);
    });
  });

  describe('reorderCategories', () => {
    it('should reorder categories using transaction', async () => {
      const updates = [
        { id: '1', sortOrder: 10 },
        { id: '2', sortOrder: 20 },
      ];

      mockPrisma.$transaction.mockResolvedValue([]);

      await categoryService.reorderCategories(updates);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('getCategoryBreadcrumb', () => {
    it('should build breadcrumb trail', async () => {
      const childCategory = {
        id: '3',
        name: 'Child Category',
        parentId: '2',
      };

      const parentCategory = {
        id: '2',
        name: 'Parent Category',
        parentId: '1',
      };

      const rootCategory = {
        id: '1',
        name: 'Root Category',
        parentId: null,
      };

      mockPrisma.category.findUnique
        .mockResolvedValueOnce(childCategory)
        .mockResolvedValueOnce(parentCategory)
        .mockResolvedValueOnce(rootCategory);

      const result = await categoryService.getCategoryBreadcrumb('3');

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Root Category');
      expect(result[1].name).toBe('Parent Category');
      expect(result[2].name).toBe('Child Category');
    });
  });
});