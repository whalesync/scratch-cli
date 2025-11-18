import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/audit/audit-log.module';
import { DbModule } from 'src/db/db.module';
import { PaymentModule } from 'src/payment/payment.module';
import { ConnectorAccountModule } from 'src/remote-service/connector-account/connector-account.module';
import { UploadsModule } from 'src/uploads/uploads.module';
import { UserModule } from 'src/users/users.module';
import { WorkbookModule } from 'src/workbook/workbook.module';
import { DevToolsController } from './dev-tools.controller';
import { DevToolsService } from './dev-tools.service';

@Module({
  providers: [DevToolsService],
  imports: [DbModule, UserModule, PaymentModule, WorkbookModule, ConnectorAccountModule, AuditLogModule, UploadsModule],
  exports: [], //export this service to use in other modules
  controllers: [DevToolsController],
})
export class DevToolsModule {}
