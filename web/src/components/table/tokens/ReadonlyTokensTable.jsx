import React, { useEffect, useState } from 'react';
import {
  Button,
  Table,
  Tag,
  Toast,
  Typography,
  Empty,
} from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { API } from '../../../helpers';

const { Title, Text } = Typography;

function maskKey(key) {
  if (!key) return '***';
  if (key.length > 10) return key.substring(0, 6) + '***' + key.slice(-4);
  return '***';
}

const ReadonlyTokensTable = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tokenKeys, setTokenKeys] = useState({});
  const [copyingId, setCopyingId] = useState(null);

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

  const handleCopy = async (record) => {
    setCopyingId(record.id);
    try {
      let key = tokenKeys[record.id];
      if (!key) {
        const res = await API.get(`/api/token/${record.id}?status=true`);
        const { success, data } = res.data;
        if (!success || !data?.key) {
          Toast.error('获取 Key 失败，请重试');
          return;
        }
        key = data.key;
        setTokenKeys((prev) => ({ ...prev, [record.id]: key }));
      }
      await navigator.clipboard.writeText(key);
      Toast.success('已复制到剪贴板');
    } catch (e) {
      Toast.error('复制失败，请手动复制');
    } finally {
      setCopyingId(null);
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
      render: (key, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tag
            style={{
              fontFamily: 'monospace',
              fontSize: '13px',
              padding: '4px 10px',
              background: 'var(--semi-color-fill-0)',
              border: '1px solid var(--semi-color-border)',
              borderRadius: '6px',
            }}
          >
            {tokenKeys[record.id] ? tokenKeys[record.id] : maskKey(key)}
          </Tag>
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
      ),
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
