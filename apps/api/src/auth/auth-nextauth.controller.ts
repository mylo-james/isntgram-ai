import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { SignInDto } from './dto/signin.dto';
import { SignInResponseDto } from './dto/signin-response.dto';
import { DemoSignInResponseDto } from './dto/demo-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';

@UseGuards(ThrottlerGuard)
@ApiTags('Auth')
@Controller('auth')
export class AuthNextAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOkResponse({ type: SignInResponseDto })
  async signIn(@Body() credentials: SignInDto): Promise<SignInResponseDto> {
    const user = await this.authService.validateUser(
      credentials.email,
      credentials.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userDto = {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
    };

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
    });

    return {
      message: 'Sign in successful',
      user: userDto,
      accessToken,
    };
  }

  @Post('signout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MessageResponseDto })
  async signOut(): Promise<MessageResponseDto> {
    return { message: 'Sign out successful' };
  }

  @Post('demo')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DemoSignInResponseDto })
  async demo(): Promise<DemoSignInResponseDto> {
    const user = await this.authService.getOrCreateDemoUser();
    return {
      message: 'Demo sign in successful',
      user,
      isDemoUser: true,
    };
  }
}
