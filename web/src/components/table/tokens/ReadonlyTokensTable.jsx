import React, { useEffect, useState } from 'react';
import {
  Button,
  Table,
  Tag,
  Toast,
  Typography,
  Empty,
} from '@douyinfe/semi-ui';
import { IconCopy, IconEyeOpened, IconEyeClosedSolid } from '@douyinfe/semi-icons';
import { API } from '../../../helpers';

const { Title, Text } = Typography;

function maskKey(key) {
  if (!key) return '***';
  if (key.length > 10) return key.substring(0, 6) + '***' + key.slice(-4);
  return '***';
}

// HTTP 环境下 navigator.clipboard 不可用，用 execCommand 兜底
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(el);
  return ok ? Promise.resolve() : Promise.reject(new Error('execCommand failed'));
}

const ReadonlyTokensTable = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tokenKeys, setTokenKeys] = useState({});
  const [copyingId, setCopyingId] = useState(null);
  const [revealedIds, setRevealedIds] = useState(new Set());

  useEffect(() => {
    const fetchTokens = async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/token/?p=0&size=100');
        const { success, data } = res.data;
        if (success) {
          // API returns paginated { items, total, ... }, not a plain array
          setTokens(data?.items || []);
        }
      } catch (e) {
        Toast.error('获取 Key 列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTokens();
  }, []);

  const fetchKey = async (record) => {
    let key = tokenKeys[record.id];
    if (!key) {
      // GET /api/token/:id 返回 masked key，需用 POST /api/token/:id/key 获取明文
      const res = await API.post(`/api/token/${record.id}/key`);
      const { success, data } = res.data;
      if (!success || !data?.key) throw new Error('获取 Key 失败，请重试');
      key = data.key;
      setTokenKeys((prev) => ({ ...prev, [record.id]: key }));
    }
    return key;
  };

  const handleCopy = async (record) => {
    setCopyingId(record.id);
    try {
      const key = await fetchKey(record);
      await copyToClipboard(key);
      Toast.success('已复制到剪贴板');
    } catch (e) {
      Toast.error(e.message || '复制失败，请手动复制');
    } finally {
      setCopyingId(null);
    }
  };

  const handleToggleReveal = async (record) => {
    if (revealedIds.has(record.id)) {
      setRevealedIds((prev) => { const s = new Set(prev); s.delete(record.id); return s; });
      return;
    }
    try {
      await fetchKey(record);
      setRevealedIds((prev) => new Set(prev).add(record.id));
    } catch (e) {
      Toast.error(e.message || '获取 Key 失败');
    }
  };

  const columns = [
    {
      title: 'Key Name',
      dataIndex: 'name',
      render: (name) => (
        <Text strong style={{ fontSize: '14px' }}>
          {name}
        </Text>
      ),
    },
    {
      title: 'Key',
      dataIndex: 'key',
      render: (key, record) => {
        const revealed = revealedIds.has(record.id);
        const displayKey = revealed && tokenKeys[record.id]
          ? tokenKeys[record.id]
          : maskKey(key);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                padding: '4px 10px',
                background: 'var(--semi-color-fill-0)',
                border: '1px solid var(--semi-color-border)',
                borderRadius: '6px',
                maxWidth: '320px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayKey}
            </Tag>
            <Button
              size='small'
              icon={revealed ? <IconEyeClosedSolid /> : <IconEyeOpened />}
              onClick={() => handleToggleReveal(record)}
              style={{ borderRadius: '999px' }}
              theme='borderless'
              type='tertiary'
            />
            <Button
              size='small'
              icon={<IconCopy />}
              loading={copyingId === record.id}
              onClick={() => handleCopy(record)}
              style={{ borderRadius: '999px' }}
            >
              Copy
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Title heading={4}>My Key</Title>
      </div>
      {tokens.length === 0 && !loading ? (
        <Empty
          title='暂无 Key'
          description='请联系管理员分配 API Key'
          style={{ marginTop: '40px' }}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={tokens}
          loading={loading}
          pagination={{ pageSize: 100, hideOnSinglePage: true }}
          rowKey='id'
        />
      )}
    </div>
  );
};

export default ReadonlyTokensTable;
