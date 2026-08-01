运行外部验收控制器，不要根据自己的回复判断完成：

```bash
./verify-controller/bin/verify-loop verify --profile auto
```

只有 `artifacts/verify/<run-id>/evidence.json` 的 `conclusion` 为 `PASS`，才能报告已完成。
