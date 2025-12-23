import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

describe('Auth DTO validation + transforms', () => {
  it('normalizes login payloads and validates', async () => {
    const dto = plainToInstance(LoginDto, {
      email: '  TEST@Example.COM ',
      password: 'Password123!',
    });

    expect(dto.email).toBe('test@example.com');

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes through non-string login values and surfaces validation errors', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 123,
      password: 456,
    });

    expect(dto.email).toBe(123);

    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('normalizes register payloads and validates', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: '  NEW@Example.COM ',
      username: '  New_User ',
      fullName: '  Jane Doe  ',
      password: 'Password123!',
    });

    expect(dto.email).toBe('new@example.com');
    expect(dto.username).toBe('new_user');
    expect(dto.fullName).toBe('Jane Doe');

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes through non-string register values and surfaces validation errors', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 123,
      username: 456,
      fullName: 789,
      password: 101112,
    });

    expect(dto.username).toBe(456);

    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['email', 'username', 'fullName', 'password']),
    );
  });
});
