import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'

export interface NotificationPayload {
  type: 'document_uploaded' | 'document_validated' | 'document_rejected' | 'document_shared' | 'document_archived'
  documentId?: string
  documentTitre?: string
  message: string
  filialeId?: string | null
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:5175', credentials: true },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server
  private readonly logger = new Logger(NotificationsGateway.name)

  handleConnection(client: Socket) {
    const filialeId = client.handshake.query['filialeId'] as string | undefined
    if (filialeId) {
      client.join(`filiale:${filialeId}`)
    }
    client.join('global')
    this.logger.debug(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`)
  }

  notifyFiliale(filialeId: string, payload: NotificationPayload) {
    this.server.to(`filiale:${filialeId}`).emit('notification', payload)
  }

  notifyAll(payload: NotificationPayload) {
    this.server.to('global').emit('notification', payload)
  }
}
