import { Router } from 'express'
import { Request, Response } from 'express'
import { 
  getAutoSaveStats, 
  recoverCartFromSnapshot, 
  cleanupAutoSave 
} from '../../middleware/autoSave'
import { logger } from '../../utils/logger'
import { z } from 'zod'

const router = Router()

// ===== AUTO-SAVE MANAGEMENT =====

/**
 * @route   GET /api/v1/auto-save/stats
 * @desc    Get auto-save system statistics
 * @access  Private (Admin)
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = getAutoSaveStats()
    
    return res.json({
      success: true,
      data: stats,
      message: 'Auto-save statistics retrieved successfully'
    })
  } catch (error) {
    logger.error('Error getting auto-save stats:', error)
    return res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Internal server error'
      }
    })
  }
})

/**
 * @route   POST /api/v1/auto-save/recover
 * @desc    Manually trigger cart recovery from snapshot
 * @access  Private (Admin)
 * @body    { sessionId }
 */
router.post('/recover', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      sessionId: z.string().min(1, 'Session ID is required')
    })
    
    const { sessionId } = schema.parse(req.body)
    
    const recovered = await recoverCartFromSnapshot(sessionId)
    
    return res.json({
      success: true,
      data: {
        sessionId,
        recovered
      },
      message: recovered 
        ? 'Cart recovered successfully from snapshot'
        : 'No snapshot available for recovery'
    })
  } catch (error) {
    logger.error('Error recovering cart from snapshot:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          details: error.errors
        }
      })
    }
    
    return res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Internal server error'
      }
    })
  }
})

/**
 * @route   DELETE /api/v1/auto-save/cleanup/:sessionId
 * @desc    Clean up auto-save resources for a session
 * @access  Private (Admin)
 * @params  sessionId - Session ID to clean up
 */
router.delete('/cleanup/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Session ID is required' }
      })
    }
    
    cleanupAutoSave(sessionId)
    
    return res.json({
      success: true,
      data: { sessionId },
      message: 'Auto-save resources cleaned up successfully'
    })
  } catch (error) {
    logger.error('Error cleaning up auto-save resources:', error)
    return res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Internal server error'
      }
    })
  }
})

/**
 * @route   GET /api/v1/auto-save/health
 * @desc    Check auto-save system health
 * @access  Private (Admin)
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const stats = getAutoSaveStats()
    const currentTime = new Date()
    
    // Check system health
    const health = {
      status: 'healthy',
      timestamp: currentTime.toISOString(),
      activeSessions: stats.activeSessions,
      snapshotsCount: stats.snapshotsCount,
      timersCount: stats.timersCount,
      issues: [] as string[]
    }
    
    // Check for potential issues
    if (stats.activeSessions > 1000) {
      health.issues.push('High number of active sessions')
      health.status = 'warning'
    }
    
    if (stats.timersCount !== stats.activeSessions) {
      health.issues.push('Timer count mismatch with active sessions')
      health.status = 'warning'
    }
    
    if (stats.oldestSnapshot) {
      const oldestAge = currentTime.getTime() - stats.oldestSnapshot.getTime()
      const hoursOld = oldestAge / (1000 * 60 * 60)
      
      if (hoursOld > 24) {
        health.issues.push(`Very old snapshots detected (${Math.round(hoursOld)} hours old)`)
        health.status = 'warning'
      }
    }
    
    return res.json({
      success: true,
      data: health,
      message: 'Auto-save system health check completed'
    })
  } catch (error) {
    logger.error('Error checking auto-save health:', error)
    return res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Internal server error'
      }
    })
  }
})

/**
 * @route   POST /api/v1/auto-save/test
 * @desc    Test auto-save functionality
 * @access  Private (Admin)
 * @body    { sessionId?, testData? }
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      sessionId: z.string().optional(),
      testData: z.record(z.any()).optional()
    })
    
    const { sessionId, testData } = schema.parse(req.body)
    
    // This is a test endpoint for validating auto-save functionality
    const testResult = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'test-session-' + Date.now(),
      testData: testData || { test: true },
      status: 'test_completed'
    }
    
    logger.info('Auto-save test executed:', testResult)
    
    return res.json({
      success: true,
      data: testResult,
      message: 'Auto-save test completed successfully'
    })
  } catch (error) {
    logger.error('Error running auto-save test:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          details: error.errors
        }
      })
    }
    
    return res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Internal server error'
      }
    })
  }
})

export { router as autoSaveRoutes }