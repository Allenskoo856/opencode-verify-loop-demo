# API、真实环境与前端自动化测试

## 启动本地真实服务

```bash
cp .env.example .env
docker compose --env-file .env -f deploy/compose.dev.yml up --build -d
curl --fail http://localhost:8080/actuator/health
```

## API 验证案例

```bash
TOKEN=$(curl -fsS http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"demo-password-only-for-local"}' | jq -r .accessToken)

curl -fsS http://localhost:8080/api/orders -H "Authorization: Bearer $TOKEN"
curl -fsS http://localhost:8080/api/orders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"verify-loop order"}'
```

自动化 API Gate 还会验证错误密码 401、缺少令牌 401、空标题 400、超过 120 字符 400、未知订单 404、取消幂等和 Flyway 空库迁移。

## 前端单元与 E2E

```bash
cd frontend
npm ci
npm run test:unit
npx playwright install --with-deps chromium   # 仅联网开发机
E2E_BASE_URL=http://localhost:4173 E2E_USER=demo@example.com E2E_PASSWORD=... npm run test:e2e
```

E2E 必须使用隔离 Context，断言 URL、角色、可见状态和实际 API 结果；失败时保留 trace、截图、视频、console error 和网络错误。

## 内网 staging 接入

```bash
export TARGET_ENV=staging
export API_BASE_URL=https://orders-staging.intra.example/api
export E2E_BASE_URL=https://orders-staging.intra.example
export E2E_USER='专用测试账号'
export E2E_PASSWORD='从密钥系统注入'
export ALLOW_MUTATING_E2E=true
export NODE_EXTRA_CA_CERTS=/etc/pki/company/ca.pem
./verify-controller/bin/verify-loop verify --profile staging
```

只有 `TARGET_ENV=staging` 且显式设置 `ALLOW_MUTATING_E2E=true` 时才允许创建/取消订单。生产只使用 `production-readonly` 运行健康检查、登录策略和只读页面加载，控制器必须拒绝写操作。`--allow-host` 或 E2E 域名配置只限制测试目标，不等于出网防火墙策略；出网仍需由企业代理/防火墙控制。
