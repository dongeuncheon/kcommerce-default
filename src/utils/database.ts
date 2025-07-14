import { PrismaClient } from '@prisma/client'
// import { logger } from './logger'

class DatabaseConnection {
  private static instance: PrismaClient | null = null

  public static getInstance(): PrismaClient {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new PrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
          {
            emit: 'event',
            level: 'error',
          },
          {
            emit: 'event',
            level: 'info',
          },
          {
            emit: 'event',
            level: 'warn',
          },
        ],
      })

      // Database logging is handled through Prisma configuration
      // Note: Prisma event listeners have strict typing that may cause issues
      // Consider using external logging configuration instead
    }

    return DatabaseConnection.instance
  }

  public static async disconnect(): Promise<void> {
    if (DatabaseConnection.instance) {
      await DatabaseConnection.instance.$disconnect()
      DatabaseConnection.instance = null
    }
  }
}

export const prisma = DatabaseConnection.getInstance()

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await DatabaseConnection.disconnect()
})

process.on('SIGINT', async () => {
  await DatabaseConnection.disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await DatabaseConnection.disconnect()
  process.exit(0)
})
