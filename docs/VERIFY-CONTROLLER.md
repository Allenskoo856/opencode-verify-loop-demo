# Verify Controller 使用手册

## 为什么要独立控制器

OpenCode 插件可以拦截工具、提供状态工具和监听空闲事件，但不能充当验收裁判。控制器因此运行在模型进程之外：模型没有通过文本伪造 PASS 的权限，测试命令的退出码和证据文件才是完成条件。

控制器分为两个实现：`verify-controller-ts` 是默认的 Node/TypeScript 控制面，适合企业内网二次开发；`verify-controller` 的 Go 静态二进制是离线兜底，避免目标机缺少 Node 时无法读取证据。两个实现都写入同一类证据目录，但新 Profile、Gate 和适配器只在 TypeScript 控制器中扩展。

## 安装与诊断

开发机使用 TypeScript 控制器：

```bash
npm --prefix verify-controller-ts ci
npm --prefix verify-controller-ts run build
node verify-controller-ts/dist/verify-loop.js doctor --require-opencode=true
```

离线介质同时提供 Linux AMD64 静态 Go 二进制和编译后的 `verify-loop.js`；后者需要 Node 20+，不需要在目标机安装 TypeScript 或 npm 包。

## 一次验证

```bash
node verify-controller-ts/dist/verify-loop.js verify --profile auto
node verify-controller-ts/dist/verify-loop.js verify --profile backend
node verify-controller-ts/dist/verify-loop.js verify --profile frontend
node verify-controller-ts/dist/verify-loop.js verify --profile frontend-e2e
node verify-controller-ts/dist/verify-loop.js verify --profile api
node verify-controller-ts/dist/verify-loop.js verify --profile full
```

`auto` 当前执行 Git whitespace、前端构建和控制器自身测试；`api` 执行经过安全环境检查的真实 HTTP contract；`full` 还执行项目适配清单中的后端测试、前端单元测试，以及 Docker Compose + Playwright。每个 Gate 的超时、运行器、命令与环境前置条件都来自 [verify/policy.json](../verify/policy.json)，失败即停止并写证据。

直接运行一个 API contract：

```bash
node verify-controller-ts/dist/verify-loop.js accept \
  --spec acceptance/specs/orders-api.json
```

它要求契约声明的目标环境、API 地址和测试凭据由环境变量注入；写数据的契约还必须设置 `ALLOW_MUTATING_E2E=true`。

## 可插拔 Profile 与 Gate

控制器只内置 `shell`、`http`、`module`、`contract` 和 `project` 五种运行器。业务技术栈不写在控制器代码里：新增 Java、Go、Python、Web、移动端或第三方接口验收时，API 使用通用 `contract`，编译/单测使用 `project` 清单，复杂认证或故障场景再使用受保护的 `module`。Profile 只引用 Gate 名称。完整扩展约定见 [verify/README.md](../verify/README.md) 和 [acceptance/README.md](../acceptance/README.md)。

策略、Gate 和规格文件均受保护；模型改动这些文件后，下一次验证会返回 `BLOCKED_PROTECTED_PATH`。企业可把 `verify/` 放进受 CODEOWNERS 保护的独立仓库，再通过发布签名或只读子模块接入项目。

## 自动修复循环

```bash
node verify-controller-ts/dist/verify-loop.js run \
  --task-file docs/tasks/order-feature.md \
  --profile full \
  --model glm5 \
  --max-iterations 5
```

第 1 轮向 OpenCode 发送任务；每一轮失败后只回灌脱敏后的证据路径和失败日志，要求模型修复实现。控制器会校验 `docs/tasks/`、`.opencode/`、`e2e/specs/`、`frontend/e2e/`、`acceptance/specs/`、`acceptance/project.json`、`verify/` 和离线校验文件是否变化，不能通过删除测试或放宽规则获取成功。循环没有自动 `git commit` 或 `git push`。

## 证据格式

`artifacts/verify/<run-id>/evidence.json` 至少包含 `schemaVersion`、`baseSha`、`iteration`、`gates[]`、`conclusion`。只有 `conclusion=PASS` 且时间晚于最近一次代码修改时才允许报告完成。日志以 0600 权限保存，分享前仍需人工检查。

## 失败处理

- `FAILED`：查看对应 Gate 的 `.log`，修复代码后重新执行。
- `BLOCKED_PROTECTED_PATH`：恢复受保护文件，再执行验证。
- 退出码 2：检查 Profile 的环境前置条件、OpenCode（仅 `run`）、Java 8、Maven、Node、Docker/Podman。
- 本地没有 Java 8 时不得把 Java 11 的编译结果称为 Java 8 通过；交给 GitHub Actions 或 Java 8 容器。
