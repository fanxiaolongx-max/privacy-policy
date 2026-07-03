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
  "latest_failing_metrics": [],
  "latest_expiring_ticket_count": 34,
  "latest_special_metric_alert_count": 5,
  "latest_alerts": {
    "expiring_tickets": [],
    "special_metric_alerts": []
  }
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
      "completion_ratio": 1,
      "schema": {
        "source_id": "other_36ksoy",
        "source_title": "📁 独立表: PBI_自动抓取-重急EOS风险_Latest",
        "source_base_name": "PBI_自动抓取-重急EOS风险_Latest",
        "main_metric_label": "重疾EOS预案覆盖率",
        "is_sub_metric": true,
        "sub_metric_category": "TE",
        "rule_id": "m_1781984708420",
        "parent_rule_id": "m_1781984663938",
        "rule_type": "extract",
        "target_key": "other_36ksoy_m_1781984663938",
        "target_config": {
          "condition": "gte",
          "weight": 1,
          "monthly_targets": {
            "6": 100
          }
        },
        "source_columns": {
          "match_column": "name",
          "match_value": "虚拟系统部",
          "value_column": "contingency_plan_completed_rate"
        }
      }
    }
  ]
}
```

### 5. 指标明细列表

`GET /api/external/metrics`

用于移动端按条件分页读取所有指标。每条指标会尽量返回 `schema` 字段，用于说明指标分类、主指标/子指标层级、来源表、目标配置等。

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

### 6. 指标规则字典

`GET /api/external/metrics/schema`

用于移动端初始化指标字典，不依赖某个快照。返回所有可识别的来源表、主指标、子指标、目标配置和取数字段。

示例：

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3030/api/external/metrics/schema"
```

关键字段：

| 字段 | 说明 |
| --- | --- |
| `main_metric_label` | 主指标名称 |
| `metric_label` | 当前指标显示名称 |
| `category` / `sub_metric_category` | 分类，例如 `TE`、`ORG`、`ET`、`VDF`、`整体` |
| `is_sub_metric` | 是否为主指标下的子指标 |
| `target_config.condition` | 达标方向，`gte` 表示大于等于，`lte` 表示小于等于 |
| `target_config.monthly_targets` | 各月份目标值 |
| `source_columns` | 指标规则使用的匹配列、匹配值和取数字段 |

### 7. 临期任务预警

`GET /api/external/metrics/alerts`

返回最新快照或指定快照中保存的临期任务预警和特殊指标提醒。临期任务来自入库快照的 `expiringTickets`，与月报/大屏展示口径一致。

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `month` | number | 目标月份 |
| `snapshot_id` | string | 指定快照 ID，不传则返回筛选范围内最新快照 |
| `collection` | string | 任务类型过滤，例如 `rectification`、`vulnerability`、`risk`、`special`、`sr` |
| `urgency` | string | `expiring` 或 `overdue` |

示例：

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3030/api/external/metrics/alerts?month=6"
```

响应结构：

```json
{
  "snapshot": {
    "snapshot_id": "mr3w2tl9",
    "month": 6,
    "created_at": "2026-07-02 19:20:10"
  },
  "expiring_ticket_count": 34,
  "special_metric_alert_count": 5,
  "expiring_tickets": [
    {
      "collection": "rectification",
      "title": "🔧 整改详单合集",
      "ticket_id": "RC20260629000014",
      "network_name": "EG-Egypt Orange",
      "status": "Checking",
      "owner": "Ahmed Sameh Salah 84399984",
      "product_line": "Cloud Core Network",
      "product": "CloudEPC",
      "customer_name": "Orange Egypt for Telecommunications",
      "due_date": "1/1/27",
      "sla_days": 27,
      "urgency": "expiring",
      "sla_text": "Checking提醒 (剩余 27 天)",
      "raw": {}
    }
  ],
  "special_metric_alerts": []
}
```

### 8. 不达标指标列表

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
- 指标列表页使用 `/api/external/metrics` 分页加载，不建议一次拉全量。
- 指标字典/配置页使用 `/api/external/metrics/schema`。
- 临期任务预警页使用 `/api/external/metrics/alerts?month=<目标月>`。
- 异常提醒页使用 `/failing`。
- 只有在需要复现 Web 端入库原始数据时，才使用 `includeRaw=1`。

## 常见错误

| HTTP 状态码 | 说明 |
| --- | --- |
| 401 | 未携带 token，或 token 过期 |
| 403 | 当前账号无权限访问对应操作 |
| 404 | 快照不存在 |
| 500 | 服务端读取数据库异常 |
