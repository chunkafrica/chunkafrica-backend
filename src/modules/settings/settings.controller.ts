import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserContextGuard } from '../../common/auth/user-context.guard';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(UserContextGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('overview')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  getOverview(@CurrentUser() user: AuthUser) {
    return this.settingsService.getOverview(user);
  }

  @Get('users')
  @Roles('OWNER', 'ADMIN')
  listUsers(@CurrentUser() user: AuthUser) {
    return this.settingsService.listUsers(user);
  }

  @Get('roles')
  @Roles('OWNER', 'ADMIN')
  listRoles(@CurrentUser() user: AuthUser) {
    return this.settingsService.listRoles(user);
  }

  @Patch('users/:userId/role')
  @Roles('OWNER', 'ADMIN')
  updateUserRole(
    @CurrentUser() user: AuthUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.settingsService.updateUserRole(user, userId, dto);
  }
}
