# 面向 OpenCode 的后端 API 与前端 Loop 验收抽象

这套抽象把直播 PDF 中的 SDD、Harness 和 Loop 思想落到一个可执行的工程协议里。

## 设计结论

不要让模型直接从一篇自然语言需求“猜出完成”。正确的职责分工是：

```text
需求文档 ──> OpenCode 生成候选验收契约 ──> 人审查/冻结
                                      │
                                      ├─ API contract runner：真实接口
                                      ├─ project adapter：编译、单测、集成测试
                                      └─ frontend adapter：Playwright/Cypress 等
                                               │
                                               ▼
                         Verify Controller 生成 evidence.json
                                      │
               FAILED ───────────────┴────────────── PASS
                  │                                  │
              脱敏失败证据回灌模型                 人的检查点
```

PDF 中的五个 Loop 要素对应如下：

| PDF 要素 | 本项目落点 |
| --- | --- |
| 可判定目标 | `docs/tasks/*.md` 的 Given/When/Then 与 `acceptance/specs/*.json` |
| 判官 | `verify-loop`、`contract`/`project`/`shell`/`http`/`module` Gate |
| 隔离工作区 | OpenCode worktree、受保护验收资产、独立 `artifacts/verify/<run-id>` |
| 边界与停止 | `--max-iterations`、环境安全要求、受保护路径、失败/歧义交人 |
| 人的检查点 | 只接受最新 `evidence.json`，最终合并仍需人工 review |

## 从需求文档生成什么

OpenCode 的生成目标不是一段泛泛的测试描述，而是四种有明确执行位置的资产：

1. **API 场景**：状态码、认证、权限、请求校验、资源生命周期、幂等、分页/排序、错误体和数据持久化。
2. **业务测试**：适合放入 Maven/Gradle/pytest 等项目命令的单元、集成和数据库迁移测试。
3. **前端场景**：登录、关键页面路径、表单错误、成功状态、刷新后的持久化；用 Playwright/Cypress 的语义定位器执行。
4. **运行适配**：后端框架、语言/运行时版本、构建命令、工作目录、服务健康地址和环境变量来源。

自然语言需求里出现“性能好”“体验顺”“应该可靠”时，生成器必须把它标为 `AMBIGUOUS` 并停下来要求补充阈值、数据规模或可观察信号；不能自行把模糊词变成 PASS 条件。

## 为什么后端版本差异不会污染控制器

API 验收的判定对象是 HTTP 合同，而不是 Spring Bean、Controller 注解或 Java 版本。相同的登录/创建/取消场景可以验证 Spring Boot、Quarkus、Micronaut、FastAPI 或 Go 服务。

编译、单测和服务启动则走 `acceptance/project.json`：

- Spring Boot 2 + Java 8 + Maven：`./mvnw test` 或受控的 Maven 命令。
- Spring Boot 3 + Java 17 + Gradle：`./gradlew test`。
- 其他后端：改 `backend.test.command`，必要时增加一个经过审查的 `module` 适配器。

版本信息只用于报告和环境校验，不用于让控制器编写框架分支。实际 Java 版本应由 CI 的 toolchain、容器或 `JAVA_HOME` 决定，并在 Gate 输出中记录。

## 后端真实 API 验收的推荐分层

- 快速层：纯 API contract，运行登录、未授权、参数边界、主流程和幂等，适合每一轮 Loop。
- 项目层：Maven/Gradle 集成测试、Flyway/Liquibase 空库迁移、Repository/Service 测试。
- 慢速层：Compose、Playwright、staging 真实环境、并发/故障注入；交给 CI 或人的检查点。

这保持了“快判官让循环自我修正，重判官防止高代价错误”的边界。生产环境默认只读，写数据的契约必须显式允许 `local` 或 `staging`，并设置 `ALLOW_MUTATING_E2E=true`。

## 前端 Loop 的推荐做法

前端验收不应依赖 Vue/React 内部实现。生成器从同一份需求契约产生 Playwright/Cypress 测试，优先使用 `role`、`label`、`testid` 和 URL/可见文本断言；每个测试使用独立浏览器上下文和唯一数据。

Loop 中只回灌 trace、截图、console/network 错误和失败断言；模型不能把随机等待、放宽断言或删除失败场景当成修复。生成并审查后的 `frontend/e2e/**` 属于验收资产，当前策略已将其列入保护范围。

## 一轮循环

```text
1. 读取 docs/tasks/<feature>.md
2. 生成 docs/work/acceptance/<feature>.json 和 frontend/e2e/<feature>.spec.ts 候选
3. 人工确认场景、风险、环境和禁止范围
4. 冻结 acceptance/specs 与前端 E2E
5. OpenCode 只修改业务实现
6. Verify Controller 执行 API + project + frontend Gates
7. 失败则只回灌脱敏证据；成功或达到轮数上限就停
```

同一个任务只启用一个调度器：可以由外部 `verify-loop run` 调 OpenCode，也可以用 OpenCode Loop 的 `--check` 调控制器；Loop 的 idle/goal 状态不是验收结论。
