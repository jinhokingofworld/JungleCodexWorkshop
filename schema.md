# DB 스키마 (참고용)

아래 구조는 빠르게 참고하기 위한 초안입니다.

## stocks

```json
{
  "object_id": "string",
  "name": "string",
  "code/ticker": "string",
  "price": "number",
  "nation": "KR | US",
  "fluctuation_rate": "number",
  "volume": "number",
  "create_at": "Date"
}
```

## debates

```json
{
  "object_id": "string",
  "stock_name": "string",
  "stock_code": "string",
  "contents": "string",
  "keyword": "string",
  "create_at": "Date",
  "likes": "number"
}
```

## personas

```json
{
  "object_id": "string",
  "name": "string",
  "count": "number"
}
```
