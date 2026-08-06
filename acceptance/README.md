# Acceptance Loop 契约

这个目录把需求文档中的“完成条件”变成可以被外部 Verify Controller 执行的验收资产。

## 分层

```text
docs/tasks/*.md
       │  OpenCode 根据需求生成候选契约，人工审查后提升
       ▼
acceptance/specs/*.json  ── contract runner ──> 真实 HTTP API
acceptance/project.json  ── project runner  ──> Maven/Gradle/npm/任意命令
                                              │
                                              └─> Playwright/Cypress/pytest 等前端或集成测试
```

控制器只认识 `acceptance/v1`、HTTP 请求/响应断言和项目命令，不认识 Spring Boot 的内部 API。Spring Boot、Java、Gradle、Maven、Node 或前端框架的差异放在项目清单和命令适配器中。

## API 契约格式

`acceptance/specs/orders-api.json` 是当前示例。每个 case 由一组顺序执行的 HTTP step 组成：

- `request.method/path/headers/json` 描述真实请求；`path` 相对 `api.baseUrl`，所以 `API_BASE_URL` 可以是 `http://host/api`。
- `expect.status`、响应头、响应文本和 `expect.json` 描述可判定结果。
- `capture` 用 JSONPath（当前支持 `$.field`、`$.items[0].id`）把登录令牌或资源 ID 传给后续 step。
- `${ENV_NAME}` 从环境变量注入；`${uuid}`、`${timestamp}` 用于隔离测试数据。密钥不能写进契约。
- `safety.mutates=true` 的契约必须列出允许环境，并且运行时同时要求 `TARGET_ENV` 和 `ALLOW_MUTATING_E2E=true`。
- 可选的 `frontend` 段记录同一需求对应的 Playwright/Cypress 测试文件、项目适配 target 和 requirement ID；实际 UI 测试由 project Gate 执行，不把 Vue/React 内部实现写进 API runner。

验证器会执行真实网络请求、保存每个 Gate 的日志，并把失败的状态码、断言和经过脱敏的响应片段回灌给 Loop。它不是 Mock 测试，也不会因为模型声称完成而通过。

## 项目适配清单

`acceptance/project.json` 只描述可执行命令和运行时元数据。例如当前项目是 Spring Boot 2.7/Java 8 + Maven；Spring Boot 3/Java 17/Gradle 可以只替换为：

```json
{
  "schemaVersion": "acceptance/project/v1",
  "backend": {
    "runtime": { "language": "java", "languageVersion": "17", "framework": "spring-boot", "frameworkVersion": "3.x" },
    "test": { "cwd": "server", "command": "./gradlew test" }
  }
}
```

控制器不根据版本猜测构建命令，也不把 Java 8 的结果冒充 Java 17 的结果。需要切换 JDK 时，由 CI/toolchain 或外层环境提供对应的 `JAVA_HOME`；Gate 只执行清单里经过审查的命令。

## 运行

先启动目标服务，再运行直接 API 验收：

```bash
export TARGET_ENV=local
export ALLOW_MUTATING_E2E=true
export API_BASE_URL=http://localhost:8080/api
export E2E_USER=demo@example.com
export E2E_PASSWORD=demo-password-only-for-local
node verify-controller-ts/dist/verify-loop.js accept --spec acceptance/specs/orders-api.json
```

在外部控制器中使用同一契约：

```bash
node verify-controller-ts/dist/verify-loop.js verify --profile api
```

`project` Gate 则通过清单执行后端/前端测试：

```bash
node verify-controller-ts/dist/verify-loop.js verify --profile backend
node verify-controller-ts/dist/verify-loop.js verify --profile frontend
```

## 变更边界

`acceptance/specs/**` 和 `acceptance/project.json` 是验收资产。需求变化时先在 `docs/work/` 生成候选契约，由人审查后提升到 `acceptance/specs/`；Loop 运行期间模型只能修复业务实现和普通测试失败，不能放宽断言、删掉场景或切换到另一套命令来制造 PASS。
