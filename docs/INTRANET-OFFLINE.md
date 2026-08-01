# UOS/Debian 10 离线部署

## 介质内容

发布包包含前端、后端、PostgreSQL 和 Verify Controller 的 Linux AMD64 镜像归档，静态 `verify-loop`、离线 Compose、环境模板和 `SHA256SUMS`。OpenCode CLI、模型服务、源码依赖缓存和企业凭据不包含在介质内；Skills、插件和手册随 Git 仓库交付，需一并带入内网或使用仓库压缩包。

## 安装

```bash
sha256sum -c SHA256SUMS
./offline/install.sh --runtime docker --bundle ./opencode-verify-loop-offline.tar
cp .env.offline.example .env
$EDITOR .env
docker compose --env-file .env -f deploy/compose.offline.yml up -d
./verify-controller/bin/verify-loop verify --profile full
```

安装器不联网、不覆盖全局 OpenCode 配置，目标目录已有配置时先备份再合并项目配置。若使用 Podman，改用 `--runtime podman`。

## 断网验收

在目标机执行：

```bash
docker run --rm --network none opencode-verify-controller:offline doctor
docker image ls 'opencode-verify-*'
curl --fail http://localhost:4173
```

GitHub Actions 会在 Linux AMD64 上构建包、加载归档，并以 `--network none` 执行同等 smoke test；该 CI 结果是离线介质的发布门槛。

## 回滚/卸载

先停止 Compose 并保留 `orders-data` 卷；卸载只移除项目镜像、项目 Skills 和控制器，不删除用户的 OpenCode 凭据。需要删除测试数据时必须明确指定卷名 `opencode-verify-loop_demo_orders-data`。
