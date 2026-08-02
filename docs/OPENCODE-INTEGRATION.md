# OpenCode 插件和 Skills

项目配置 `opencode.json` 自动加载 `.opencode/plugins/verify-policy.ts` 和三个项目级 Skill。

插件提供 `verify_status` 工具读取最新 `evidence.json`，并对常见写入工具和 shell 参数中的受保护路径抛出阻止错误。它还在 `session.idle` 显示提醒；提醒不是验收结果，外部控制器才是主控。

推荐提示词：

```text
阅读 docs/tasks/order-feature.md，实现订单功能。完成后不要声称完成，执行
node verify-controller-ts/dist/verify-loop.js verify --profile full，并根据 evidence.json 修复失败。
```

Playwright 官方 Agent 可在联网开发机初始化：

```bash
cd frontend
npx playwright init-agents --loop=opencode
```

生成的 planner、generator、healer 只能维护 `e2e/` 测试，不得修改 `docs/tasks/`、`verify/policy.json` 或 `verify/gates/`。Oh My OpenAgent 和 OpenCode Loop 如需使用，必须先审计来源、版本、许可证和安装脚本，并保持 Goal/Todo 与外部 PASS 解耦；不能把社区 Ralph 或 Loop 的完成标记当成验收。
