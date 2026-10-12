import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import HostView from './HostView.jsx'
import GuestView from './GuestView.jsx'

const isGuest = window.location.pathname.startsWith('/vote')

createRoot(document.getElementById('root')).render(isGuest ? <GuestView /> : <HostView />)
