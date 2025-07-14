import { Router } from 'express';
import { categoryController } from '../controllers/categoryController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// Public routes
router.get('/', categoryController.getCategories);
router.get('/search', categoryController.searchCategories);
router.get('/tag/:tagId', categoryController.getCategoriesByTag);
router.get('/:id', categoryController.getCategoryById);
router.get('/slug/:slug', categoryController.getCategoryBySlug);
router.get('/:id/tree', categoryController.getCategoryTree);
router.get('/:id/breadcrumb', categoryController.getCategoryBreadcrumb);

// Admin routes
router.post('/', authMiddleware, categoryController.createCategory);
router.put('/:id', authMiddleware, categoryController.updateCategory);
router.delete('/:id', authMiddleware, categoryController.deleteCategory);
router.post('/reorder', authMiddleware, categoryController.reorderCategories);

export default router;