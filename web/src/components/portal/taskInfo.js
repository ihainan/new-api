/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/*
 * 任务行的解读规则。使用记录和任务队列两页都要用同一套说法——
 * 同一个任务在两个地方显示成不同的状态词，比不显示更糟。
 *
 * 返回的都是中文原文，同时也是 i18n 的 key：这套方案缺译文时回退成中文，
 * 不会变成空白或 key 名。
 */

// 任务行里能给人看的东西藏在 properties 里：platform 存的是渠道类型编号（55），
// action 是上游原词（textGenerate），直接摆出来没人看得懂。
export function taskModel(r) {
  try {
    const p =
      typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties;
    return p?.origin_model_name || p?.upstream_model_name || '';
  } catch (e) {
    return '';
  }
}

export const TASK_ACTION = {
  textGenerate: '文生视频',
  imageGenerate: '图生视频',
  videoGenerate: '视频生成',
};

const TASK_STATUS = {
  SUCCESS: '成功',
  FAILURE: '失败',
  QUEUED: '排队中',
  IN_PROGRESS: '生成中',
  SUBMITTED: '已提交',
  NOT_START: '未开始',
  UNKNOWN: '未知',
};

const RUNNING = ['QUEUED', 'IN_PROGRESS', 'SUBMITTED', 'NOT_START'];

/*
 * 任务走三步：排队 → 生成 → 完成。
 *
 * 不要显示 progress 那个百分比：后端 service/task_polling.go 是按状态塞的固定值
 * （已提交 10%、排队 20%、生成中 30%、完成 100%），上游真实的进度压根没存进来
 * ——实测一个排队中的任务，上游回的是 progress: 0，我们显示成 20%。
 * 把阶段画成三步，说的是同一件事，而且不骗人。
 */
export const TASK_STEPS = ['排队', '生成', '完成'];

// 返回每一步的状态：done / cur / bad / todo
export function taskSteps(r) {
  const st = String(r.status || '').toUpperCase();
  if (st === 'SUCCESS') return ['done', 'done', 'done'];
  if (st === 'FAILURE') {
    // 失败停在哪一步：跑起来过就是倒在生成上，没跑起来就是倒在排队上
    return r.start_time ? ['done', 'bad', 'todo'] : ['bad', 'todo', 'todo'];
  }
  if (st === 'IN_PROGRESS') return ['done', 'cur', 'todo'];
  return ['cur', 'todo', 'todo'];
}

// 每个状态多一句人话，鼠标悬停时说清楚现在到底卡在哪
export const TASK_HINT = {
  NOT_START: '已提交，等待上游接收',
  SUBMITTED: '已提交，等待上游排队',
  QUEUED: '在上游排队，还没开始生成',
  IN_PROGRESS: '上游正在生成',
  SUCCESS: '已生成完成',
  FAILURE: '任务失败',
};

// 排队和生成中都还没有结果，用中性色；成功绿、失败红，和对话表一致
export function taskState(r) {
  const st = String(r.status || '').toUpperCase();
  if (st === 'SUCCESS') return { cls: 'ok', bar: 'fast', text: '成功' };
  if (st === 'FAILURE') return { cls: 'bad', bar: 'slow', text: '失败' };
  const running = RUNNING.includes(st);
  return {
    cls: 'plain',
    bar: running ? 'mid' : 'na',
    text: TASK_STATUS[st] || r.status || '—',
    running,
  };
}

// 生成耗时：没结束的按「已等待」算，让人知道等了多久。
// 只返回时长本身，「（进行中）」这类字样由调用方用 t() 拼——
// 这里拼死了就没法翻译。
export function taskDuration(r) {
  const start = Number(r.submit_time || 0);
  if (!start) return '—';
  const end = Number(r.finish_time || 0) || Math.floor(Date.now() / 1000);
  const sec = Math.max(0, end - start);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

/*
 * 结果链接。后端存的是 `{系统地址}/v1/videos/{任务ID}/content`，「系统地址」是管理员
 * 在后台填的一个值——填错或没填，这条链接就指到别处去（本机 dev 填的是前端地址，
 * 点过去落在前端的 404 页上）。
 *
 * 这个取视频的接口跟门户在同一台上、而且认登录态，所以自家的这条代理链接一律换成
 * 同源的相对路径：无论系统地址填成什么，点了都对。外部直链（有些渠道直接给上游的
 * mp4 地址）保持原样。
 */
export function taskResultUrl(task) {
  const raw = String(task?.result_url || '').trim();
  if (!raw || !task?.task_id) return raw;
  const own = `/v1/videos/${task.task_id}/content`;
  try {
    if (new URL(raw, window.location.origin).pathname === own) return own;
  } catch (e) {
    return raw;
  }
  return raw;
}
