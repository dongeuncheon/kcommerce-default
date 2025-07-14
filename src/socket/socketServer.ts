import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { logger } from '../utils/logger'
import { cartEventHandler } from './handlers/cartEventHandler'
import { authMiddleware, AuthenticatedSocket } from './middleware/auth'
import { analyticsDataCollector } from '../services/analytics/analyticsDataCollector'

export class SocketServer {
  private io: SocketIOServer

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    })

    this.setupMiddleware()
    this.setupEventHandlers()
    
    // 분석 데이터 수집기에 Socket.IO 서버 설정
    analyticsDataCollector.setSocketServer(this.io)
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use((socket: any, next) => authMiddleware(socket as AuthenticatedSocket, next))
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`)

      // Join cart room based on user/session
      socket.on('join-cart', (data: { cartId?: string; userId?: string; sessionId?: string }) => {
        const { cartId, userId, sessionId } = data

        if (cartId) {
          socket.join(`cart:${cartId}`)
          logger.debug(`Socket ${socket.id} joined cart room: cart:${cartId}`)
        }

        if (userId) {
          socket.join(`user:${userId}`)
          logger.debug(`Socket ${socket.id} joined user room: user:${userId}`)
        }

        if (sessionId) {
          socket.join(`session:${sessionId}`)
          logger.debug(`Socket ${socket.id} joined session room: session:${sessionId}`)
        }

        socket.emit('cart-joined', {
          cartId,
          userId,
          sessionId,
          message: 'Successfully joined cart room',
        })
      })

      // Leave cart room
      socket.on('leave-cart', (data: { cartId?: string; userId?: string; sessionId?: string }) => {
        const { cartId, userId, sessionId } = data

        if (cartId) {
          socket.leave(`cart:${cartId}`)
          logger.debug(`Socket ${socket.id} left cart room: cart:${cartId}`)
        }

        if (userId) {
          socket.leave(`user:${userId}`)
          logger.debug(`Socket ${socket.id} left user room: user:${userId}`)
        }

        if (sessionId) {
          socket.leave(`session:${sessionId}`)
          logger.debug(`Socket ${socket.id} left session room: session:${sessionId}`)
        }
      })

      // Cart synchronization request
      socket.on('cart-sync-request', async (data: { cartId: string; lastSyncAt?: string }) => {
        try {
          await cartEventHandler.handleSyncRequest(socket as AuthenticatedSocket, data)
        } catch (error) {
          logger.error('Cart sync error:', error)
          socket.emit('cart-sync-error', {
            error: 'Failed to sync cart data',
            cartId: data.cartId,
          })
        }
      })

      // Ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong')
      })

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`)
      })

      // Error handling
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error)
      })
    })

    // Global error handler
    this.io.engine.on('connection_error', (err) => {
      logger.error('Socket.io connection error:', err)
    })
  }

  // Broadcast cart update to all relevant clients
  broadcastCartUpdate(event: {
    type: string
    cartId: string
    userId?: string
    sessionId?: string
    data: any
    timestamp: Date
  }) {
    const { cartId, userId, sessionId, ...eventData } = event

    // Broadcast to cart room
    this.io.to(`cart:${cartId}`).emit('cart-updated', eventData)

    // Broadcast to user room if userId exists
    if (userId) {
      this.io.to(`user:${userId}`).emit('cart-updated', eventData)
    }

    // Broadcast to session room if sessionId exists
    if (sessionId) {
      this.io.to(`session:${sessionId}`).emit('cart-updated', eventData)
    }

    logger.debug(`Cart event broadcasted: ${event.type} for cart ${cartId}`)
  }

  // Broadcast cart item count update
  broadcastCartItemCount(data: {
    cartId: string
    userId?: string
    sessionId?: string
    itemCount: number
  }) {
    const { cartId, userId, sessionId, itemCount } = data

    const countUpdate = {
      type: 'CART_ITEM_COUNT_UPDATED',
      cartId,
      itemCount,
      timestamp: new Date(),
    }

    // Broadcast to cart room
    this.io.to(`cart:${cartId}`).emit('cart-item-count-updated', countUpdate)

    // Broadcast to user room if userId exists
    if (userId) {
      this.io.to(`user:${userId}`).emit('cart-item-count-updated', countUpdate)
    }

    // Broadcast to session room if sessionId exists
    if (sessionId) {
      this.io.to(`session:${sessionId}`).emit('cart-item-count-updated', countUpdate)
    }

    logger.debug(`Cart item count updated: ${itemCount} for cart ${cartId}`)
  }

  // Broadcast stock warning to cart
  broadcastStockWarning(data: {
    cartId: string
    userId?: string
    sessionId?: string
    productId: string
    variantId?: string
    availableQuantity: number
    requestedQuantity: number
  }) {
    const stockWarning = {
      type: 'STOCK_WARNING',
      ...data,
      timestamp: new Date(),
    }

    // Broadcast to cart room
    this.io.to(`cart:${data.cartId}`).emit('stock-warning', stockWarning)

    // Broadcast to user room if userId exists
    if (data.userId) {
      this.io.to(`user:${data.userId}`).emit('stock-warning', stockWarning)
    }

    // Broadcast to session room if sessionId exists
    if (data.sessionId) {
      this.io.to(`session:${data.sessionId}`).emit('stock-warning', stockWarning)
    }

    logger.warn(`Stock warning broadcasted for cart ${data.cartId}: product ${data.productId}`)
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.io.engine.clientsCount
  }

  // Get clients in a specific room
  getClientsInRoom(room: string): number {
    const clients = this.io.sockets.adapter.rooms.get(room)
    return clients ? clients.size : 0
  }

  // Send message to specific user
  sendToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data)
  }

  // Send message to specific session
  sendToSession(sessionId: string, event: string, data: any) {
    this.io.to(`session:${sessionId}`).emit(event, data)
  }

  // Graceful shutdown
  close() {
    logger.info('Closing Socket.io server...')
    this.io.close()
  }
}

export let socketServer: SocketServer

export const initializeSocketServer = (server: HTTPServer): SocketServer => {
  socketServer = new SocketServer(server)
  logger.info('Socket.io server initialized')
  return socketServer
}
