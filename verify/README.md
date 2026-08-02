# Verify Profile 扩展约定

`policy.json` 是唯一的 Profile 注册表。新增 Gate 时先在 `gates` 增加定义，再在一个或多个 `profiles` 中引用它；控制器本身不需要为 Vue、Spring Boot、Java、Python 或任何具体框架修改代码。

- `shell`：执行受版本控制的命令或脚本；适用于 Maven、Gradle、npm、pytest、Playwright、Docker Compose。
- `http`：请求 `url`，按 `expectedStatus` 断言；URL 可使用 `${ENV_NAME}`。
- `module`：加载受版本控制的 CommonJS 文件。文件导出 `run({ root, env })`，返回 `{ ok: boolean, output: string }`；适用于需要登录、签名、数据库准备或多步 API 合同测试的场景。

Gate 可声明 `requires`。值为 `present` 表示变量必须存在，其他值必须完全匹配。涉及写数据的 staging Gate 必须同时要求 `TARGET_ENV=staging` 和 `ALLOW_MUTATING_E2E=true`。不要把密钥写入 policy 或 Gate，全部从环境变量或企业密钥系统注入。

`verify/` 与 `docs/tasks/` 都是验收资产，必须由 CODEOWNERS 或受管仓库保护；模型只可修复业务代码和测试失败，不得改动验收资产来制造 PASS。
