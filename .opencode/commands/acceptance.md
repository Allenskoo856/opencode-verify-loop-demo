根据需求文档生成一份可审查的 Acceptance Loop 候选，不要直接修改业务实现。

1. 读取用户指定的 `docs/tasks/<feature>.md`，提取需求 ID、接口/页面时序、成功条件、失败条件、边界和禁止范围。
2. 检查每条验收是否可自动判定。遇到“性能好”“体验顺”“可靠”等模糊表述，写入 `AMBIGUOUS` 清单并停止猜测。
3. 在 `docs/work/acceptance/` 生成候选 `acceptance/v1` JSON：为后端 API 写真实 HTTP 请求、状态码、响应 JSONPath、认证、幂等、持久化和数据清理场景；为前端写对应 Playwright/Cypress 场景草案。
4. 读取 `acceptance/project.example.json`，按当前仓库实际的 Maven/Gradle/Java/前端命令生成项目适配建议；不要把 Java 或 Spring Boot 版本分支写进 Verify Controller。
5. 输出“需求 ID -> API case -> project test -> frontend test -> Gate”的映射、未决问题、风险和需要人工冻结的文件。

候选生成完成后等待人工审查。审查通过后，才把契约提升到 `acceptance/specs/`，再运行：

```bash
node verify-controller-ts/dist/verify-loop.js verify --profile api
```

不要根据模型回复、`session.idle` 或 Todo 状态宣布完成；唯一完成依据是最新 `artifacts/verify/<run-id>/evidence.json` 中的 `conclusion=PASS`。
