import React from 'react';
import { Icon } from '@douyinfe/semi-ui';

const DingTalkIcon = (props) => {
  function CustomIcon() {
    return (
      <svg
        className='icon'
        viewBox='0 0 24 24'
        version='1.1'
        xmlns='http://www.w3.org/2000/svg'
        width='1em'
        height='1em'
        {...props}
      >
        <path
          d='M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.126 8.332l-2.213 3.84c-.054.093-.17.127-.264.077l-2.366-1.315c-.11-.061-.248.02-.245.147l.09 3.638c.003.12-.126.197-.232.136L5.94 11.463a.155.155 0 0 1-.05-.212l2.21-3.836a.155.155 0 0 1 .264-.077l2.366 1.315c.11.061.248-.02.245-.147l-.09-3.638c-.003-.12.126-.197.232-.136l5.956 3.392a.155.155 0 0 1 .053.208z'
          fill='#1677FF'
        />
      </svg>
    );
  }

  return <Icon svg={<CustomIcon />} />;
};

export default DingTalkIcon;
