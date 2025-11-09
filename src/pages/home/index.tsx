/*
 * @Description: 页面描述
 * @Author: hejp 378540660@qq.com
 * @Date: 2022-09-04 16:50:14
 * @LastEditors: hejp 378540660@qq.com
 * @LastEditTime: 2022-10-11 11:11:05
 * @FilePath: \bigscreen\src\pages\home\index.tsx
 * Copyright (c) 2022 by hejp 378540660@qq.com, All Rights Reserved.
 */
import { FC, useEffect } from 'react'
import { ALL_STATE } from '@store/actionType'
import { connect } from 'react-redux'
import { getStrategy } from '@store/actions/authorization'
import { IAnyObject } from '@src/types'
import './index.scss'

interface IHomeProps {
  strategy: IAnyObject
  getStrategy: (key: string) => void
  path: string
}

const Home: FC<IHomeProps> = ({ strategy, getStrategy, path }) => {
  // 获取策略
  useEffect(() => {
    getStrategy(path)
  }, [path, getStrategy])

  return (
    <div className='app-screen-home'>
      {/* 粒子背景 */}
      <div className="particles">
        {Array.from({ length: 150 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 5 + 5}s`
            }}
          />
        ))}
      </div>
      <div className='app-screen-home__content'>
        <div className='main-title'>欢迎来到大屏后台管理系统</div>
        <div className='sub-title'>- Welcome to the large screen background management system -</div>
      </div>
    </div>
  )
}

// 对应的statemkjh m,
const mapStateToProps = (state: ALL_STATE) => ({
  strategy: state.authorization.strategy
})

// 将 对应action 插入到组件的 props 中
const mapDispatchToProps = {
  getStrategy
}

export default connect(mapStateToProps, mapDispatchToProps)(Home)
