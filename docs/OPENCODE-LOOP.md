# OpenCode Loop 适配

`@bybrawe/opencode-loop` 用于“什么时候让模型继续”，不是验收裁判。它提供 `/loop`、`/loop-goal`、`--check` 和后台 `opencode-loopd`；项目当前采用它的 Goal Mode 时，唯一的完成检查必须是 TypeScript Verify Controller。

## 安装边界

在联网的开发机审计并固定版本后安装；不要把 `@latest` 写进内网安装脚本：

```bash
npx -y @bybrawe/opencode-loop@0.5.19
# 完全重启 OpenCode 后
/loop-doctor
```

它是 MIT 许可的社区项目。企业应镜像对应 npm tarball，审计安装脚本、锁定 SHA-512，并将插件安装到项目级 `.opencode/` 或企业受管的 OpenCode 配置目录；离线介质不自动安装社区插件。

## 推荐的混合循环

先启动 OpenCode，再执行：

```text
/loop-goal --max-turns 5 --max-no-progress 3 \
  --check "node verify-controller-ts/dist/verify-loop.js verify --profile full" \
  --complete-when-checks-pass \
  阅读 docs/tasks/order-feature.md；只修改业务实现；每轮查看 artifacts/verify 的失败证据并修复。
```

`/loop-goal` 的“完成”只表示它看到外部命令返回 0；交付系统仍应读取最新 `evidence.json` 的 `conclusion=PASS`、Profile、Git SHA 与受保护路径检查。模型、插件或聊天文本都不能直接写 PASS。

## 何时不用它

不需要连续模型回合时，直接使用：

```bash
node verify-controller-ts/dist/verify-loop.js run \
  --task-file docs/tasks/order-feature.md --profile full --model glm5
```

这样由 CLI 外部循环调用 OpenCode。两种模式可以并存，但同一任务只能启用一个调度器，防止两个循环同时向同一会话注入 prompt。
