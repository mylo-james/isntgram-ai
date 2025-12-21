import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthLoginResponseDto,
  AuthRegisterResponseDto,
  AuthLogoutResponseDto,
} from './dto/auth-response.dto';
import { JwtAuthGuard } from './jwt.guard';
import { AuthUser } from './jwt.types';
import { Request } from 'express';

const ONE_MINUTE_MS = 60_000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: ONE_MINUTE_MS } })
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: AuthRegisterResponseDto })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    return {
      message: 'User registered successfully',
      user,
    };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: ONE_MINUTE_MS } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthLoginResponseDto })
  async login(@Body() body: LoginDto) {
    const { user, accessToken } = await this.authService.login(
      body.email,
      body.password,
    );
    return {
      message: 'Login successful',
      user,
      accessToken,
    };
  }

  @Post('demo')
  @Throttle({ default: { limit: 2, ttl: ONE_MINUTE_MS } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthLoginResponseDto })
  async demo() {
    const demoEnabled =
      this.configService.get<string>('DEMO_ENABLED') === 'true';
    if (!demoEnabled) {
      throw new ForbiddenException('Demo mode disabled');
    }

    const user = await this.authService.getOrCreateDemoUser();
    const demoPassword =
      this.configService.get<string>('DEMO_PASSWORD') || 'demo';
    const login = await this.authService.login(user.email, demoPassword);

    return {
      message: 'Demo sign in successful',
      user: login.user,
      accessToken: login.accessToken,
      isDemoUser: true,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: ONE_MINUTE_MS } })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthLogoutResponseDto })
  async logout(@Req() req: Request & { user: AuthUser }) {
    await this.authService.revokeUserTokens(req.user.userId);
    return { message: 'Logged out' };
  }
}
