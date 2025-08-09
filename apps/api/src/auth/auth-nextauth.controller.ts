import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('api/auth')
export class AuthNextAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() credentials: { email: string; password: string },
    @Res() res: Response,
  ) {
    const user = await this.authService.validateUser(
      credentials.email,
      credentials.password,
    );

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials',
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashedPassword, ...userWithoutPassword } = user;

    return res.json({
      message: 'Sign in successful',
      user: userWithoutPassword,
    });
  }

  @Post('signout')
  @HttpCode(HttpStatus.OK)
  async signOut(@Res() res: Response) {
    return res.json({
      message: 'Sign out successful',
    });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto, @Res() res: Response) {
    const user = await this.authService.register(registerDto);

    return res.json({
      message: 'User registered successfully',
      user,
    });
  }
}
