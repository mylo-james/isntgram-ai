import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthLoginResponseDto,
  AuthRegisterResponseDto,
} from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiCreatedResponse({ type: AuthRegisterResponseDto })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    return {
      message: 'User registered successfully',
      user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
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
}
