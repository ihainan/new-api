package model

import (
	"math"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
)

/*
用户门户概览所需的聚合。单独一个文件，不与管理端统计混在一起。

为什么不复用 SumUsedQuota：那套按 username 聚合，而用户名是可变的（改名后历史对不上），
这里一律按 user_id。也不复用 /api/data/self：quota_data 只有次数和 token，
算不出缓存占比、首字延迟、失败比例，而且单次查询被限制在 30 天内、拿不到累计值。

跨库约束（见 CLAUDE.md Rule 2）：
  - 不使用任何数据库的 percentile 函数，三种库没有统一写法，分位数在 Go 里算；
  - JSON 字段不在 SQL 里解析（SQLite 的 json_extract 与 PG 的 -> 不通用），
    把需要的行取回 Go 再解析。
*/

// PortalMetrics 是概览页要的全部数字。指标算不出来时用 nil 表达「不可用」，
// 不用 0 冒充——0 次失败和「失败数据不可得」是两回事。
type PortalMetrics struct {
	RangeStart int64 `json:"range_start"`
	RangeEnd   int64 `json:"range_end"`

	Requests int64 `json:"requests"`
	Tokens   int64 `json:"tokens"`
	PromptTokens     int64 `json:"prompt_tokens"`
	CompletionTokens int64 `json:"completion_tokens"`

	CachedTokens int64 `json:"cached_tokens"`

	// 质量指标。指针为 nil 表示该区间内没有足够样本。
	AvgUseTimeSec *float64 `json:"avg_use_time_sec"`
	AvgFirstToken *float64 `json:"avg_first_token_ms"`
	CacheRatioPct *float64 `json:"cache_ratio_pct"`
	FailRatioPct  *float64 `json:"fail_ratio_pct"`

	/*
	 * P95。平均值会把长尾藏起来：10 次里 9 次 2 秒、1 次 40 秒，
	 * 平均 5.8 秒看着还行，但用户记住的是那 1 次。
	 * 样本太少时分位数没有意义，所以 nil 表示「不够算」而不是 0。
	 */
	P95UseTimeSec *float64 `json:"p95_use_time_sec"`
	P95FirstToken *float64 `json:"p95_first_token_ms"`

	// 历史累计，不随选定区间变化。回答「我到底一共用了多少」。
	LifetimeRequests int64 `json:"lifetime_requests"`
	LifetimeTokens   int64 `json:"lifetime_tokens"`

	Failed     int64 `json:"failed"`
	FailDenom  int64 `json:"fail_denom"`
	StreamN    int64 `json:"stream_samples"`
	UseTimeN   int64 `json:"use_time_samples"`
	ClientGone int64 `json:"client_gone"`

	// 错误日志被关掉时失败比例不可得，前端要据此写明原因而不是显示 0%。
	ErrorLogEnabled bool `json:"error_log_enabled"`

	Series []PortalPoint `json:"series"`
	Models []PortalModelStat `json:"models"`
}

type PortalPoint struct {
	Ts       int64 `json:"ts"`
	Requests int64 `json:"requests"`
	Tokens   int64 `json:"tokens"`

	// 分开给，前端才画得出三条线。合成一个 Tokens 的话，
	// 「命中缓存省下来的」和「真正跑了算力的」就混在一起了。
	PromptTokens     int64 `json:"prompt_tokens"`
	CompletionTokens int64 `json:"completion_tokens"`
	CachedTokens     int64 `json:"cached_tokens"`
}

type PortalModelStat struct {
	ModelName string `json:"model_name"`
	Requests  int64  `json:"requests"`
	Tokens    int64  `json:"tokens"`
}

type portalLogRow struct {
	CreatedAt        int64
	Type             int
	ModelName        string
	PromptTokens     int
	CompletionTokens int
	UseTime          int
	IsStream         bool
	Other            string
}

// GetPortalMetrics 读取 [start, end) 内该用户的日志并就地聚合。
// bucket 是折线图的时间粒度（秒）；调用方负责挑一个让点数保持在合理范围的值。
func GetPortalMetrics(userId int, start, end, bucket int64, errorLogEnabled bool) (*PortalMetrics, error) {
	if end <= start {
		end = time.Now().Unix()
	}
	if bucket <= 0 {
		bucket = 3600
	}

	m := &PortalMetrics{
		RangeStart:      start,
		RangeEnd:        end,
		ErrorLogEnabled: errorLogEnabled,
	}

	var rows []portalLogRow
	// 只取聚合要用的列。明细日志行数可能很大，不要 SELECT *。
	err := LOG_DB.Model(&Log{}).
		Select("created_at, type, model_name, prompt_tokens, completion_tokens, use_time, is_stream, other").
		Where("user_id = ? AND created_at >= ? AND created_at < ? AND type IN (?, ?)",
			userId, start, end, LogTypeConsume, LogTypeError).
		Order("created_at asc").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	buckets := map[int64]*PortalPoint{}
	models := map[string]*PortalModelStat{}

	var useTimeSum float64
	var frtSum float64
	var cacheTokens, promptTokens int64
	// 分位数要留全部样本再排序。三种数据库没有通用的 percentile 写法
	// （见文件头的跨库约束），所以在 Go 里算。
	useTimes := make([]float64, 0, len(rows))
	frts := make([]float64, 0, len(rows))

	for _, r := range rows {
		if r.Type == LogTypeError {
			m.Failed++
			m.FailDenom++
			continue
		}
		m.FailDenom++
		m.Requests++

		tok := int64(r.PromptTokens + r.CompletionTokens)
		m.Tokens += tok
		m.PromptTokens += int64(r.PromptTokens)
		m.CompletionTokens += int64(r.CompletionTokens)
		promptTokens += int64(r.PromptTokens)

		if r.UseTime > 0 {
			useTimeSum += float64(r.UseTime)
			useTimes = append(useTimes, float64(r.UseTime))
			m.UseTimeN++
		}

		b := r.CreatedAt - (r.CreatedAt-start)%bucket
		p := buckets[b]
		if p == nil {
			p = &PortalPoint{Ts: b}
			buckets[b] = p
		}
		p.Requests++
		p.Tokens += tok
		p.PromptTokens += int64(r.PromptTokens)
		p.CompletionTokens += int64(r.CompletionTokens)

		name := r.ModelName
		if name == "" {
			name = "(unknown)"
		}
		ms := models[name]
		if ms == nil {
			ms = &PortalModelStat{ModelName: name}
			models[name] = ms
		}
		ms.Requests++
		ms.Tokens += tok

		// other 是一段 JSON，里面有 cache_tokens、frt 和流式结束原因。
		// 解析失败就跳过这一行的这几个指标，不影响其余统计。
		if r.Other == "" {
			continue
		}
		var other map[string]any
		if common.UnmarshalJsonStr(r.Other, &other) != nil {
			continue
		}
		if v, ok := other["cache_tokens"].(float64); ok {
			cacheTokens += int64(v)
			p.CachedTokens += int64(v)
		}
		// 非流式请求的 frt 是 -1000 哨兵值。必须同时看 is_stream 和正负，
		// 只过滤其中一个会算出负的平均首字延迟。
		if r.IsStream {
			if v, ok := other["frt"].(float64); ok && v > 0 {
				frtSum += v
				frts = append(frts, v)
				m.StreamN++
			}
		}
		if ss, ok := other["stream_status"].(map[string]any); ok {
			if reason, ok := ss["end_reason"].(string); ok && reason == "client_gone" {
				m.ClientGone++
			}
		}
	}

	m.CachedTokens = cacheTokens

	if m.UseTimeN > 0 {
		v := round2(useTimeSum / float64(m.UseTimeN))
		m.AvgUseTimeSec = &v
	}
	if m.StreamN > 0 {
		v := math.Round(frtSum / float64(m.StreamN))
		m.AvgFirstToken = &v
	}
	if p := percentile(useTimes, 0.95); p != nil {
		v := round2(*p)
		m.P95UseTimeSec = &v
	}
	if p := percentile(frts, 0.95); p != nil {
		v := math.Round(*p)
		m.P95FirstToken = &v
	}
	if promptTokens > 0 {
		v := round2(float64(cacheTokens) / float64(promptTokens) * 100)
		m.CacheRatioPct = &v
	}
	// 错误日志关闭时库里就没有 type=5 的行，此时的 0 不代表没有失败。
	if errorLogEnabled && m.FailDenom > 0 {
		v := round2(float64(m.Failed) / float64(m.FailDenom) * 100)
		m.FailRatioPct = &v
	}

	// 折线图补齐空桶，否则前端会把「没有调用」画成两点之间的直线。
	for ts := start - (start-start)%bucket; ts < end; ts += bucket {
		if buckets[ts] == nil {
			buckets[ts] = &PortalPoint{Ts: ts}
		}
	}
	m.Series = make([]PortalPoint, 0, len(buckets))
	for _, p := range buckets {
		m.Series = append(m.Series, *p)
	}
	sort.Slice(m.Series, func(i, j int) bool { return m.Series[i].Ts < m.Series[j].Ts })

	m.Models = make([]PortalModelStat, 0, len(models))
	for _, v := range models {
		m.Models = append(m.Models, *v)
	}
	sort.Slice(m.Models, func(i, j int) bool { return m.Models[i].Requests > m.Models[j].Requests })

	fillLifetime(m, userId)

	return m, nil
}

func round2(f float64) float64 {
	return math.Round(f*100) / 100
}

/*
 * 分位数。样本少于 20 个就返回 nil——10 个样本算「95 分位」，
 * 拿到的其实就是最大值，把它写成 P95 是在给一个假的可信度。
 * 宁可显示「样本不足」，也不给一个看起来很精确的噪声。
 */
const minPercentileSamples = 20

func percentile(xs []float64, q float64) *float64 {
	if len(xs) < minPercentileSamples {
		return nil
	}
	s := make([]float64, len(xs))
	copy(s, xs)
	sort.Float64s(s)
	// 最近邻取法：索引落在 [0, len-1] 内，不做插值。
	i := int(math.Ceil(q*float64(len(s)))) - 1
	if i < 0 {
		i = 0
	}
	if i >= len(s) {
		i = len(s) - 1
	}
	return &s[i]
}

/*
 * 历史累计。和区间统计分开查：区间查询已经把明细行都拉回来了，
 * 再拉一次全量不现实——这里只让数据库做聚合，不返回行。
 * 失败不算致命：拿不到就留零值，前端显示「—」，不该因此让整页报错。
 */
func fillLifetime(m *PortalMetrics, userId int) {
	var row struct {
		Requests   int64
		Prompt     int64
		Completion int64
	}
	err := LOG_DB.Model(&Log{}).
		Select("count(*) as requests, coalesce(sum(prompt_tokens),0) as prompt, coalesce(sum(completion_tokens),0) as completion").
		Where("user_id = ? AND type = ?", userId, LogTypeConsume).
		Scan(&row).Error
	if err != nil {
		return
	}
	m.LifetimeRequests = row.Requests
	m.LifetimeTokens = row.Prompt + row.Completion
}
