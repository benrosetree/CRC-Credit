import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { CirclesSDKProvider } from './CirclesSDKContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <CirclesSDKProvider>
      <App />
    </CirclesSDKProvider>
  </React.StrictMode>,
)