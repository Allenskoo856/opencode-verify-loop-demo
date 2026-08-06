# 企业内网使用手册

本文面向使用 GLM5、MiniMax 等模型进行日常 AI 编程的开发、测试和平台团队。目标不是让模型“声称写完”，而是让外部 Controller 用可复查证据决定是否完成。

## 1. 角色与边界

| 角色 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| 产品/技术/测试审核人 | 确认任务合同、风险、验收标准 | 不需要手工执行每个测试 |
| 模型 | 分析失败、修改业务代码、补充实现测试 | 不能自行宣布 PASS 或修改验收资产 |
| Verify Controller | 执行 Profile、写证据、阻止受保护文件被改动 | 不判断需求是否合理 |
| OpenCode Loop（可选） | 模型空闲后继续下一轮 | 不能作为验收裁判 |

受保护验收资产为 `docs/tasks/`、`verify/`、`.opencode/`、`e2e/specs/`、`frontend/e2e/`、`acceptance/specs/`、`acceptance/project.json` 和离线校验文件。模型可以创建 `docs/work/` 下的工作计划、修复记录或 TODO；该目录不应放冻结后的验收条件。

## 2. 环境准备

开发机需要 Node 20+、Docker Compose（或 Podman Compose）、Git、OpenCode；执行后端 Gate 时还需要 Java 8 和 Maven，或将该 Gate 交由 CI 执行。

```bash
git clone https://github.com/Allenskoo856/opencode-verify-loop-demo.git
cd opencode-verify-loop-demo
cp .env.example .env
npm --prefix verify-controller-ts ci
npm --prefix verify-controller-ts run build
node verify-controller-ts/dist/verify-loop.js doctor --require-opencode=true
```

`.env` 只用于本地演示，禁止提交密码、Token 或内网地址。staging 凭据通过企业密钥系统、CI Secret 或短期环境变量注入。

## 3. 任务合同：不用从零手写，但必须审核

`docs/tasks/order-feature.md` 是任务合同，不是模型的自由提示词。它**可以自动生成草案**，但不能未经审核直接作为验收依据。

推荐流程：

1. 从 Jira/禅道、PRD、接口文档或历史缺陷生成草案；可由模型生成，也可使用 [任务合同模板](tasks/TASK-CONTRACT-TEMPLATE.md)。
2. 产品确认业务行为；技术确认实现边界；测试确认每条验收条件都能映射到自动化验证。
3. 审核人将文件提交到 `docs/tasks/<功能>.md`。
4. 此后模型不可修改该文件；如需求变化，走新的评审和 Git 提交，而不是让模型在循环中改合同。

最小合同至少要有：目标、包含/不包含范围、可观察验收条件、验证映射、测试数据边界和禁止修改项。只有“实现订单功能”这类描述不够，它无法证明完成。

## 4. 本地开发与一次验证

启动真实容器服务：

```bash
docker compose --env-file .env -f deploy/compose.dev.yml up --build -d
curl --fail http://localhost:8080/actuator/health
```

按改动范围选择 Profile：

| Profile | 适用场景 | Gate |
| --- | --- | --- |
| `auto` | 编写过程中快速反馈 | Git 检查、前端构建、TS 控制器测试 |
| `backend` | Java/API/数据库改动 | Git 检查、Java 8 Maven 测试 |
| `frontend` | Vue 页面、状态、组件改动 | Git 检查、Vitest |
| `frontend-e2e` | 已启动目标服务后的真实浏览器验收 | Git 检查、项目适配的 Playwright/Cypress 命令 |
| `api` | 已启动目标服务后的真实 HTTP API 验收 | Git 检查、`acceptance/v1` contract |
| `full` | 跨前后端或合并前 | 后端、前端、Compose、Playwright |
| `staging` | 专用内网测试环境 | 环境护栏、健康检查、API 合同、浏览器 E2E |

```bash
node verify-controller-ts/dist/verify-loop.js verify --profile auto
node verify-controller-ts/dist/verify-loop.js verify --profile api
node verify-controller-ts/dist/verify-loop.js verify --profile full
```

每次执行会写入 `artifacts/verify/<run-id>/evidence.json` 与同目录 Gate 日志。只有最新证据的 `conclusion` 为 `PASS` 才可提交或交付；模型回复“已完成”没有效力。

## 5. 用 OpenCode 执行修复循环

直接使用外部循环：

```bash
node verify-controller-ts/dist/verify-loop.js run \
  --task-file docs/tasks/order-feature.md \
  --profile full \
  --model glm5 \
  --max-iterations 5
```

Controller 首先执行验证；失败时只把脱敏后的证据路径和失败信息交回模型。模型修复后，Controller 再执行下一轮。达到次数上限或 OpenCode 不可用时，循环失败并保留证据，不会自动提交或推送。

如果希望使用社区 `@bybrawe/opencode-loop` 的会话续跑与后台调度，只能二选一，不要同时运行上述 `run` 与 Loop：

```text
/loop-goal --max-turns 5 --max-no-progress 3 \
  --check "node verify-controller-ts/dist/verify-loop.js verify --profile full" \
  --complete-when-checks-pass \
  阅读 docs/tasks/order-feature.md；根据 artifacts/verify 中的失败证据修复业务实现。
```

安装、版本固定和内网镜像流程见 [OpenCode Loop 适配](OPENCODE-LOOP.md)。社区插件仅负责调度，`--check` 返回的 Controller 证据才是验收事实。

## 6. staging 真实环境验证

生产环境禁止创建、取消或修改数据。staging 必须使用专用账号和可清理测试数据：

```bash
export TARGET_ENV=staging
export ALLOW_MUTATING_E2E=true
export API_BASE_URL=https://orders-staging.intra.example/api
export STAGING_HEALTH_URL=https://orders-staging.intra.example/actuator/health
export E2E_BASE_URL=https://orders-staging.intra.example
export E2E_USER='专用测试账号'
export E2E_PASSWORD='由密钥系统注入'
export NODE_EXTRA_CA_CERTS=/etc/pki/company/ca.pem
node verify-controller-ts/dist/verify-loop.js verify --profile staging
```

`staging-target-guard` 会拒绝非 staging、未显式授权写数据、或名称看起来像 production 的目标；`staging-api-contract` 真实执行登录、列表、创建与取消；Playwright 再从页面执行同样业务流。配置允许目标不等于网络隔离，企业仍需使用代理、出网防火墙和最小权限测试账号。

## 7. 新业务/新技术栈接入

不要修改 Controller 源码来增加“某个框架的固定验证”。后端真实接口先写 `acceptance/specs/<feature>.json`，再在 [acceptance/project.json](../acceptance/project.json) 配置 Maven/Gradle/pytest/npm 等项目命令；只有复杂认证、消息队列或故障注入才在 [verify/policy.json](../verify/policy.json) 增加受保护的 `module` Gate：

```json
"python-contract": {
  "runner": "shell",
  "command": "uv run pytest tests/contract -q",
  "timeoutSeconds": 900
}
```

多步 API 鉴权、消息队列校验或数据库准备，放到 `verify/gates/<名称>.cjs` 并使用 `module` Runner；简单健康检查使用 `http` Runner。详细 ABI 见 [Verify Profile 扩展约定](../verify/README.md)。任何策略变更都必须经审核后提交，再由 CI 验证。

## 8. 常见失败处理

| 结果 | 含义 | 处理 |
| --- | --- | --- |
| `FAILED` | 业务或环境 Gate 失败 | 打开 evidence 中的 `outputFile`，让模型仅修复实现，再重跑 |
| `BLOCKED_PROTECTED_PATH` | 改了任务合同、策略或规格 | `git diff` 确认是否确为需求变更；否则恢复文件 |
| 退出码 `2` | 缺 Node/OpenCode、环境变量或 Gate 配置 | 执行 `doctor`，检查 Profile `requires` |
| E2E 超时 | 容器、账号、证书或页面选择器异常 | 查看 Compose 日志与 Playwright trace，不降低断言 |

## 9. 内网离线使用

离线包和安装器不访问公网，带 OCI 镜像、校验和、Go 兜底二进制、编译后的 Node Controller 及默认策略/Gate。Node Controller 需要目标机已有 Node 20+；没有 Node 时只能使用 Go 的 `auto` 兜底检查。完整介质校验、安装和回滚见 [UOS/Debian 10 离线部署](INTRANET-OFFLINE.md)。
