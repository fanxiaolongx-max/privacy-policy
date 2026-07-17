# 外部指标 API 调用文档

本文档用于手机 App、移动端小程序或其它外部客户端读取 Tools Platform 已入库的报表指标数据。

## 基础信息

- 默认服务地址：`http://<服务器IP>:3030`
- API 前缀：`/api/external/metrics`
- 数据来源：`data/report.db` 的报表入库数据
- 访问权限：需要先登录获取 token，之后所有请求携带 `Authorization: Bearer <token>`
- 接口类型：只读 GET 接口，不会修改平台数据

> 如果手机需要访问电脑上的本地服务，请确保电脑和手机在同一网络内，并使用电脑局域网 IP，例如 `http://192.168.1.20:3030`。

## 认证

### 登录获取 token

`POST /api/auth/login`

请求体：

```json
{
  "username": "admin",
  "password": "你的密码"
}
```

响应示例：

```json
{
  "success": true,
  "token": "xxxxxxxxxxxxxxxx",
  "role": "admin",
  "username": "admin"
}
```

后续请求头：

```http
Authorization: Bearer xxxxxxxxxxxxxxxx
```

登录 token 默认有效期为 7 天。

## 通用查询参数

以下参数在多个接口中通用：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `month` | number | 目标月份，1-12 |
| `startDate` | string | 快照创建日期下限，格式 `YYYY-MM-DD` |
| `endDate` | string | 快照创建日期上限，格式 `YYYY-MM-DD` |
| `limit` | number | 分页条数，快照默认 50、最大 500；指标默认 200、最大 2000 |
| `offset` | number | 分页偏移，默认 0 |

## 接口列表

### 1. 指标总览

`GET /api/external/metrics/summary`

返回当前筛选范围内的快照数、指标数、不达标指标数、达标率，以及最新快照的分类得分和异常指标。

示例：

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3030/api/external/metrics/summary?month=6"
```

响应字段：

```json
{
  "snapshot_count": 53,
  "metric_count": 10432,
  "failing_metric_count": 126,
  "compliance_rate": 98.79,
  "first_snapshot_at": "2026-06-20 10:12:33",
  "latest_snapshot_at": "2026-07-02 22:16:39",
  "latest_snapshot": {
    "snapshot_id": "mr3w2tl9",
    "month": 6,
    "created_at": "2026-07-02 22:16:39",
    "standard_total_score": 99.2,
    "image_path": "/api/db/images/mr3w2tl9_6.png",
    "excel_path": "/api/db/images/mr3w2tl9_6.xlsx"
  },
  "latest_category_scores": [],
  "latest_metrics_total": 200,
  "latest_failing_metrics": []
}
```

### 2. 快照列表

`GET /api/external/metrics/snapshots`

用于移动端展示历史入库批次。

示例：

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3030/api/external/metrics/snapshots?month=6&limit=20&offset=0"
```

响应结构：

```json
{
  "items": [
    {
      "snapshot_id": "mr3w2tl9",
      "month": 6,
      "created_at": "2026-07-02 22:16:39",
      "standard_total_score": 99.2,
      "image_path": "/api/db/images/mr3w2tl9_6.png",
      "excel_path": "/api/db/images/mr3w2tl9_6.xlsx"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 53
  }
}
```

### 3. 最新快照

`GET /api/external/metrics/snapshots/latest`

示例：

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3030/api/external/metrics/snapshots/latest?month=6"
```

可选参数：

- `includeRaw=1`：返回原始入库数据 `raw_data`。该字段可能很大，移动端首页不建议开启。

### 4. 快照详情

`GET /api/external/metrics/snapshots/:snapshot_id`

返回指定快照的基础信息、分类得分、全部指标明细。

示例：

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3030/api/external/metrics/snapshots/mr3w2tl9?month=6"
```

响应结构：

```json
{
  "snapshot": {
    "snapshot_id": "mr3w2tl9",
    "month": 6,
    "created_at": "2026-07-02 22:16:39",
    "standard_total_score": 99.2,
    "image_path": "/api/db/images/mr3w2tl9_6.png",
    "excel_path": "/api/db/images/mr3w2tl9_6.xlsx"
  },
  "category_scores": [
    {
      "snapshot_id": "mr3w2tl9",
      "month": 6,
      "category": "TE",
      "base_score": 81.03,
      "manual_score": 22,
      "final_score": 103.03
    }
  ],
  "metrics": [
    {
      "id": 10428,
      "snapshot_id": "mr3w2tl9",
      "month": 6,
      "category": "TE",
      "metric_label": "重疾EOS预案覆盖率",
      "weight": 1,
      "target_value": "≥ 100%",
      "raw_value": "100%",
      "numeric_value": 100,
      "is_failing": false,
      "gap": "",
      "earned_score": 1,
      "proportional_scoring": false,
      "completion_ratio": 1
    }
  ]
}
```

### 5. 指标明细列表

`GET /api/external/metrics`

用于移动端按条件分页读取所有指标。

兼容别名：`GET /api/external/metrics/metrics`

额外查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `snapshot_id` | string | 指定快照 ID |
| `category` | string | 指定分类，例如 `TE`、`ORG`、`ET`、`VDF`、`整体` |
| `metric_label` | string | 指标名称模糊搜索 |
| `failing_only` | boolean | 是否只返回不达标指标，支持 `1`/`true` |

示例：

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3030/api/external/metrics?month=6&category=TE&limit=100"
```

### 6. 不达标指标列表

`GET /api/external/metrics/failing`

等价于 `/?failing_only=1`，便于移动端直接拉异常指标。

示例：

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3030/api/external/metrics/failing?month=6&limit=100"
```

## 移动端建议

- 首页使用 `/summary?month=<当前月>`。
- 历史记录页使用 `/snapshots?month=<目标月>&limit=20&offset=0`。
- 指标列表页使用 `/metrics` 分页加载，不建议一次拉全量。
- 异常提醒页使用 `/failing`。
- 只有在需要复现 Web 端入库原始数据时，才使用 `includeRaw=1`。

## 常见错误

| HTTP 状态码 | 说明 |
| --- | --- |
| 401 | 未携带 token，或 token 过期 |
| 403 | 当前账号无权限访问对应操作 |
| 404 | 快照不存在 |
| 500 | 服务端读取数据库异常 |
