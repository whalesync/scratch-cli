import { Module } from '@nestjs/common';
import { AgentCredentialsModule } from 'src/agent-credentials/agent-credentials.module';
import { AuditLogModule } from 'src/audit/audit-log.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { PaymentModule } from 'src/payment/payment.module';
import { ConnectorAccountModule } from 'src/remote-service/connector-account/connector-account.module';
import { UserModule } from 'src/users/users.module';
import { WorkbookModule } from 'src/workbook/workbook.module';
import { WorkerEnqueuerModule } from 'src/worker-enqueuer/worker-enqueuer.module';
import { DevToolsController } from './dev-tools.controller';
import { DevToolsService } from './dev-tools.service';

@Module({
  providers: [DevToolsService],
  imports: [
    ScratchpadConfigModule,
    DbModule,
    UserModule,
    PaymentModule,
    WorkbookModule,
    WorkerEnqueuerModule,
    ConnectorAccountModule,
    AuditLogModule,
    AgentCredentialsModule,
  ],
  exports: [], //export this service to use in other modules
  controllers: [DevToolsController],
})
export class DevToolsModule {}
