import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { AddressesController } from './addresses.controller';
import { CustomersService } from './customers.service';
import { AddressesService } from './addresses.service';

@Module({
  controllers: [CustomersController, AddressesController],
  providers: [CustomersService, AddressesService],
  exports: [CustomersService],
})
export class CustomersModule {}
