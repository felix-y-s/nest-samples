import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * 역할 기반 접근 제어 가드 (RBAC)
 *
 * @Roles() 데코레이터로 지정된 역할을 가진 사용자만 접근을 허용합니다.
 * JwtAuthGuard와 함께 사용하여 인증 + 권한 검사를 수행합니다.
 *
 * @example
 * ```typescript
 * @Roles(Role.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('admin/dashboard')
 * getAdminDashboard() {
 *   return this.dashboardService.getAdminData();
 * }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * 사용자 역할 검증
   *
   * @param context - 실행 컨텍스트
   * @returns 접근 허용 여부
   * @throws ForbiddenException - 권한이 없는 경우
   */
  canActivate(context: ExecutionContext): boolean {
    // @Roles() 데코레이터에서 요구하는 역할 목록 가져오기
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles() 데코레이터가 없으면 접근 허용
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // HTTP 요청에서 사용자 정보 가져오기
    const request = context.switchToHttp().getRequest();
    /**
     * 🚨 주의: 실제 운영환경에서는 role정보를 jwt 토큰에서 가져와야 합니다.
     */
    const user = request.body.user;

    // 사용자 역할이 요구되는 역할 목록에 포함되어 있는지 확인
    const hasRole = requiredRoles.includes(user.role as Role);

    if (!hasRole) {
      throw new ForbiddenException('이 작업을 수행할 권한이 없습니다');
    }

    return true;
  }
}