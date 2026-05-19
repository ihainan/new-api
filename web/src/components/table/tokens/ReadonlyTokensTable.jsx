import React, { useEffect, useState } from 'react';
import {
  Table,
  Typography,
  Empty,
  Toast,
} from '@douyinfe/semi-ui';
import { API } from '../../../helpers';

const { Title, Text } = Typography;

const ReadonlyTokensTable = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTokens = async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/token/?p=0&size=100');
        const { success, data } = res.data;
        if (success) {
          // API returns paginated { items, total, ... }, not a plain array.
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
