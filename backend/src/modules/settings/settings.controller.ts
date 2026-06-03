import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { SettingsService } from './settings.service';
import { SetSettingDto, SettingResponseDto, BulkSetSettingsDto } from './dto/settings.dto';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  @ApiResponse({ status: 200, type: [SettingResponseDto] })
  async getAllSettings(@CurrentUser() user: User, @Query('category') category?: string) {
    // Get user's specific settings, falling back to global settings when needed
    return this.settingsService.getAll(user.id, category);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get setting by key' })
  @ApiResponse({ status: 200, type: SettingResponseDto })
  async getSetting(
    @CurrentUser() user: User,
    @Param('key') key: string,
    @Query('defaultValue') defaultValue?: string,
  ) {
    const value = await this.settingsService.get(key, user.id, defaultValue);
    return { key, value };
  }

  @Post()
  @ApiOperation({ summary: 'Set or update a setting' })
  @ApiResponse({
    status: 201,
    description: 'Setting created/updated successfully',
  })
  async setSetting(@CurrentUser() user: User, @Body() setSettingDto: SetSettingDto) {
    await this.settingsService.set(
      setSettingDto.key,
      setSettingDto.value,
      user.id, // Associate the setting with the current user
      setSettingDto.description,
      setSettingDto.category,
      setSettingDto.isEncrypted,
    );
    return { message: 'Setting updated successfully' };
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Set or update multiple settings at once' })
  @ApiResponse({
    status: 201,
    description: 'Settings created/updated successfully',
  })
  async bulkSetSettings(@CurrentUser() user: User, @Body() bulkSetSettingsDto: BulkSetSettingsDto) {
    await this.settingsService.bulkSet(bulkSetSettingsDto.settings, user.id);
    return { message: 'Settings updated successfully' };
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a setting' })
  @ApiResponse({ status: 200, description: 'Setting deleted successfully' })
  async deleteSetting(@CurrentUser() user: User, @Param('key') key: string) {
    await this.settingsService.delete(key, user.id);
    return { message: 'Setting deleted successfully' };
  }

  /** 获取或生成用户 API Key（用于第三方App接入） */
  @Get('api-key/my')
  async getApiKey(@CurrentUser() user: User) {
    const existing = await this.settingsService.get('user_api_key', user.id);
    if (existing) return { apiKey: existing, regenerated: false };
    // 自动生成唯一Key
    const key = 'tsk_' + crypto.randomBytes(16).toString('hex');
    await this.settingsService.set(
      'user_api_key',
      key,
      user.id,
      'OpenAI-compatible API key',
      'api_key',
      false,
    );
    return { apiKey: key, regenerated: true };
  }

  /** 重新生成 API Key */
  @Post('api-key/regenerate')
  async regenerateApiKey(@CurrentUser() user: User) {
    const key = 'tsk_' + crypto.randomBytes(16).toString('hex');
    await this.settingsService.set(
      'user_api_key',
      key,
      user.id,
      'OpenAI-compatible API key',
      'api_key',
      false,
    );
    return { apiKey: key };
  }
}
