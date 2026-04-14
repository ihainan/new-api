import React from 'react';

const DingTalkIcon = ({ style, className }) => (
  <img
    src='/ding.webp'
    alt='DingTalk'
    draggable={false}
    style={{ borderRadius: '50%', display: 'block', ...style }}
    className={className}
  />
);

export default DingTalkIcon;
