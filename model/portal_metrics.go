package model

import (
	"database/sql"
	"math"
	"sort"
	"sync"
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

	Requests         int64 `json:"requests"`
	Tokens           int64 `json:"tokens"`
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

	Series []PortalPoint     `json:"series"`
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

// portalLogRow 是一行日志里聚合要用的列。
type portalLogRow struct {
	Id               int
	CreatedAt        int64
	Type             int
	ModelName        string
	PromptTokens     int
	CompletionTokens int
	UseTime          int
	IsStream         bool
	Other            string
}

/*
 * 分批读一个用户的日志：按 id 升序每次最多 portalBatchSize 行，一批读进内存就关掉
 * 游标、释放连接，再交给 fn 处理，然后接着读下一批。
 *
 * 为什么要分批：SQLite 在默认的 rollback journal 模式下，游标开着就一直持有读锁，
 * 这期间转发请求写日志的事务提交不了。一个大账号一次统计要解析几十万行 JSON，
 * 整段持锁会把写入卡上一两秒；分批后锁只在「读一批」的几十毫秒里持有。
 * 也不整批全读：那样内存随行数线性涨（30 万行时约 400MB）。
 *
 * 所有列都按可空类型接：这些列在表上没有 NOT NULL，历史导入的数据里可能有 NULL，
 * 直接 Scan 进 int/bool 会整页报错。NULL 一律按零值处理。
 */
const portalBatchSize = 5000

func portalScanLogs(userId int, fromId int, where string, args []any, fn func(r *portalLogRow)) error {
	last := fromId
	for {
		q := LOG_DB.Model(&Log{}).
			Select("id, created_at, type, model_name, prompt_tokens, completion_tokens, use_time, is_stream, other").
			Where("user_id = ? AND id > ?", userId, last)
		if where != "" {
			q = q.Where(where, args...)
		}
		rows, err := q.Order("id asc").Limit(portalBatchSize).Rows()
		if err != nil {
			return err
		}
		batch, err := portalReadRows(rows)
		if err != nil {
			return err
		}
		for i := range batch {
			fn(&batch[i])
		}
		if len(batch) < portalBatchSize {
			return nil
		}
		last = batch[len(batch)-1].Id
	}
}

// portalReadRows 把一个结果集整批读进内存并关闭它（见 portalScanLogs 的说明）。
func portalReadRows(rows *sql.Rows) ([]portalLogRow, error) {
	defer rows.Close()
	batch := make([]portalLogRow, 0, portalBatchSize)
	for rows.Next() {
		var id, createdAt, typ, prompt, completion, useTime sql.NullInt64
		var modelName, other sql.NullString
		var isStream sql.NullBool
		if err := rows.Scan(&id, &createdAt, &typ, &modelName, &prompt, &completion,
			&useTime, &isStream, &other); err != nil {
			return nil, err
		}
		batch = append(batch, portalLogRow{
			Id:               int(id.Int64),
			CreatedAt:        createdAt.Int64,
			Type:             int(typ.Int64),
			ModelName:        modelName.String,
			PromptTokens:     int(prompt.Int64),
			CompletionTokens: int(completion.Int64),
			UseTime:          int(useTime.Int64),
			IsStream:         isStream.Bool,
			Other:            other.String,
		})
	}
	return batch, rows.Err()
}

/*
 * 按 id 取行：先查出要统计的 id（只读一列整数，快、占内存小），再按主键每
 * portalIdChunk 个一组取回来。锁只在「查 id」和「取一组」时持有。
 * 不按时间换算 id 范围：id 与 created_at 的先后并不保证一致（导入、迁移的历史
 * 数据就不一致），按那个假设缩范围会静默少算——本地压测正是这样算出了 1 条。
 * 一组 500 个：老版本 SQLite 单条语句最多 999 个参数。
 */
const portalIdChunk = 500

func portalScanByIds(ids []int, fn func(r *portalLogRow)) error {
	for i := 0; i < len(ids); i += portalIdChunk {
		j := i + portalIdChunk
		if j > len(ids) {
			j = len(ids)
		}
		rows, err := LOG_DB.Model(&Log{}).
			Select("id, created_at, type, model_name, prompt_tokens, completion_tokens, use_time, is_stream, other").
			Where("id IN ?", ids[i:j]).
			Rows()
		if err != nil {
			return err
		}
		batch, err := portalReadRows(rows)
		if err != nil {
			return err
		}
		for k := range batch {
			fn(&batch[k])
		}
	}
	return nil
}

// portalOther 只声明聚合要用的几个字段。解析进 map[string]any 会给每个键值
// 分配一次，几十万行时这部分开销比读库还大。数值一律 float64：
// 历史日志里同一个字段有写成整数的也有写成小数的，用整型接会整行解析失败。
type portalOther struct {
	CacheTokens         float64 `json:"cache_tokens"`
	CacheWriteTokens    float64 `json:"cache_write_tokens"`
	CacheCreationTokens float64 `json:"cache_creation_tokens"`
	InputTokensTotal    float64 `json:"input_tokens_total"`
	UsageSemantic       string  `json:"usage_semantic"`
	Frt                 float64 `json:"frt"`
	StreamStatus        *struct {
		EndReason string `json:"end_reason"`
	} `json:"stream_status"`
}

/*
 * 一条日志的「输入总量」。prompt_tokens 的含义随上游口径而变：
 *   - OpenAI 口径：prompt_tokens 已经包含命中缓存的部分；
 *   - Anthropic 口径（other.usage_semantic = "anthropic"）：prompt_tokens 只是
 *     没命中缓存的那部分，缓存读取在 cache_tokens、缓存写入在 cache_write_tokens
 *     （旧日志只有 cache_creation_tokens）。只加 prompt_tokens 会把 Claude 格式
 *     的输入少算一大截，缓存占比还会超过 100%。
 * 网关自己写了 input_tokens_total 时它就是归一后的总量，优先用它。
 */
func portalInputTotal(prompt int64, o *portalOther) int64 {
	if o == nil {
		return prompt
	}
	if o.InputTokensTotal > 0 {
		return int64(o.InputTokensTotal)
	}
	if o.UsageSemantic == "anthropic" {
		write := o.CacheWriteTokens
		if write == 0 {
			write = o.CacheCreationTokens
		}
		return prompt + int64(o.CacheTokens) + int64(write)
	}
	return prompt
}

// 折线图最多这么多个点。控制器按区间挑粒度，正常最多 366 个；
// 这里再兜一道，参数算错也不会变成一个停不下来的循环。
const portalMaxBuckets = 2000

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

	buckets := map[int64]*PortalPoint{}
	models := map[string]*PortalModelStat{}

	var useTimeSum float64
	var frtSum float64
	var cacheTokens, promptTokens int64
	// 分位数要留全部样本再排序。三种数据库没有通用的 percentile 写法
	// （见文件头的跨库约束），所以在 Go 里算。
	var useTimes, frts []float64

	// 先取 id，再按主键分组取行、边读边算（见 portalScanByIds）
	var ids []int
	if err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND created_at >= ? AND created_at < ? AND type IN (?, ?)",
			userId, start, end, LogTypeConsume, LogTypeError).
		Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	sort.Ints(ids)
	scanErr := portalScanByIds(ids,
		func(r *portalLogRow) {
			if r.Type == LogTypeError {
				m.Failed++
				m.FailDenom++
				return
			}
			m.FailDenom++
			m.Requests++

			// other 里有缓存、首字延迟、流式结束原因，还决定了输入总量怎么算。
			// 解析失败就按 OpenAI 口径记这一行，缓存和首字这几项跳过，不影响其余统计。
			var o *portalOther
			if r.Other != "" {
				var parsed portalOther
				if common.UnmarshalJsonStr(r.Other, &parsed) == nil {
					o = &parsed
				}
			}
			input := portalInputTotal(int64(r.PromptTokens), o)
			tok := input + int64(r.CompletionTokens)
			m.Tokens += tok
			m.PromptTokens += input
			m.CompletionTokens += int64(r.CompletionTokens)
			promptTokens += input

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
			p.PromptTokens += input
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

			if o == nil {
				return
			}
			cacheTokens += int64(o.CacheTokens)
			p.CachedTokens += int64(o.CacheTokens)
			// 非流式请求的 frt 是 -1000 哨兵值。必须同时看 is_stream 和正负，
			// 只过滤其中一个会算出负的平均首字延迟。
			if r.IsStream && o.Frt > 0 {
				frtSum += o.Frt
				frts = append(frts, o.Frt)
				m.StreamN++
			}
			if o.StreamStatus != nil && o.StreamStatus.EndReason == "client_gone" {
				m.ClientGone++
			}
		})
	if scanErr != nil {
		return nil, scanErr
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
	// 按个数循环而不是 ts += bucket 直到 end：时间戳接近 int64 上限时累加会
	// 溢出成负数，循环永远停不下来（一个请求就能把整个进程拖死）。
	n := (end - start + bucket - 1) / bucket
	if n > portalMaxBuckets {
		n = portalMaxBuckets
	}
	for i := int64(0); i < n; i++ {
		ts := start + i*bucket
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
 * 历史累计。输入总量要按每行的口径算（见 portalInputTotal），这就得解析 other，
 * 没法交给数据库 SUM。每次打开概览都把一个人的全部历史解析一遍太贵，所以按用户
 * 在内存里记住「算到哪一行（日志 id）、累计多少」，之后每次只补算新增的行——
 * 走 (user_id, id) 索引，通常只有几行。第一次打开时全量算一遍（分批读，不长时间
 * 占着 SQLite 的读锁）：本地实测一个 30 万条日志的账号约 2 秒，之后是毫秒级。
 *
 * 只把两分钟之前的行记进缓存，更新的行每次现算：MySQL/PostgreSQL 并发写入时
 * 自增 id 的提交顺序不保证和数值顺序一致，小 id 可能晚于大 id 才可见。按 id 升序读，
 * 碰到第一条新行后后面的一律只现算，lastId 不会越过没进缓存的行。
 * 这仍然只是概率上的保证（事务拖过两分钟才提交就会漏），所以缓存每 24 小时整体
 * 重算一次兜底；管理员删除历史日志后累计值也在这时跟上。生产是 SQLite，单写者、
 * 插入即可见，不受提交乱序影响。
 *
 * 失败不算致命：拿不到就留零值，前端显示「—」，不该因此让整页报错。
 */
type portalLifetime struct {
	mu       sync.Mutex
	builtAt  int64 // 最近一次全量重算的时间
	lastId   int
	requests int64
	tokens   int64
}

const portalLifetimeRebuild = 24 * 3600

var portalLifetimes sync.Map // user_id -> *portalLifetime

func fillLifetime(m *PortalMetrics, userId int) {
	v, _ := portalLifetimes.LoadOrStore(userId, &portalLifetime{})
	lt := v.(*portalLifetime)
	// 每个用户一把锁：同一个人连点两次不会并行全量扫两遍，别人也不用排队
	lt.mu.Lock()
	defer lt.mu.Unlock()

	now := time.Now().Unix()
	rebuild := now-lt.builtAt > portalLifetimeRebuild
	fromId := lt.lastId
	if rebuild {
		fromId = 0
	}
	cutoff := now - 120

	// 先在局部累加，整批读完且没出错才写回缓存：读到一半失败的话，
	// 写回一半会让 lastId 跳过没算的行，累计值从此永久少一截
	lastId, requests, tokens := fromId, int64(0), int64(0)
	var freshRequests, freshTokens int64
	fresh := false
	err := portalScanLogs(userId, fromId, "type = ?", []any{LogTypeConsume}, func(r *portalLogRow) {
		var o *portalOther
		if r.Other != "" {
			var parsed portalOther
			if common.UnmarshalJsonStr(r.Other, &parsed) == nil {
				o = &parsed
			}
		}
		tok := portalInputTotal(int64(r.PromptTokens), o) + int64(r.CompletionTokens)
		if fresh || r.CreatedAt >= cutoff {
			fresh = true
			freshRequests++
			freshTokens += tok
			return
		}
		requests++
		tokens += tok
		lastId = r.Id
	})
	if err != nil {
		return
	}
	if rebuild {
		lt.builtAt, lt.requests, lt.tokens = now, 0, 0
	}
	lt.lastId = lastId
	lt.requests += requests
	lt.tokens += tokens

	m.LifetimeRequests = lt.requests + freshRequests
	m.LifetimeTokens = lt.tokens + freshTokens
}
