import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

/**
 * Roles 메타데이터 키
 */
export const ROLES_KEY = 'roles';

/**
 * Roles 데코레이터
 *
 * 특정 역할을 가진 사용자만 접근할 수 있도록 엔드포인트를 보호합니다.
 * RolesGuard와 함께 사용됩니다.
 *
 * @param roles - 허용할 역할 목록
 *
 * @example 단일 역할
 * ```typescript
 * @Roles(Role.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Delete('users/:id')
 * deleteUser(@Param('id') id: string) {
 *   return this.usersService.delete(id);
 * }
 * ```
 *
 * @example 다중 역할
 * ```typescript
 * @Roles(Role.ADMIN, Role.SELLER)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Post('products')
 * createProduct(@Body() dto: CreateProductDto) {
 *   return this.productsService.create(dto);
 * }
 * ```
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
