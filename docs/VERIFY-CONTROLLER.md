# Verify Controller 使用手册

## 为什么要独立控制器

OpenCode 插件可以拦截工具、提供状态工具和监听空闲事件，但不能可靠地阻止会话结束后再注入下一轮。控制器因此运行在模型进程之外：模型没有通过文本伪造 PASS 的权限，测试命令的退出码和证据文件才是完成条件。

## 安装与诊断

开发机可以从源码构建：

```bash
cd verify-controller
go build -trimpath -ldflags='-s -w' -o bin/verify-loop ./cmd/verify-loop
cd ..
./verify-controller/bin/verify-loop doctor
```

离线介质会直接提供 Linux AMD64 静态二进制，不要求目标机安装 Go。

## 一次验证

```bash
./verify-controller/bin/verify-loop verify --profile auto
./verify-controller/bin/verify-loop verify --profile backend
./verify-controller/bin/verify-loop verify --profile frontend
./verify-controller/bin/verify-loop verify --profile full
```

`auto` 当前执行 Git whitespace、前端构建和控制器自身测试；跨栈改动使用 `full`，它再执行 Java 8 Maven 测试和前端单元测试。每个 Gate 最长 20 分钟，失败即停止并写证据。

## 自动修复循环

```bash
./verify-controller/bin/verify-loop run \
  --task-file docs/tasks/order-feature.md \
  --profile full \
  --model glm5 \
  --max-iterations 5
```

第 1 轮向 OpenCode 发送任务；每一轮失败后只回灌脱敏后的证据路径和失败日志，要求模型修复实现。控制器会校验 `.opencode/`、`e2e/specs/`、策略和离线校验文件是否变化，不能通过删除测试或放宽规则获取成功。循环没有自动 `git commit` 或 `git push`。

## 证据格式

`artifacts/verify/<run-id>/evidence.json` 至少包含 `schemaVersion`、`baseSha`、`iteration`、`gates[]`、`conclusion`。只有 `conclusion=PASS` 且时间晚于最近一次代码修改时才允许报告完成。日志以 0600 权限保存，分享前仍需人工检查。

## 失败处理

- `FAILED`：查看对应 Gate 的 `.log`，修复代码后重新执行。
- `BLOCKED_PROTECTED_PATH`：恢复受保护文件，再执行验证。
- 退出码 2：检查 OpenCode、Java 8、Maven、Node、Docker/Podman 和目标环境变量。
- 本地没有 Java 8 时不得把 Java 11 的编译结果称为 Java 8 通过；交给 GitHub Actions 或 Java 8 容器。
