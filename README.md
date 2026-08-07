# OpenCode Verify Loop Demo

这是一个可在企业内网落地的 AI 编程验收样板：Vue 3 + TypeScript 前端、Spring Boot 2.7.18 + Java 8 后端，以及不信任模型完成声明的外部 Verify Controller。

## 核心原则

模型负责修改代码和解释失败原因；外部 `verify-loop` 负责启动服务、执行测试、收集证据和决定是否完成。`session.idle` 只能用于提示，不能作为验收结论。循环调度可选 OpenCode CLI 或 `@bybrawe/opencode-loop`，但两者都必须调用外部 Controller 的 Profile。

## 快速开始

```bash
cp .env.example .env
docker compose -f deploy/compose.dev.yml up --build -d
cd frontend && npm ci && npm run dev
```

后端健康检查：`http://localhost:8080/actuator/health`；前端：`http://localhost:5173`。

## Verify Loop

```bash
node verify-controller-ts/dist/verify-loop.js run \
  --task-file docs/tasks/order-feature.md \
  --profile full \
  --model glm5
```

完整手册见：

- [Verify Controller](docs/VERIFY-CONTROLLER.md)
- [企业内网完整使用手册](docs/INTRANET-USAGE-MANUAL.md)
- [OpenCode Loop 适配](docs/OPENCODE-LOOP.md)
- [API、真实环境与前端自动化测试](docs/TESTING-MANUAL.md)
- [OpenCode 插件和 Skills](docs/OPENCODE-INTEGRATION.md)
- [Loop Acceptance 抽象：需求、真实 API、项目适配和前端循环](docs/LOOP-ACCEPTANCE.md)
- [Loop Engineering 全栈实施手册：架构、内网、Java/Vue 与逐步提示词](docs/LOOP-ENGINEERING-PLAYBOOK.md)
- [UOS/Debian 10 离线部署](docs/INTRANET-OFFLINE.md)

## 许可证

Apache-2.0。基础镜像和第三方组件应按企业发布流程补充许可证清单。
