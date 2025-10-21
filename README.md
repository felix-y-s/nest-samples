# NestJs Samples Workspace
nestjs 샘플 프로젝트를 위한 workspace입니다.

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project 추가
```bash
$ pnpm nest g app 앱이름
```

### PNPM 워크스페이스는 `pnpm-workspace.yaml` 파일을 통해 앱들을 관리합니다. 새로운 앱을 추가한 후에는 이 파일에 앱 경로가 올바르게 포함되어 있는지 확인하세요.
```yaml
packages:
  - 'apps/*'
  - 'libs/*'
```
#### 설명
- **`packages`**: 워크스페이스에 포함될 패키지(프로젝트) 경로를 지정합니다.
  - `apps/*`: `apps` 폴더 내의 모든 하위 폴더를 워크스페이스 패키지로 포함합니다. NestJS 앱은 일반적으로 `apps` 폴더에 생성됩니다 (예: `apps/my-app`, `apps/another-app`).
  - `libs/*`: 공유 라이브러리(예: 공통 모듈, 유틸리티 등)가 있는 `libs` 폴더를 포함합니다. 필요에 따라 이 부분은 생략 가능합니다.
- **구조 예시**:
  ```
  workspace-root/
  ├── apps/
  │   ├── my-app/
  │   │   ├── src/
  │   │   ├── package.json
  │   ├── another-app/
  │   │   ├── src/
  │   │   ├── package.json
  ├── libs/
  │   ├── shared-utils/
  │   │   ├── src/
  │   │   ├── package.json
  ├── pnpm-workspace.yaml
  ├── package.json
  ```
- **참고**: `pnpm nest g app 앱이름` 명령어는 `apps` 폴더에 새로운 NestJS 앱을 생성하며, `pnpm-workspace.yaml`에 정의된 경로에 따라 자동으로 워크스페이스에 포함됩니다.

## Project setup

```bash
# 특정 앱에 종속성 추가 (예: @nestjs/config)
$ pnpm --filter 앱이름 add @nestjs/config

# 워크스페이스 전체에 종속성 추가 (예: typescript)
$ pnpm add typescript -w
```
> `-w` 플래그는 워크스페이스 루트에 종속성을 설치하여 모든 앱에서 공유되도록 합니다. 특정 앱에만 종속성을 설치하려면 --filter를 사용하세요.

## Compile and run the project
option 1: NestJS CLI 사용

```bash
# 특정 앱 개발 모드
$ pnpm nest start 앱이름

# 특정 앱 파일 변경 감지 모드 (watch mode)
$ pnpm nest start 앱이름 --watch

# 특정 앱 프로덕션 모드
$ pnpm nest start 앱이름 --builder webpack
```
option 2: PNPM 필터 사용
```bash
# 특정 앱 개발 모드
$ pnpm --filter 앱이름 run start

# 특정 앱 파일 변경 감지 모드 (watch mode)
$ pnpm --filter 앱이름 run start:dev

# 특정 앱 프로덕션 모드
$ pnpm --filter 앱이름 run start:prod
```

## Run tests

```bash
# 특정 앱 유닛 테스트
$ pnpm --filter 앱이름 run test

# 특정 앱 E2E 테스트
$ pnpm --filter 앱이름 run test:e2e

# 특정 앱 테스트 커버리지 확인
$ pnpm --filter 앱이름 run test:cov
```
