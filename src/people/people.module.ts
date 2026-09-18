import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InvitationsController } from './invitations.controller.js';
import { PeopleController } from './people.controller.js';
import { PeopleService } from './people.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PeopleController, InvitationsController],
  providers: [PeopleService],
})
export class PeopleModule {}
