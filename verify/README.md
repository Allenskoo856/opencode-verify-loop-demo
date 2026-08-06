# Verify Profile 扩展约定

`policy.json` 是唯一的 Profile 注册表。新增 Gate 时先在 `gates` 增加定义，再在一个或多个 `profiles` 中引用它；控制器本身不需要为 Vue、Spring Boot、Java、Python 或任何具体框架修改代码。

- `shell`：执行受版本控制的命令或脚本；适用于 Docker Compose 或已有项目脚本。
- `http`：请求 `url`，按 `expectedStatus` 断言；URL 可使用 `${ENV_NAME}`。
- `module`：加载受版本控制的 CommonJS 文件。文件导出 `run({ root, env })`，返回 `{ ok: boolean, output: string }`；适用于需要登录、签名、数据库准备或多步 API 合同测试的场景。
- `contract`：执行 `acceptance/v1` JSON 中的真实 HTTP 请求、状态码、JSONPath、捕获变量和安全环境检查；不依赖 Spring Boot 或任何后端框架。
- `project`：读取 `acceptance/project.json` 的 `target` 命令和工作目录；适用于 Maven、Gradle、npm、pytest 或企业自定义构建入口。版本差异必须写在项目清单/CI toolchain，不写入控制器分支。

Gate 可声明 `requires`。值为 `present` 表示变量必须存在，其他值必须完全匹配。涉及写数据的 staging Gate 必须同时要求 `TARGET_ENV=staging` 和 `ALLOW_MUTATING_E2E=true`。不要把密钥写入 policy 或 Gate，全部从环境变量或企业密钥系统注入。

`verify/` 与 `docs/tasks/` 都是验收资产，必须由 CODEOWNERS 或受管仓库保护；模型只可修复业务代码和测试失败，不得改动验收资产来制造 PASS。

API contract 和 project adapter 的完整格式见 [acceptance/README.md](../acceptance/README.md)。
