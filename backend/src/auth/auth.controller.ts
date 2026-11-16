import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentAdministrator } from './current-administrator.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { readSessionToken, SESSION_COOKIE, sessionCookieOptions } from './session-cookie';
import { SessionAdministrator } from './session-administrator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { token, expiresAt, administrator } = await this.auth.login(dto.email, dto.password);
    response.cookie(SESSION_COOKIE, token, {
      ...sessionCookieOptions(),
      expires: expiresAt,
    });
    return administrator;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(readSessionToken(request.headers.cookie)!);
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  }

  @Get('me')
  me(@CurrentAdministrator() administrator: SessionAdministrator) {
    return administrator;
  }

  @Post('change-password')
  @HttpCode(204)
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentAdministrator() administrator: SessionAdministrator,
    @Req() request: Request,
  ) {
    return this.auth.changePassword(
      administrator.id,
      dto.currentPassword,
      dto.newPassword,
      readSessionToken(request.headers.cookie)!,
    );
  }
}
